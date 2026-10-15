/**
 * Nihongo Helper Extension - workspace.js
 * Controller trung tâm cho Không gian làm việc Toàn màn hình (Full-Screen Workspace v4.0)
 * 
 * Tính năng chính:
 * 1. Routing mượt mà giữa các View (Tổng quan, Bộ thẻ, Chi tiết bộ thẻ, Tra từ điển, Từ đã lưu, Ôn tập SRS, Trắc nghiệm, Thống kê, Cài đặt).
 * 2. Ôn tập Flashcard SRS Anki/Quizlet chuẩn hóa: Mặt trước CHỈ hiển thị từ vựng (không kèm cách đọc), mặt sau hiển thị đầy đủ thông tin.
 * 3. Hỗ trợ quy trình AI Prompt: Tạo prompt chuyển đổi từ vựng cho AI, nhập/xuất JSON 6 trường chuẩn an toàn không ghi đè.
 * 4. Quản lý bộ thẻ đầy đủ: Xem chi tiết, sửa tên, nhân bản, xóa có xác nhận tên bộ thẻ.
 * 5. Cập nhật giao diện và thống kê thời gian thực không cần reload trang.
 */

// Thực thể Database IndexedDB ngoại tuyến
const db = new JPEXDatabase();

// Trạng thái ứng dụng (Application State)
const AppState = {
  currentView: 'overview',
  currentDeckId: null,
  activeDeck: null,
  allDecks: [],
  allCards: [],
  savedWords: [],
  reviewQueue: [],
  reviewCurrentIndex: 0,
  reviewFlipped: false,
  reviewDeckTitle: '',
  theme: 'dark',
  speechRate: 1.0,
  autoPlayAudio: false,
  jlptLevel: localStorage.getItem('jpex_jlpt_selected_level') || 'N4',
  jlptSubtab: 'vocab',
  jlptQuery: '',
  jlptStatusFilter: 'all',
  jlptTransFilter: 'all',
  jlptPage: 1,
  jlptPageSize: 50,
  jlptSelectedIds: new Set(),
  jlptFilteredWords: [],
  jlptGrammarQuery: '',
  jlptGrammarTransFilter: 'all',
  jlptGrammarPage: 1,
  jlptGrammarPageSize: 20,
  jlptFilteredGrammar: [],
  jlptKanjiQuery: '',
  jlptKanjiPage: 1,
  jlptKanjiPageSize: 40,
  jlptFilteredKanji: [],
  personalImportParsed: null
};

// ========================================================
// 1. KHỞI TẠO VÀ ĐIỀU HƯỚNG VIEW
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupNavigation();
  setupGlobalActions();
  setupReviewShortcuts();
  setupSavedWordsEvents();
  setupImportModal();
  setupExportModal();
  setupJLPTEvents();

  try {
    await db.open();
  } catch (e) {
    console.warn('[Workspace] db.open warning:', e);
  }

  // Tải dữ liệu ban đầu
  await reloadAllData();

  // Đọc tham số URL để chuyển đúng View
  handleUrlRouting();

  // Lắng nghe thay đổi dữ liệu từ các tab/popup khác (Real-time sync không cần F5)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.savedWords || changes.jpex_decks || changes.jpex_cards || changes._lastSyncSignal)) {
        console.log('[Workspace] Dữ liệu thay đổi từ tab/cửa sổ khác, tự động đồng bộ hiển thị ngay lập tức...');
        reloadAllData(true);
      }
    });
  }
});

/**
 * Khởi tạo Dark / Light Mode
 */
function initTheme() {
  const savedTheme = localStorage.getItem('jpex_workspace_theme') || 'dark';
  setTheme(savedTheme);

  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }
}

function setTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('jpex_workspace_theme', theme);
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    themeIcon.innerText = theme === 'dark' ? '🌙' : '☀️';
  }
}

/**
 * Xử lý routing dựa trên query param trên URL
 */
function handleUrlRouting() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view') || 'overview';
  const query = params.get('q') || '';
  const deckId = params.get('deckId') || null;

  if (view === 'dict') {
    switchView('dict');
    if (query) {
      const searchInput = document.getElementById('dict-search-input');
      if (searchInput) {
        searchInput.value = query;
        performDictSearch(query);
      }
    }
  } else if (view === 'review') {
    if (deckId) {
      startReviewMode(deckId);
    } else {
      switchView('review');
    }
  } else if ((view === 'deck_detail' || view === 'deck-detail') && deckId) {
    openDeckDetail(deckId);
  } else {
    switchView(view);
  }
}

/**
 * Thiết lập các nút Menu Sidebar
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // Nút mở Sentence Analyzer từ Sidebar
  const btnSidebarAnalyzer = document.getElementById('btn-sidebar-analyzer');
  const linkToAnalyzer = document.getElementById('link-to-analyzer');
  const openAnalyzerAction = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'openSentenceAnalyzer' });
    } else {
      window.location.href = 'analyzer.html';
    }
  };
  if (btnSidebarAnalyzer) btnSidebarAnalyzer.addEventListener('click', openAnalyzerAction);
  if (linkToAnalyzer) linkToAnalyzer.addEventListener('click', openAnalyzerAction);
}

/**
 * Chuyển đổi View hiển thị (Hỗ trợ chuẩn hóa tên view gạch nối & gạch dưới)
 */
function switchView(viewName) {
  AppState.currentView = viewName;

  // Chuẩn hóa tên view
  const normalizedView = (viewName === 'deck_detail' || viewName === 'deck-detail') ? 'deck-detail' : viewName;

  // Cập nhật class active ở Sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    const itemDataView = item.getAttribute('data-view');
    if (itemDataView === viewName || (itemDataView === 'decks' && normalizedView === 'deck-detail')) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Cập nhật hiển thị Sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSection = document.getElementById(`view-${normalizedView}`) || document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Cập nhật tiêu đề Topbar
  const pageTitle = document.getElementById('page-title');
  const titles = {
    overview: 'Tổng quan học tập',
    dict: 'Tra cứu từ điển',
    jlpt: 'Thư viện Từ vựng JLPT (N1–N5)',
    saved: 'Danh sách từ đã lưu',
    decks: 'Quản lý Bộ thẻ Flashcard',
    'deck-detail': AppState.activeDeck ? AppState.activeDeck.name : 'Chi tiết bộ thẻ',
    deck_detail: AppState.activeDeck ? AppState.activeDeck.name : 'Chi tiết bộ thẻ',
    review: 'Trung tâm Ôn tập SRS',
    test: 'Kiểm tra trắc nghiệm',
    stats: 'Thống kê tiến độ ôn tập',
    guide: 'Hướng dẫn sử dụng toàn diện',
    settings: 'Cài đặt & Sao lưu dữ liệu'
  };
  if (pageTitle) {
    pageTitle.innerText = titles[viewName] || titles[normalizedView] || 'Không gian học tập';
  }

  // Render lại nội dung tương ứng
  if (normalizedView === 'overview') renderOverview();
  else if (normalizedView === 'decks') renderDecksView();
  else if (normalizedView === 'saved') renderSavedWordsView();
  else if (normalizedView === 'jlpt') renderJLPTView();
  else if (normalizedView === 'review') renderSrsHubView();
  else if (normalizedView === 'stats') renderStatsView();
  else if (normalizedView === 'test') setupQuizView();
  else if (normalizedView === 'guide') {
    const mainArea = document.querySelector('.app-main');
    if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Tải lại toàn bộ dữ liệu từ storage
 */
async function reloadAllData(render = true) {
  if (typeof getDecks === 'function') {
    AppState.allDecks = await getDecks();
    AppState.allCards = await getAllCards();
    AppState.savedWords = await getSavedWords();
  }

  // Cập nhật badge counters
  updateBadgeCounters();

  if (render) {
    const norm = (AppState.currentView === 'deck_detail' || AppState.currentView === 'deck-detail') ? 'deck-detail' : AppState.currentView;
    if (norm === 'overview') renderOverview();
    else if (norm === 'decks') renderDecksView();
    else if (norm === 'saved') renderSavedWordsView();
    else if (norm === 'review') renderSrsHubView();
    else if (norm === 'deck-detail' && AppState.currentDeckId) {
      openDeckDetail(AppState.currentDeckId);
    }
  }
}

function updateBadgeCounters() {
  const badgeDecks = document.getElementById('badge-total-decks');
  const badgeDue = document.getElementById('badge-due-cards');
  const badgeSaved = document.getElementById('badge-saved-words');

  const now = Date.now();
  const dueCards = AppState.allCards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);

  if (badgeDecks) badgeDecks.innerText = AppState.allDecks.length;
  if (badgeDue) {
    badgeDue.innerText = dueCards.length;
    badgeDue.style.display = dueCards.length > 0 ? 'inline-block' : 'none';
  }
  if (badgeSaved) badgeSaved.innerText = AppState.savedWords.length;
}

// ========================================================
// 2. VIEW: TỔNG QUAN (OVERVIEW)
// ========================================================
function renderOverview() {
  const statDecks = document.getElementById('stat-total-decks');
  const statCards = document.getElementById('stat-total-cards');
  const statDue = document.getElementById('stat-due-today');
  const statReviewed = document.getElementById('stat-reviewed-today');

  const now = Date.now();
  const dueCards = AppState.allCards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);

  if (statDecks) statDecks.innerText = AppState.allDecks.length;
  if (statCards) statCards.innerText = AppState.allCards.length;
  if (statDue) statDue.innerText = dueCards.length;

  if (typeof getReviewStats === 'function') {
    getReviewStats().then(stats => {
      if (statReviewed) statReviewed.innerText = stats.todayReviews || 0;
    });
  }

  // Render danh sách bộ thẻ preview
  const grid = document.getElementById('overview-decks-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (AppState.allDecks.length === 0) {
    grid.innerHTML = `
      <div class="empty-placeholder" style="grid-column: 1 / -1;">
        <div class="empty-icon">🗂️</div>
        <h3>Chưa có bộ thẻ nào</h3>
        <p>Bấm vào "Tạo bộ thẻ mới" để tạo bộ flashcard đầu tiên của bạn!</p>
      </div>
    `;
    return;
  }

  AppState.allDecks.slice(0, 6).forEach(deck => {
    const cardCount = AppState.allCards.filter(c => c.deckId === deck.id).length;
    const deckDueCount = AppState.allCards.filter(c => c.deckId === deck.id && (!c.srs || !c.srs.dueDate || c.srs.dueDate <= now)).length;

    const deckEl = document.createElement('div');
    deckEl.className = 'deck-card';
    deckEl.style.setProperty('--deck-color', deck.color || '#0284c7');
    deckEl.innerHTML = `
      <div class="deck-card-top">
        <div>
          <div class="deck-name">${escapeHtml(deck.name)}</div>
          <div class="deck-desc">${escapeHtml(deck.description || 'Chưa có mô tả')}</div>
        </div>
      </div>
      <div class="deck-stats-row">
        <span><b>${cardCount}</b> thẻ</span>
        ${deckDueCount > 0 ? `<span class="deck-due-badge">${deckDueCount} cần ôn</span>` : ''}
      </div>
      <div class="deck-card-actions">
        <button class="btn btn-primary btn-sm btn-quick-review" style="flex: 1;">🃏 Ôn tập</button>
        <button class="btn btn-secondary btn-sm btn-quick-view">Xem</button>
      </div>
    `;

    deckEl.querySelector('.btn-quick-review').onclick = (e) => {
      e.stopPropagation();
      startReviewMode(deck.id);
    };
    deckEl.querySelector('.btn-quick-view').onclick = (e) => {
      e.stopPropagation();
      openDeckDetail(deck.id);
    };
    deckEl.onclick = () => openDeckDetail(deck.id);

    grid.appendChild(deckEl);
  });
}

// ========================================================
// 3. VIEW: TRA CỨU TỪ ĐIỂN (DICTIONARY LOOKUP)
// ========================================================
function setupDictSearch() {
  const input = document.getElementById('dict-search-input');
  const btnSubmit = document.getElementById('btn-dict-search-submit');

  const doSearch = () => {
    const query = input.value.trim();
    if (query) performDictSearch(query);
  };

  if (btnSubmit) btnSubmit.addEventListener('click', doSearch);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });
  }
}
setupDictSearch();

async function performDictSearch(query) {
  const resultsContainer = document.getElementById('dict-results-list');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = `
    <div class="empty-placeholder">
      <div class="empty-icon">⏳</div>
      <h3>Đang tra cứu từ "${escapeHtml(query)}"...</h3>
    </div>
  `;

  try {
    let offlineResults = [];
    if (db && typeof db.search === 'function') {
      offlineResults = await db.search(query, 12);
    }

    let onlineData = null;
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      onlineData = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'translate', text: query }, (res) => {
          resolve(res && res.success ? res.data : null);
        });
      });
    }

    renderDictSearchResults(query, offlineResults, onlineData);
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="empty-placeholder">
        <div class="empty-icon">⚠️</div>
        <h3>Lỗi khi tra cứu</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderDictSearchResults(query, offlineResults, onlineData) {
  const container = document.getElementById('dict-results-list');
  if (!container) return;
  container.innerHTML = '';

  const merged = [];

  // 1. Kết quả từ IndexedDB offline
  if (offlineResults && offlineResults.length > 0) {
    offlineResults.forEach(item => {
      merged.push({
        word: item.kanji || item.word || query,
        reading: item.kana || item.reading || '',
        hanviet: item.hanviet || '',
        meaning: item.meaning || '',
        pos: item.partOfSpeech || 'Từ vựng',
        jlpt: item.jlpt || '',
        source: 'Offline'
      });
    });
  }

  // 2. Kết quả từ Jisho / Online
  if (onlineData && Array.isArray(onlineData.results)) {
    onlineData.results.forEach(res => {
      const exists = merged.some(m => m.word === res.kanji && m.reading === res.reading);
      if (!exists) {
        merged.push({
          word: res.kanji || query,
          reading: res.reading || '',
          hanviet: res.hanviet || onlineData.hanviet || '',
          meaning: res.meaningVi || res.meaning || '',
          pos: res.pos || 'Từ vựng',
          jlpt: res.jlpt || '',
          source: 'Online'
        });
      }
    });
  }

  if (merged.length === 0) {
    container.innerHTML = `
      <div class="empty-placeholder">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy từ "${escapeHtml(query)}"</h3>
        <p>Hãy thử tìm bằng chữ Kanji, Hiragana, Katakana hoặc nghĩa tiếng Việt tương đương.</p>
      </div>
    `;
    return;
  }

  merged.forEach(item => {
    const card = document.createElement('div');
    card.className = 'dict-card';
    card.innerHTML = `
      <div class="dict-card-header">
        <div class="dict-kanji-row">
          <span class="dict-word-kanji">${escapeHtml(item.word)}</span>
          ${item.reading ? `<span class="dict-word-reading">${escapeHtml(item.reading)}</span>` : ''}
          ${item.hanviet ? `<span class="dict-word-hanviet">${escapeHtml(item.hanviet)}</span>` : ''}
        </div>
        <div class="dict-badges">
          ${item.jlpt ? `<span class="badge-jlpt">${escapeHtml(item.jlpt)}</span>` : ''}
          <span class="badge-pos">${escapeHtml(item.pos)}</span>
        </div>
      </div>
      <div class="dict-meaning">${escapeHtml(item.meaning)}</div>
      <div class="dict-card-actions">
        <button class="btn btn-ghost btn-sm btn-dict-audio" title="Phát âm">🔊 Nghe</button>
        <button class="btn btn-secondary btn-sm btn-dict-save-word" title="Lưu nhanh vào danh sách Từ đã lưu">⭐ Lưu từ</button>
        <button class="btn btn-primary btn-sm btn-dict-add-flashcard">➕ Thêm vào Flashcard</button>
      </div>
    `;

    card.querySelector('.btn-dict-audio').onclick = () => playPronunciation(item.word);
    card.querySelector('.btn-dict-save-word').onclick = async () => {
      await saveWord({
        word: item.word,
        reading: item.reading,
        hanviet: item.hanviet,
        meaning: item.meaning
      }, 'Mặc định');
      alert(`⭐ Đã lưu "${item.word}" vào danh sách Từ đã lưu & bộ thẻ Flashcard!`);
    };
    card.querySelector('.btn-dict-add-flashcard').onclick = () => {
      openAddCardModalWithData({
        word: item.word,
        reading: item.reading,
        hanviet: item.hanviet,
        meaning: item.meaning
      });
    };

    container.appendChild(card);
  });
}

// ========================================================
// 4. VIEW: TỪ ĐÃ LƯU (SAVED WORDS) - CẬP NHẬT THỜI GIAN THỰC
// ========================================================
function setupSavedWordsEvents() {
  const searchInput = document.getElementById('saved-search-input');
  const folderFilter = document.getElementById('saved-folder-filter');
  const btnExportCsv = document.getElementById('btn-saved-export-csv');
  const btnPractice = document.getElementById('btn-saved-practice');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderSavedWordsView();
    });
  }

  if (folderFilter) {
    folderFilter.addEventListener('change', () => {
      renderSavedWordsView();
    });
  }

  // Nút Xuất CSV cho Excel
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      const selectedFolder = folderFilter ? folderFilter.value : '__all__';
      if (typeof exportSavedWordsToCsv === 'function') {
        const csvContent = await exportSavedWordsToCsv(selectedFolder);
        if (!csvContent) {
          alert('Không có từ vựng nào trong thư mục đã chọn để xuất CSV!');
          return;
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const fileName = `jp-saved-words-${selectedFolder === '__all__' ? 'all' : selectedFolder}-${dateStr}.csv`;
        downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
      }
    });
  }

  // Nút Ôn tập từ đã lưu
  if (btnPractice) {
    btnPractice.addEventListener('click', () => {
      const selectedFolder = folderFilter ? folderFilter.value : '__all__';
      let wordsToPractice = AppState.savedWords;
      if (selectedFolder !== '__all__') {
        wordsToPractice = wordsToPractice.filter(w => (w.folder || 'Mặc định') === selectedFolder);
      }

      if (wordsToPractice.length === 0) {
        alert('Chưa có từ vựng nào trong thư mục này để ôn tập! Hãy tra từ và bấm lưu trước.');
        return;
      }

      // Khởi tạo phiên ôn tập Flashcard từ danh sách từ đã lưu
      const practiceCards = wordsToPractice.map((w, idx) => ({
        id: `practice_${idx}_${Date.now()}`,
        word: w.kanji || w.word,
        reading: w.reading || w.kana || '',
        hanviet: w.hanviet || '',
        meaning: w.meaning || w.meaningVi || 'Chưa rõ nghĩa',
        example: w.example || '',
        exampleMeaning: w.exampleMeaning || '',
        notes: `Thư mục: ${w.folder || 'Mặc định'}`,
        isStarred: false
      }));

      startReviewModeWithCustomQueue(practiceCards, `Từ đã lưu (${selectedFolder === '__all__' ? 'Tất cả' : selectedFolder})`);
    });
  }
}

function renderSavedWordsView() {
  const tbody = document.getElementById('saved-words-tbody');
  const folderFilter = document.getElementById('saved-folder-filter');
  const searchInput = document.getElementById('saved-search-input');
  if (!tbody) return;

  const selectedFolder = folderFilter ? folderFilter.value : '__all__';
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = AppState.savedWords;
  if (selectedFolder !== '__all__') {
    filtered = filtered.filter(w => (w.folder || 'Mặc định') === selectedFolder);
  }
  if (searchTerm) {
    filtered = filtered.filter(w => 
      (w.kanji && w.kanji.toLowerCase().includes(searchTerm)) ||
      (w.reading && w.reading.toLowerCase().includes(searchTerm)) ||
      (w.meaning && w.meaning.toLowerCase().includes(searchTerm)) ||
      (w.hanviet && w.hanviet.toLowerCase().includes(searchTerm))
    );
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
          Không có từ vựng nào phù hợp trong danh sách lưu trữ.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((word, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="cell-kanji">${escapeHtml(word.kanji || word.word)}</td>
      <td class="cell-reading">${escapeHtml(word.reading || '')}</td>
      <td style="color: var(--accent-amber); font-weight: 600;">${escapeHtml(word.hanviet || '')}</td>
      <td>${escapeHtml(word.meaning || word.meaningVi || '')}</td>
      <td><span class="badge-pos">${escapeHtml(word.folder || 'Mặc định')}</span></td>
      <td style="text-align: center;">
        <button class="footer-btn btn-row-audio" title="Phát âm" style="display: inline-flex;">🔊</button>
        <button class="footer-btn btn-row-delete" title="Xóa từ" style="display: inline-flex; color: #e11d48;">🗑️</button>
      </td>
    `;

    tr.querySelector('.btn-row-audio').onclick = () => playPronunciation(word.kanji || word.word);
    tr.querySelector('.btn-row-delete').onclick = async () => {
      const wordKey = word.kanji || word.word;
      if (confirm(`Bạn có chắc chắn muốn xóa từ "${wordKey}" khỏi danh sách lưu?`)) {
        await deleteWord(wordKey);
        await reloadAllData(true);
      }
    };

    tbody.appendChild(tr);
  });

  // Nạp danh sách folder vào filter (giữ nguyên lựa chọn hiện tại)
  if (folderFilter && typeof getSavedFolders === 'function') {
    getSavedFolders().then(folders => {
      const currentVal = folderFilter.value;
      folderFilter.innerHTML = '<option value="__all__">Tất cả thư mục</option>';
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f;
        opt.innerText = f;
        if (f === currentVal) opt.selected = true;
        folderFilter.appendChild(opt);
      });
    });
  }
}

// ========================================================
// 5. VIEW: BỘ THẺ FLASHCARD (DECKS MANAGER)
// ========================================================
function renderDecksView() {
  const grid = document.getElementById('decks-manager-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const now = Date.now();

  if (AppState.allDecks.length === 0) {
    grid.innerHTML = `
      <div class="empty-placeholder" style="grid-column: 1 / -1;">
        <div class="empty-icon">🗂️</div>
        <h3>Chưa có bộ thẻ nào</h3>
        <p>Bấm vào "Tạo bộ thẻ mới" để bắt đầu phân loại từ vựng học tập.</p>
      </div>
    `;
    return;
  }

  AppState.allDecks.forEach(deck => {
    const deckCards = AppState.allCards.filter(c => c.deckId === deck.id);
    const dueCount = deckCards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now).length;

    const el = document.createElement('div');
    el.className = 'deck-card';
    el.style.setProperty('--deck-color', deck.color || '#0284c7');
    el.innerHTML = `
      <div class="deck-card-top">
        <div>
          <div class="deck-name">${escapeHtml(deck.name)}</div>
          <div class="deck-desc">${escapeHtml(deck.description || 'Chưa có mô tả')}</div>
        </div>
      </div>
      <div class="deck-stats-row">
        <span><b>${deckCards.length}</b> thẻ</span>
        ${dueCount > 0 ? `<span class="deck-due-badge">${dueCount} cần ôn</span>` : ''}
      </div>
      <div class="deck-card-actions">
        <button class="btn btn-primary btn-sm btn-deck-review" style="flex: 1;">🃏 Ôn tập</button>
        <button class="btn btn-secondary btn-sm btn-deck-open">Xem chi tiết</button>
        <button class="btn btn-secondary btn-sm btn-deck-edit" title="Sửa tên & màu bộ thẻ">✏️</button>
        <button class="btn btn-danger btn-sm btn-deck-delete" title="Xóa bộ thẻ">🗑️</button>
      </div>
    `;

    el.querySelector('.btn-deck-review').onclick = (e) => {
      e.stopPropagation();
      startReviewMode(deck.id);
    };
    el.querySelector('.btn-deck-open').onclick = (e) => {
      e.stopPropagation();
      openDeckDetail(deck.id);
    };
    el.querySelector('.btn-deck-edit').onclick = (e) => {
      e.stopPropagation();
      openDeckModal(deck);
    };
    el.querySelector('.btn-deck-delete').onclick = (e) => {
      e.stopPropagation();
      handleDeleteDeck(deck.id, deck.name, deckCards.length);
    };
    el.onclick = () => openDeckDetail(deck.id);

    grid.appendChild(el);
  });
}

/**
 * Mở View Chi tiết bộ thẻ (Khắc phục hoàn toàn lỗi trang trắng)
 */
function openDeckDetail(deckId) {
  AppState.currentDeckId = deckId;
  AppState.activeDeck = AppState.allDecks.find(d => d.id === deckId);
  
  if (!AppState.activeDeck) {
    console.warn('[Workspace] Không tìm thấy deckId:', deckId);
    switchView('decks');
    return;
  }

  const nameEl = document.getElementById('detail-deck-name');
  const descEl = document.getElementById('detail-deck-desc');
  if (nameEl) nameEl.innerText = AppState.activeDeck.name;
  if (descEl) descEl.innerText = AppState.activeDeck.description || 'Chưa có mô tả';

  // Điều hướng đúng tên view
  switchView('deck-detail');
  renderDeckCardsTable();
}

function renderDeckCardsTable() {
  const tbody = document.getElementById('deck-cards-tbody');
  const countLabel = document.getElementById('detail-cards-count-label');
  const searchInput = document.getElementById('deck-card-search');
  const filterSelect = document.getElementById('deck-card-filter');
  if (!tbody || !AppState.currentDeckId) return;

  const now = Date.now();
  let cards = AppState.allCards.filter(c => c.deckId === AppState.currentDeckId);

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterMode = filterSelect ? filterSelect.value : 'all';

  if (searchTerm) {
    cards = cards.filter(c => 
      (c.word && c.word.toLowerCase().includes(searchTerm)) ||
      (c.reading && c.reading.toLowerCase().includes(searchTerm)) ||
      (c.meaning && c.meaning.toLowerCase().includes(searchTerm)) ||
      (c.hanviet && c.hanviet.toLowerCase().includes(searchTerm))
    );
  }

  if (filterMode === 'due') {
    cards = cards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);
  } else if (filterMode === 'starred') {
    cards = cards.filter(c => !!c.isStarred);
  } else if (filterMode === 'new') {
    cards = cards.filter(c => !c.srs || c.srs.state === 'new');
  }

  if (countLabel) countLabel.innerText = `${cards.length} thẻ`;

  tbody.innerHTML = '';
  if (cards.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
          Chưa có thẻ nào trong bộ này. Bấm vào "Thêm thẻ mới" để bắt đầu!
        </td>
      </tr>
    `;
    return;
  }

  cards.forEach(card => {
    const isDue = !card.srs || !card.srs.dueDate || card.srs.dueDate <= now;
    const dueText = card.srs && card.srs.dueDate 
      ? new Date(card.srs.dueDate).toLocaleDateString('vi-VN') 
      : 'Hôm nay';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">
        <button class="footer-btn btn-star-card" style="padding: 2px; font-size: 16px; color: ${card.isStarred ? '#fbbf24' : 'var(--text-muted)'};">
          ${card.isStarred ? '★' : '☆'}
        </button>
      </td>
      <td class="cell-kanji">${escapeHtml(card.word)}</td>
      <td class="cell-reading">${escapeHtml(card.reading || '')}</td>
      <td style="color: var(--accent-amber); font-weight: 600;">${escapeHtml(card.hanviet || '')}</td>
      <td>${escapeHtml(card.meaning || card.meaningVi || '')}</td>
      <td>
        <span class="${isDue ? 'deck-due-badge' : 'badge-pos'}">${dueText}</span>
      </td>
      <td style="text-align: center;">
        <button class="footer-btn btn-card-audio" title="Phát âm" style="display: inline-flex;">🔊</button>
        <button class="footer-btn btn-card-edit" title="Sửa thẻ" style="display: inline-flex;">✏️</button>
        <button class="footer-btn btn-card-delete" title="Xóa thẻ" style="display: inline-flex; color: #e11d48;">🗑️</button>
      </td>
    `;

    tr.querySelector('.btn-star-card').onclick = async () => {
      await toggleStarCard(card.id);
      await reloadAllData(true);
    };
    tr.querySelector('.btn-card-audio').onclick = () => playPronunciation(card.word);
    tr.querySelector('.btn-card-edit').onclick = () => openEditCardModal(card);
    tr.querySelector('.btn-card-delete').onclick = async () => {
      if (confirm(`Bạn có chắc chắn muốn xóa thẻ "${card.word}"?`)) {
        await deleteCard(card.id);
        await reloadAllData(true);
      }
    };

    tbody.appendChild(tr);
  });
}

/**
 * Xử lý Xóa bộ thẻ an toàn (Không xóa nhầm deck mặc định, xác nhận có tên deck)
 */
async function handleDeleteDeck(deckId, deckName, cardCount) {
  if (deckId === 'deck_default' || deckName === 'Mặc định' || deckName === 'Bộ thẻ Mặc định') {
    alert('Không thể xóa bộ thẻ Mặc định của hệ thống! Bạn có thể chỉnh sửa tên hoặc xóa từng thẻ bên trong.');
    return;
  }

  const confirmed = confirm(`Bạn có chắc chắn muốn xóa bộ thẻ "${deckName}" cùng toàn bộ ${cardCount} thẻ bên trong?\n\nThao tác này không thể hoàn tác!`);
  if (!confirmed) return;

  if (typeof deleteDeck === 'function') {
    await deleteDeck(deckId);
    if (AppState.currentDeckId === deckId) {
      AppState.currentDeckId = null;
      AppState.activeDeck = null;
      switchView('decks');
    }
    await reloadAllData(true);
  }
}

// ========================================================
// 6. VIEW: TRUNG TÂM ÔN TẬP SRS (SRS REVIEW HUB)
// ========================================================
function renderSrsHubView() {
  const tbody = document.getElementById('srs-due-cards-tbody');
  const countHeading = document.getElementById('srs-due-count-heading');
  const countLabel = document.getElementById('srs-table-count-label');
  const emptyState = document.getElementById('srs-empty-placeholder');
  const tableWrapper = tbody ? tbody.closest('.cards-table-wrapper') : null;
  if (!tbody) return;

  const now = Date.now();
  const dueCards = AppState.allCards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);

  if (countHeading) {
    countHeading.innerText = dueCards.length > 0
      ? `Hôm nay bạn có ${dueCards.length} thẻ đến hạn ôn tập! 🧠`
      : 'Tất cả thẻ đã được hoàn thành hôm nay! 🎉';
  }

  if (countLabel) countLabel.innerText = `${dueCards.length} thẻ`;

  if (dueCards.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    if (tableWrapper) tableWrapper.style.display = 'block';

    tbody.innerHTML = '';
    dueCards.forEach((card, idx) => {
      const targetDeck = AppState.allDecks.find(d => d.id === card.deckId);
      const deckName = targetDeck ? targetDeck.name : 'Mặc định';
      const intervalDays = card.srs ? card.srs.interval : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td class="cell-kanji">${escapeHtml(card.word)}</td>
        <td class="cell-reading">${escapeHtml(card.reading || '')}</td>
        <td style="color: var(--accent-amber); font-weight: 600;">${escapeHtml(card.hanviet || '')}</td>
        <td>${escapeHtml(card.meaning || card.meaningVi || '')}</td>
        <td><span class="badge-pos">${escapeHtml(deckName)}</span></td>
        <td><span class="deck-due-badge">${intervalDays > 0 ? `${intervalDays} ngày` : 'Thẻ mới'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Gán sự kiện các nút ôn tập trong Hub
  const btnStartDue = document.getElementById('btn-srs-start-due');
  const btnReviewAll = document.getElementById('btn-srs-review-all');
  const btnReviewStarred = document.getElementById('btn-srs-review-starred');

  if (btnStartDue) {
    btnStartDue.onclick = () => {
      if (dueCards.length === 0) {
        alert('Không có thẻ nào đến hạn hôm nay! Bạn có thể chọn "Ôn tập tất cả thẻ" để củng cố kiến thức.');
        return;
      }
      startReviewModeWithCustomQueue(dueCards, 'Thẻ đến hạn hôm nay (SRS)');
    };
  }

  if (btnReviewAll) {
    btnReviewAll.onclick = () => {
      if (AppState.allCards.length === 0) {
        alert('Chưa có thẻ nào trong hệ thống để ôn tập!');
        return;
      }
      startReviewModeWithCustomQueue(AppState.allCards, 'Tất cả thẻ từ vựng');
    };
  }

  if (btnReviewStarred) {
    btnReviewStarred.onclick = () => {
      const starred = AppState.allCards.filter(c => !!c.isStarred);
      if (starred.length === 0) {
        alert('Chưa có thẻ nào được đánh dấu sao (★). Hãy bấm vào ngôi sao của thẻ khó để lưu vào đây!');
        return;
      }
      startReviewModeWithCustomQueue(starred, 'Thẻ khó / Đã gắn sao (⭐)');
    };
  }
}

// ========================================================
// 7. ÔN TẬP FLASHCARD SRS (REVIEW MODE - CHUẨN MẶT TRƯỚC CHỈ CÓ TỪ VỰNG)
// ========================================================
function startReviewMode(deckId = null) {
  let cards = [];
  const now = Date.now();

  if (deckId) {
    cards = AppState.allCards.filter(c => c.deckId === deckId);
    const targetDeck = AppState.allDecks.find(d => d.id === deckId);
    AppState.reviewDeckTitle = targetDeck ? targetDeck.name : 'Bộ thẻ học tập';
  } else {
    cards = AppState.allCards;
    AppState.reviewDeckTitle = 'Tất cả thẻ đến hạn';
  }

  // Ưu tiên thẻ đến hạn (Due), nếu không có thì lấy tất cả thẻ trong bộ
  let queue = cards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);
  if (queue.length === 0) {
    queue = cards;
  }

  if (queue.length === 0) {
    alert('Bộ thẻ hiện đang trống! Hãy thêm thẻ từ vựng vào trước khi ôn tập.');
    return;
  }

  startReviewModeWithCustomQueue(queue, AppState.reviewDeckTitle);
}

// ========================================================
// 7. ÔN TẬP FLASHCARD QUIZLET-STYLE (THEME #2F3B5B)
// ========================================================

function startReviewModeWithCustomQueue(cardList, title = 'Phiên ôn tập') {
  AppState.reviewOriginalQueue = [...cardList];
  AppState.reviewQueue = [...cardList];
  AppState.reviewCurrentIndex = 0;
  AppState.reviewFlipped = false;
  AppState.reviewDeckTitle = title;
  AppState.reviewHistory = [];
  AppState.reviewKnownCount = 0;
  AppState.reviewUnknownCards = [];
  AppState.reviewDirection = AppState.reviewDirection || 'jp-vi';
  AppState.reviewAutoplay = false;
  if (AppState.reviewAutoplayTimer) {
    clearInterval(AppState.reviewAutoplayTimer);
    AppState.reviewAutoplayTimer = null;
  }

  const modal = document.getElementById('review-modal');
  if (modal) modal.style.display = 'flex';

  const titleEl = document.getElementById('review-deck-title-display');
  if (titleEl) titleEl.innerText = AppState.reviewDeckTitle;

  const cardBox = document.getElementById('review-card-box');
  const compScreen = document.getElementById('review-complete-screen');
  const ratingBar = document.getElementById('review-rating-bar');
  const popover = document.getElementById('modal-review-settings');

  if (cardBox) cardBox.style.display = 'block';
  if (compScreen) compScreen.style.display = 'none';
  if (ratingBar) ratingBar.style.display = 'flex';
  if (popover) popover.style.display = 'none';

  // Đồng bộ nhãn hướng học
  const dirLabel = document.getElementById('label-study-direction');
  if (dirLabel) dirLabel.innerText = AppState.reviewDirection === 'jp-vi' ? 'JP→VI' : 'VI→JP';

  // Reset nút autoplay
  const btnAuto = document.getElementById('btn-review-autoplay');
  if (btnAuto) {
    btnAuto.innerText = '▷';
    btnAuto.classList.remove('active');
  }

  renderCurrentReviewCard();
}

function renderCurrentReviewCard() {
  if (AppState.reviewCurrentIndex >= AppState.reviewQueue.length) {
    showReviewCompleteScreen();
    return;
  }

  const card = AppState.reviewQueue[AppState.reviewCurrentIndex];
  AppState.reviewFlipped = false;

  // Cập nhật bộ đếm
  const counterText = document.getElementById('review-counter-text');
  const total = AppState.reviewQueue.length;
  const current = AppState.reviewCurrentIndex + 1;
  if (counterText) counterText.innerText = `${current} / ${total}`;

  // Trạng thái nút điều hướng trái/phải
  const btnPrev = document.getElementById('btn-prev-card');
  const btnNext = document.getElementById('btn-next-card');
  if (btnPrev) btnPrev.disabled = AppState.reviewCurrentIndex === 0;
  if (btnNext) btnNext.disabled = AppState.reviewCurrentIndex >= total - 1;

  // Reset hiệu ứng lật thẻ
  const cardBox = document.getElementById('review-card-box');
  if (cardBox) cardBox.classList.remove('flipped');

  // Cập nhật trạng thái Star (Đồng bộ với savedWords & card.isStarred)
  const starBtn = document.getElementById('btn-card-star-toggle');
  if (starBtn) {
    if (card.isStarred) {
      starBtn.innerText = '★';
      starBtn.classList.add('starred');
    } else {
      starBtn.innerText = '☆';
      starBtn.classList.remove('starred');
    }
  }

  const frontWord = document.getElementById('card-front-word');
  const backWord = document.getElementById('card-back-word');
  const backReading = document.getElementById('card-back-reading');
  const backHanviet = document.getElementById('card-back-hanviet');
  const backMeaning = document.getElementById('card-back-meaning');
  const exampleBox = document.getElementById('card-back-example-box');
  const exampleJp = document.getElementById('card-back-example-jp');
  const exampleVi = document.getElementById('card-back-example-vi');
  const notesBox = document.getElementById('card-back-notes-box');
  const notesEl = document.getElementById('card-back-notes');

  // HIỂN THỊ THEO CHIỀU HỌC: JP -> VI HOẶC VI -> JP
  if (AppState.reviewDirection === 'vi-jp') {
    // Mặt trước: Nghĩa tiếng Việt
    if (frontWord) frontWord.innerText = card.meaning || card.meaningVi || 'Chưa rõ nghĩa';
  } else {
    // Mặt trước: Từ vựng tiếng Nhật (Mặc định)
    if (frontWord) frontWord.innerText = card.word;
  }

  // MẶT SAU: Hiển thị đầy đủ thông tin chuẩn Quizlet
  if (backWord) backWord.innerText = card.word;
  if (backReading) backReading.innerText = card.reading || '';
  if (backHanviet) {
    backHanviet.innerText = card.hanviet ? card.hanviet.toUpperCase() : '';
    backHanviet.style.display = card.hanviet ? 'inline-block' : 'none';
  }
  if (backMeaning) backMeaning.innerText = card.meaning || card.meaningVi || 'Chưa rõ nghĩa';

  if (exampleBox) {
    if (card.example && card.example.trim()) {
      exampleBox.style.display = 'block';
      if (exampleJp) exampleJp.innerText = card.example;
      if (exampleVi) exampleVi.innerText = card.exampleMeaning || '';
    } else {
      exampleBox.style.display = 'none';
    }
  }

  if (notesBox) {
    if (card.notes && card.notes.trim()) {
      notesBox.style.display = 'block';
      if (notesEl) notesEl.innerText = `Ghi chú: ${card.notes}`;
    } else {
      notesBox.style.display = 'none';
    }
  }

  // Tự động phát âm thanh nếu đã bật Auto-TTS
  if (AppState.reviewAutoTts) {
    playPronunciation(card.word);
  }
}

function flipReviewCard() {
  const cardBox = document.getElementById('review-card-box');
  if (!cardBox) return;

  AppState.reviewFlipped = !AppState.reviewFlipped;
  if (AppState.reviewFlipped) {
    cardBox.classList.add('flipped');
  } else {
    cardBox.classList.remove('flipped');
  }
}

function navigateReviewCard(delta) {
  const nextIdx = AppState.reviewCurrentIndex + delta;
  if (nextIdx >= 0 && nextIdx < AppState.reviewQueue.length) {
    AppState.reviewCurrentIndex = nextIdx;
    renderCurrentReviewCard();
  }
}

async function handleQuizletRate(isKnown) {
  if (AppState.reviewIsDebouncing) return;
  if (AppState.reviewCurrentIndex >= AppState.reviewQueue.length) return;

  AppState.reviewIsDebouncing = true;
  setTimeout(() => { AppState.reviewIsDebouncing = false; }, 180);

  const card = AppState.reviewQueue[AppState.reviewCurrentIndex];

  // Lưu lịch sử phục vụ Undo
  AppState.reviewHistory.push({
    index: AppState.reviewCurrentIndex,
    cardId: card.id,
    cardObj: { ...card },
    isKnown: isKnown,
    prevSrs: card.srs ? { ...card.srs } : null
  });

  if (isKnown) {
    AppState.reviewKnownCount++;
    // Đánh giá SRS Good (3)
    if (typeof rateCardSrs === 'function' && card.id && !card.id.startsWith('practice_')) {
      await rateCardSrs(card.id, 3);
    }
    // Gỡ khỏi danh sách chưa thuộc nếu trước đó đã đánh dấu
    AppState.reviewUnknownCards = AppState.reviewUnknownCards.filter(c => c.id !== card.id);
  } else {
    // Đánh giá SRS Again (1)
    if (typeof rateCardSrs === 'function' && card.id && !card.id.startsWith('practice_')) {
      await rateCardSrs(card.id, 1);
    }
    // Thêm vào danh sách cần ôn lại nếu chưa có
    if (!AppState.reviewUnknownCards.some(c => c.id === card.id)) {
      AppState.reviewUnknownCards.push(card);
    }
  }

  // Chuyển sang thẻ tiếp theo
  AppState.reviewCurrentIndex++;
  renderCurrentReviewCard();
}

async function handleQuizletUndo() {
  if (!AppState.reviewHistory || AppState.reviewHistory.length === 0) {
    return;
  }

  const lastAction = AppState.reviewHistory.pop();
  AppState.reviewCurrentIndex = lastAction.index;

  if (lastAction.isKnown) {
    AppState.reviewKnownCount = Math.max(0, AppState.reviewKnownCount - 1);
  } else {
    AppState.reviewUnknownCards = AppState.reviewUnknownCards.filter(c => c.id !== lastAction.cardId);
  }

  // Khôi phục lại trạng thái SRS trước đó
  const targetCard = AppState.allCards.find(c => c.id === lastAction.cardId);
  if (targetCard && lastAction.prevSrs) {
    targetCard.srs = lastAction.prevSrs;
    if (typeof saveAllCards === 'function') {
      await saveAllCards(AppState.allCards);
    }
  }

  // Khôi phục hiển thị sân khấu nếu đang ở màn hình kết thúc
  const cardBox = document.getElementById('review-card-box');
  const compScreen = document.getElementById('review-complete-screen');
  const ratingBar = document.getElementById('review-rating-bar');
  if (cardBox) cardBox.style.display = 'block';
  if (compScreen) compScreen.style.display = 'none';
  if (ratingBar) ratingBar.style.display = 'flex';

  renderCurrentReviewCard();
}

function toggleStudyDirection() {
  AppState.reviewDirection = AppState.reviewDirection === 'jp-vi' ? 'vi-jp' : 'jp-vi';
  const dirLabel = document.getElementById('label-study-direction');
  if (dirLabel) dirLabel.innerText = AppState.reviewDirection === 'jp-vi' ? 'JP→VI' : 'VI→JP';

  const settingSelect = document.getElementById('setting-study-direction');
  if (settingSelect) settingSelect.value = AppState.reviewDirection;

  renderCurrentReviewCard();
}

function handleQuizletShuffle() {
  const remaining = AppState.reviewQueue.slice(AppState.reviewCurrentIndex);
  const shuffled = shuffleArray(remaining);
  AppState.reviewQueue = [...AppState.reviewQueue.slice(0, AppState.reviewCurrentIndex), ...shuffled];
  renderCurrentReviewCard();
}

function toggleQuizletAutoplay() {
  AppState.reviewAutoplay = !AppState.reviewAutoplay;
  const btnAuto = document.getElementById('btn-review-autoplay');

  if (AppState.reviewAutoplay) {
    if (btnAuto) {
      btnAuto.innerText = '⏸';
      btnAuto.classList.add('active');
    }

    const intervalMs = AppState.reviewAutoplayDelay || 4000;
    if (AppState.reviewAutoplayTimer) clearInterval(AppState.reviewAutoplayTimer);

    AppState.reviewAutoplayTimer = setInterval(() => {
      if (AppState.reviewCurrentIndex >= AppState.reviewQueue.length) {
        toggleQuizletAutoplay();
        return;
      }

      if (!AppState.reviewFlipped) {
        flipReviewCard();
      } else {
        handleQuizletRate(true);
      }
    }, intervalMs / 2);
  } else {
    if (btnAuto) {
      btnAuto.innerText = '▷';
      btnAuto.classList.remove('active');
    }
    if (AppState.reviewAutoplayTimer) {
      clearInterval(AppState.reviewAutoplayTimer);
      AppState.reviewAutoplayTimer = null;
    }
  }
}

async function handleQuizletStarToggle() {
  if (AppState.reviewCurrentIndex >= AppState.reviewQueue.length) return;
  const card = AppState.reviewQueue[AppState.reviewCurrentIndex];
  if (!card) return;

  const starBtn = document.getElementById('btn-card-star-toggle');
  if (typeof toggleStarCard === 'function' && card.id && !card.id.startsWith('practice_')) {
    const isNowStarred = await toggleStarCard(card.id);
    card.isStarred = isNowStarred;
    if (starBtn) {
      starBtn.innerText = isNowStarred ? '★' : '☆';
      if (isNowStarred) starBtn.classList.add('starred');
      else starBtn.classList.remove('starred');
    }
  } else {
    card.isStarred = !card.isStarred;
    if (starBtn) {
      starBtn.innerText = card.isStarred ? '★' : '☆';
      if (card.isStarred) starBtn.classList.add('starred');
      else starBtn.classList.remove('starred');
    }
  }

  // Cập nhật số lượng trên sidebar nếu có
  updateSidebarCounts();
}

function showReviewCompleteScreen() {
  if (AppState.reviewAutoplayTimer) {
    clearInterval(AppState.reviewAutoplayTimer);
    AppState.reviewAutoplayTimer = null;
    AppState.reviewAutoplay = false;
    const btnAuto = document.getElementById('btn-review-autoplay');
    if (btnAuto) {
      btnAuto.innerText = '▷';
      btnAuto.classList.remove('active');
    }
  }

  const cardBox = document.getElementById('review-card-box');
  const compScreen = document.getElementById('review-complete-screen');
  const ratingBar = document.getElementById('review-rating-bar');

  if (cardBox) cardBox.style.display = 'none';
  if (ratingBar) ratingBar.style.display = 'none';
  if (compScreen) compScreen.style.display = 'block';

  const total = AppState.reviewQueue.length;
  const known = AppState.reviewKnownCount;
  const unknown = AppState.reviewUnknownCards.length;
  const accuracy = total > 0 ? Math.round((known / total) * 100) : 100;

  const knownEl = document.getElementById('complete-known-count');
  const unknownEl = document.getElementById('complete-unknown-count');
  const rateEl = document.getElementById('complete-accuracy-rate');
  const btnRetryUnknown = document.getElementById('btn-review-retry-unknown');

  if (knownEl) knownEl.innerText = known;
  if (unknownEl) unknownEl.innerText = unknown;
  if (rateEl) rateEl.innerText = `${accuracy}%`;

  if (btnRetryUnknown) {
    if (unknown > 0) {
      btnRetryUnknown.style.display = 'inline-block';
      btnRetryUnknown.innerText = `🔄 Ôn lại ${unknown} thẻ chưa thuộc`;
    } else {
      btnRetryUnknown.style.display = 'none';
    }
  }

  // Ghi nhật ký ôn tập
  if (typeof recordReviewHistory === 'function') {
    recordReviewHistory({
      deckTitle: AppState.reviewDeckTitle,
      cardsCount: total,
      accuracy: accuracy,
      timestamp: Date.now()
    }).catch(() => {});
  }

  reloadAllData(false);
}

function setupReviewShortcuts() {
  const cardBox = document.getElementById('review-card-box');
  if (cardBox) cardBox.addEventListener('click', flipReviewCard);

  // Mũi tên chuyển thẻ
  const btnPrev = document.getElementById('btn-prev-card');
  const btnNext = document.getElementById('btn-next-card');
  if (btnPrev) btnPrev.addEventListener('click', () => navigateReviewCard(-1));
  if (btnNext) btnNext.addEventListener('click', () => navigateReviewCard(1));

  // Nút Chưa biết (✕ - đỏ) và Đã biết (✓ - xanh)
  const btnRateUnknown = document.getElementById('btn-rate-unknown');
  const btnRateKnown = document.getElementById('btn-rate-known');
  if (btnRateUnknown) btnRateUnknown.addEventListener('click', () => handleQuizletRate(false));
  if (btnRateKnown) btnRateKnown.addEventListener('click', () => handleQuizletRate(true));

  // Nút Đổi chiều học
  const btnDir = document.getElementById('btn-toggle-direction');
  if (btnDir) btnDir.addEventListener('click', toggleStudyDirection);

  // Nút Hoàn tác (Undo)
  const btnUndo = document.getElementById('btn-review-undo');
  if (btnUndo) btnUndo.addEventListener('click', handleQuizletUndo);

  // Nút Autoplay
  const btnAutoplay = document.getElementById('btn-review-autoplay');
  if (btnAutoplay) btnAutoplay.addEventListener('click', toggleQuizletAutoplay);

  // Nút Xáo trộn (Shuffle)
  const btnShuffle = document.getElementById('btn-review-shuffle');
  if (btnShuffle) btnShuffle.addEventListener('click', handleQuizletShuffle);

  // Nút Cài đặt phiên học (⚙)
  const btnSettings = document.getElementById('btn-review-settings');
  const popover = document.getElementById('modal-review-settings');
  const btnCloseSettings = document.getElementById('btn-close-review-settings');
  const btnSaveSettings = document.getElementById('btn-save-review-settings');

  if (btnSettings && popover) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (btnCloseSettings && popover) {
    btnCloseSettings.addEventListener('click', () => { popover.style.display = 'none'; });
  }

  if (btnSaveSettings && popover) {
    btnSaveSettings.addEventListener('click', () => {
      const dirVal = document.getElementById('setting-study-direction').value;
      if (dirVal !== AppState.reviewDirection) {
        AppState.reviewDirection = dirVal;
        const dirLabel = document.getElementById('label-study-direction');
        if (dirLabel) dirLabel.innerText = dirVal === 'jp-vi' ? 'JP→VI' : 'VI→JP';
        renderCurrentReviewCard();
      }

      const isShuffle = document.getElementById('setting-shuffle').checked;
      if (isShuffle) handleQuizletShuffle();

      AppState.reviewAutoTts = document.getElementById('setting-auto-tts').checked;
      const isAuto = document.getElementById('setting-autoplay').checked;
      const delay = parseInt(document.getElementById('setting-autoplay-delay').value, 10) * 1000;
      AppState.reviewAutoplayDelay = delay;

      if (isAuto && !AppState.reviewAutoplay) {
        toggleQuizletAutoplay();
      } else if (!isAuto && AppState.reviewAutoplay) {
        toggleQuizletAutoplay();
      }

      popover.style.display = 'none';
    });
  }

  // Slider delay
  const delaySlider = document.getElementById('setting-autoplay-delay');
  const delayLabel = document.getElementById('label-autoplay-delay');
  if (delaySlider && delayLabel) {
    delaySlider.addEventListener('input', () => {
      delayLabel.innerText = `${delaySlider.value}s`;
    });
  }

  // Đóng popover khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (popover && popover.style.display === 'block') {
      if (!popover.contains(e.target) && e.target !== btnSettings) {
        popover.style.display = 'none';
      }
    }
  });

  // Nút Thoát & Quay lại
  const btnExit = document.getElementById('btn-exit-review');
  const btnFinish = document.getElementById('btn-finish-review-session');
  const closeReview = () => {
    if (AppState.reviewAutoplayTimer) {
      clearInterval(AppState.reviewAutoplayTimer);
      AppState.reviewAutoplayTimer = null;
      AppState.reviewAutoplay = false;
    }
    const modal = document.getElementById('review-modal');
    if (modal) modal.style.display = 'none';
    reloadAllData(true);
  };
  if (btnExit) btnExit.addEventListener('click', closeReview);
  if (btnFinish) btnFinish.addEventListener('click', closeReview);

  // Màn hình kết thúc: Ôn lại thẻ chưa thuộc & Học lại từ đầu
  const btnRetryUnknown = document.getElementById('btn-review-retry-unknown');
  if (btnRetryUnknown) {
    btnRetryUnknown.addEventListener('click', () => {
      if (AppState.reviewUnknownCards.length > 0) {
        startReviewModeWithCustomQueue([...AppState.reviewUnknownCards], `${AppState.reviewDeckTitle} (Ôn lại chưa thuộc)`);
      }
    });
  }

  const btnRestart = document.getElementById('btn-review-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (AppState.reviewOriginalQueue && AppState.reviewOriginalQueue.length > 0) {
        startReviewModeWithCustomQueue([...AppState.reviewOriginalQueue], AppState.reviewDeckTitle);
      }
    });
  }

  // Audio TTS Buttons
  const audioFront = document.getElementById('btn-card-audio-front');
  const audioBack = document.getElementById('btn-card-audio-back');
  const playCurrentAudio = (e) => {
    e.stopPropagation();
    const card = AppState.reviewQueue[AppState.reviewCurrentIndex];
    if (card) playPronunciation(card.word);
  };
  if (audioFront) audioFront.addEventListener('click', playCurrentAudio);
  if (audioBack) audioBack.addEventListener('click', playCurrentAudio);

  // Toggle Star Button
  const starBtn = document.getElementById('btn-card-star-toggle');
  if (starBtn) {
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleQuizletStarToggle();
    });
  }

  // Phím tắt bàn phím toàn diện (Space, Z, X, C, R, ArrowLeft, ArrowRight, Esc)
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('review-modal');
    if (!modal || modal.style.display === 'none') return;

    // Không bắt sự kiện khi người dùng đang nhập text
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      flipReviewCard();
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      handleQuizletRate(false); // Chưa biết (✕)
    } else if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      handleQuizletRate(true);  // Đã biết (✓)
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const card = AppState.reviewQueue[AppState.reviewCurrentIndex];
      if (card) playPronunciation(card.word);
    } else if (e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      handleQuizletStarToggle();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateReviewCard(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateReviewCard(1);
    } else if (e.key === 'Escape') {
      if (popover && popover.style.display === 'block') {
        popover.style.display = 'none';
      } else {
        closeReview();
      }
    }
  });
}

// ========================================================
// 8. VIEW: TRẮC NGHIỆM (QUIZ / TEST)
// ========================================================
function setupQuizView() {
  const deckSelect = document.getElementById('quiz-deck-select');
  const btnStart = document.getElementById('btn-start-quiz');
  if (!deckSelect) return;

  deckSelect.innerHTML = '';

  // Thêm tùy chọn Tất cả bộ thẻ
  const optAll = document.createElement('option');
  optAll.value = '__all__';
  optAll.innerText = `Tất cả bộ thẻ (${AppState.allCards.length} từ vựng)`;
  deckSelect.appendChild(optAll);

  // Thêm từng bộ thẻ
  AppState.allDecks.forEach(deck => {
    const count = AppState.allCards.filter(c => c.deckId === deck.id).length;
    const opt = document.createElement('option');
    opt.value = deck.id;
    opt.innerText = `${deck.name} (${count} từ)`;
    deckSelect.appendChild(opt);
  });

  if (btnStart) {
    btnStart.onclick = () => {
      const selectedId = deckSelect.value;
      startQuizSession(selectedId);
    };
  }
}

function startQuizSession(selectedScope) {
  let targetCards = [];
  if (selectedScope === '__all__') {
    targetCards = AppState.allCards;
  } else {
    targetCards = AppState.allCards.filter(c => c.deckId === selectedScope);
  }

  // Yêu cầu tối thiểu 4 từ vựng trong hệ thống để tạo 4 phương án trắc nghiệm không trùng
  if (AppState.allCards.length < 4) {
    alert(`Hệ thống cần tối thiểu 4 từ vựng để tạo bài kiểm tra 4 phương án lựa chọn (Hiện tại bạn có ${AppState.allCards.length} từ). Hãy lưu thêm từ vựng để bắt đầu!`);
    return;
  }

  if (targetCards.length === 0) {
    alert('Bộ thẻ đã chọn chưa có từ vựng nào!');
    return;
  }

  const container = document.getElementById('quiz-container');
  const placeholder = document.getElementById('quiz-placeholder');
  if (container) container.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';

  let currentQ = 0;
  let score = 0;
  const questions = shuffleArray([...targetCards]).slice(0, 10);

  const renderQuestion = () => {
    if (currentQ >= questions.length) {
      container.innerHTML = `
        <div class="dict-card" style="text-align: center; padding: 40px;">
          <div style="font-size: 54px; margin-bottom: 12px;">🏆</div>
          <h2>Hoàn thành bài kiểm tra!</h2>
          <p style="font-size: 18px; margin: 12px 0;">Điểm số của bạn: <b>${score} / ${questions.length}</b></p>
          <button class="btn btn-primary" id="btn-quiz-retry">Làm lại bài kiểm tra</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-quiz-retry');
      if (retryBtn) {
        retryBtn.onclick = () => {
          setupQuizView();
          container.style.display = 'none';
          placeholder.style.display = 'block';
        };
      }
      return;
    }

    const target = questions[currentQ];
    document.getElementById('quiz-progress-label').innerText = `Câu ${currentQ + 1} / ${questions.length}`;
    document.getElementById('quiz-score-label').innerText = `Điểm: ${score}`;
    document.getElementById('quiz-question-word').innerText = target.word;
    document.getElementById('quiz-question-reading').innerText = target.reading || '';

    // Lấy 3 phương án gây nhiễu từ các thẻ khác (không trùng với thẻ đích)
    const otherCards = AppState.allCards.filter(c => c.word !== target.word && (c.meaning || c.meaningVi));
    const wrongOptions = shuffleArray(otherCards).slice(0, 3);
    const choices = shuffleArray([target, ...wrongOptions]);

    const optionsGrid = document.getElementById('quiz-options-grid');
    optionsGrid.innerHTML = '';

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'padding: 14px 18px; text-align: left; justify-content: flex-start; font-size: 14px;';
      btn.innerText = choice.meaning || choice.meaningVi || 'Ý nghĩa từ vựng';

      btn.onclick = () => {
        // Vô hiệu hóa các nút khác
        optionsGrid.querySelectorAll('button').forEach(b => b.disabled = true);

        if (choice.word === target.word) {
          btn.style.background = '#059669';
          btn.style.color = '#fff';
          score++;
        } else {
          btn.style.background = '#e11d48';
          btn.style.color = '#fff';
          // Đánh dấu nút đúng màu xanh
          optionsGrid.querySelectorAll('button').forEach(b => {
            if (b.innerText === (target.meaning || target.meaningVi)) {
              b.style.background = '#059669';
              b.style.color = '#fff';
            }
          });
        }

        setTimeout(() => {
          currentQ++;
          renderQuestion();
        }, 700);
      };

      optionsGrid.appendChild(btn);
    });
  };

  renderQuestion();
}

// ========================================================
// 9. VIEW: THỐNG KÊ (STATS)
// ========================================================
async function renderStatsView() {
  const streakEl = document.getElementById('stats-streak-days');
  const masteredEl = document.getElementById('stats-mastered-cards');
  const learningEl = document.getElementById('stats-learning-cards');
  const starredEl = document.getElementById('stats-starred-cards');
  const historyList = document.getElementById('stats-history-list');

  const mastered = AppState.allCards.filter(c => c.srs && c.srs.interval >= 7).length;
  const learning = AppState.allCards.filter(c => c.srs && c.srs.interval > 0 && c.srs.interval < 7).length;
  const starred = AppState.allCards.filter(c => !!c.isStarred).length;

  if (masteredEl) masteredEl.innerText = mastered;
  if (learningEl) learningEl.innerText = learning;
  if (starredEl) starredEl.innerText = starred;

  if (typeof getReviewStats === 'function') {
    const stats = await getReviewStats();
    if (streakEl) streakEl.innerText = `${stats.streak || 1} ngày`;

    if (historyList && Array.isArray(stats.history) && stats.history.length > 0) {
      historyList.innerHTML = '';
      stats.history.slice(-10).reverse().forEach(item => {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13.5px;';
        row.innerHTML = `
          <span><b>${escapeHtml(item.deckTitle || 'Phiên học')}</b> (${item.cardsCount || 0} thẻ)</span>
          <span style="color: var(--text-muted);">${new Date(item.timestamp).toLocaleString('vi-VN')}</span>
        `;
        historyList.appendChild(row);
      });
    }
  }
}

// ========================================================
// 10. MODALS: TẠO/SỬA BỘ THẺ & THẺ FLASHCARD
// ========================================================
function setupGlobalActions() {
  // Modal Tạo Bộ thẻ
  const btnCreateDeck = document.getElementById('btn-create-deck-modal');
  const btnBannerNewDeck = document.getElementById('btn-banner-new-deck');
  const btnViewAllDecks = document.getElementById('btn-view-all-decks');
  const btnBannerReview = document.getElementById('btn-banner-review');
  const btnBannerGuide = document.getElementById('btn-banner-guide');
  const btnGuideJumpJlpt = document.getElementById('btn-guide-jump-jlpt');
  const btnGuideJumpReview = document.getElementById('btn-guide-jump-review');
  const btnBackToDecks = document.getElementById('btn-back-to-decks');
  const btnStartReviewThisDeck = document.getElementById('btn-start-review-this-deck');
  const btnEditThisDeck = document.getElementById('btn-edit-this-deck');
  const btnDeleteThisDeck = document.getElementById('btn-delete-this-deck');
  const btnExportThisDeck = document.getElementById('btn-export-this-deck');

  if (btnCreateDeck) btnCreateDeck.onclick = () => openDeckModal();
  if (btnBannerNewDeck) btnBannerNewDeck.onclick = () => openDeckModal();
  if (btnViewAllDecks) btnViewAllDecks.onclick = () => switchView('decks');
  if (btnBannerReview) btnBannerReview.onclick = () => startReviewMode(null);
  if (btnBannerGuide) btnBannerGuide.onclick = () => switchView('guide');
  if (btnGuideJumpJlpt) btnGuideJumpJlpt.onclick = () => switchView('jlpt');
  if (btnGuideJumpReview) btnGuideJumpReview.onclick = () => switchView('review');
  if (btnBackToDecks) btnBackToDecks.onclick = () => switchView('decks');
  if (btnStartReviewThisDeck) btnStartReviewThisDeck.onclick = () => startReviewMode(AppState.currentDeckId);

  if (btnEditThisDeck) {
    btnEditThisDeck.onclick = () => {
      if (AppState.activeDeck) openDeckModal(AppState.activeDeck);
    };
  }

  if (btnDeleteThisDeck) {
    btnDeleteThisDeck.onclick = () => {
      if (AppState.activeDeck) {
        const count = AppState.allCards.filter(c => c.deckId === AppState.activeDeck.id).length;
        handleDeleteDeck(AppState.activeDeck.id, AppState.activeDeck.name, count);
      }
    };
  }

  if (btnExportThisDeck) {
    btnExportThisDeck.onclick = async () => {
      if (AppState.activeDeck && typeof exportDecksToJson === 'function') {
        const json = await exportDecksToJson(AppState.activeDeck.id);
        const dateStr = new Date().toISOString().slice(0, 10);
        downloadFile(json, `jp-deck-${AppState.activeDeck.name}-${dateStr}.json`, 'application/json');
      }
    };
  }

  const btnImportThisDeck = document.getElementById('btn-import-this-deck');
  if (btnImportThisDeck) {
    btnImportThisDeck.onclick = () => {
      if (AppState.activeDeck && typeof openImportModalWithDeck === 'function') {
        openImportModalWithDeck(AppState.activeDeck.id);
      }
    };
  }

  // Đóng modal Deck
  const modalDeck = document.getElementById('modal-deck');
  document.getElementById('btn-close-deck-modal').onclick = () => modalDeck.style.display = 'none';
  document.getElementById('btn-cancel-deck-modal').onclick = () => modalDeck.style.display = 'none';
  document.getElementById('btn-save-deck-modal').onclick = saveDeckFromModal;

  // Modal Card
  const btnAddCard = document.getElementById('btn-add-card-to-deck');
  if (btnAddCard) btnAddCard.onclick = () => openAddCardModalWithData();

  const modalCard = document.getElementById('modal-card');
  document.getElementById('btn-close-card-modal').onclick = () => modalCard.style.display = 'none';
  document.getElementById('btn-cancel-card-modal').onclick = () => modalCard.style.display = 'none';
  document.getElementById('btn-save-card-modal').onclick = saveCardFromModal;

  // Bộ lọc thẻ trong trang chi tiết
  const deckCardSearch = document.getElementById('deck-card-search');
  const deckCardFilter = document.getElementById('deck-card-filter');
  if (deckCardSearch) deckCardSearch.addEventListener('input', () => renderDeckCardsTable());
  if (deckCardFilter) deckCardFilter.addEventListener('change', () => renderDeckCardsTable());
}

function openDeckModal(deck = null) {
  const modal = document.getElementById('modal-deck');
  const title = document.getElementById('modal-deck-title');
  const idInput = document.getElementById('deck-form-id');
  const nameInput = document.getElementById('deck-form-name');
  const descInput = document.getElementById('deck-form-desc');
  const colorInput = document.getElementById('deck-form-color');

  if (deck) {
    title.innerText = 'Chỉnh sửa bộ thẻ';
    idInput.value = deck.id;
    nameInput.value = deck.name;
    descInput.value = deck.description || '';
    colorInput.value = deck.color || '#0284c7';
  } else {
    title.innerText = 'Tạo bộ thẻ mới';
    idInput.value = '';
    nameInput.value = '';
    descInput.value = '';
    colorInput.value = '#0284c7';
  }

  modal.style.display = 'flex';
  nameInput.focus();
}

async function saveDeckFromModal() {
  const idInput = document.getElementById('deck-form-id').value;
  const name = document.getElementById('deck-form-name').value.trim();
  const desc = document.getElementById('deck-form-desc').value.trim();
  const color = document.getElementById('deck-form-color').value;

  if (!name) {
    alert('Vui lòng nhập tên bộ thẻ!');
    return;
  }

  const deckObj = {
    id: idInput || undefined,
    name: name,
    description: desc,
    color: color
  };

  await saveDeck(deckObj);
  document.getElementById('modal-deck').style.display = 'none';
  await reloadAllData(true);
}

function openAddCardModalWithData(data = {}) {
  const modal = document.getElementById('modal-card');
  document.getElementById('modal-card-title').innerText = 'Thêm thẻ từ vựng mới';
  document.getElementById('card-form-id').value = '';
  document.getElementById('card-form-deck-id').value = AppState.currentDeckId || (AppState.allDecks[0] ? AppState.allDecks[0].id : 'deck_default');
  document.getElementById('card-form-word').value = data.word || '';
  document.getElementById('card-form-reading').value = data.reading || '';
  document.getElementById('card-form-hanviet').value = data.hanviet || '';
  document.getElementById('card-form-meaning').value = data.meaning || '';
  document.getElementById('card-form-example').value = data.example || '';
  document.getElementById('card-form-exampleMeaning').value = data.exampleMeaning || '';
  document.getElementById('card-form-notes').value = data.notes || '';

  modal.style.display = 'flex';
  document.getElementById('card-form-word').focus();
}

function openEditCardModal(card) {
  const modal = document.getElementById('modal-card');
  document.getElementById('modal-card-title').innerText = 'Chỉnh sửa thẻ từ vựng';
  document.getElementById('card-form-id').value = card.id;
  document.getElementById('card-form-deck-id').value = card.deckId;
  document.getElementById('card-form-word').value = card.word;
  document.getElementById('card-form-reading').value = card.reading || '';
  document.getElementById('card-form-hanviet').value = card.hanviet || '';
  document.getElementById('card-form-meaning').value = card.meaning || card.meaningVi || '';
  document.getElementById('card-form-example').value = card.example || '';
  document.getElementById('card-form-exampleMeaning').value = card.exampleMeaning || '';
  document.getElementById('card-form-notes').value = card.notes || '';

  modal.style.display = 'flex';
}

async function saveCardFromModal() {
  const id = document.getElementById('card-form-id').value;
  const deckId = document.getElementById('card-form-deck-id').value;
  const word = document.getElementById('card-form-word').value.trim();
  const reading = document.getElementById('card-form-reading').value.trim();
  const hanviet = document.getElementById('card-form-hanviet').value.trim();
  const meaning = document.getElementById('card-form-meaning').value.trim();
  const example = document.getElementById('card-form-example').value.trim();
  const exampleMeaning = document.getElementById('card-form-exampleMeaning').value.trim();
  const notes = document.getElementById('card-form-notes').value.trim();

  if (!word || !meaning) {
    alert('Vui lòng nhập từ vựng và nghĩa tiếng Việt!');
    return;
  }

  const cardObj = {
    id: id || undefined,
    deckId: deckId,
    word: word,
    reading: reading,
    hanviet: hanviet,
    meaning: meaning,
    meaningVi: meaning,
    example: example,
    exampleMeaning: exampleMeaning,
    notes: notes
  };

  await saveCard(cardObj);
  document.getElementById('modal-card').style.display = 'none';
  await reloadAllData(true);
}

// ========================================================
// 11. MODAL: NHẬP JSON & TẠO PROMPT AI (CHUẨN 6 TRƯỜNG)
// ========================================================
function setupImportModal() {
  const modal = document.getElementById('modal-import');
  const btnTopImport = document.getElementById('btn-topbar-import');
  const btnDeckImport = document.getElementById('btn-deck-import');
  const btnSettingsImport = document.getElementById('btn-settings-import');
  const btnClose = document.getElementById('btn-close-import-modal');
  const btnCancel = document.getElementById('btn-cancel-import-modal');

  const tabBtnImport = document.getElementById('tab-btn-import-file');
  const tabBtnCreate = document.getElementById('tab-btn-create-prompt');
  const paneImport = document.getElementById('pane-import-file');
  const paneCreate = document.getElementById('pane-create-prompt');
  const btnExecute = document.getElementById('btn-execute-import');

  const fileInput = document.getElementById('import-file-input');
  const jsonTextarea = document.getElementById('import-json-textarea');
  const targetDeckSelect = document.getElementById('import-target-deck-select');
  const groupNewDeckName = document.getElementById('group-new-deck-name');
  const inputNewDeckName = document.getElementById('import-new-deck-name');
  const analysisBox = document.getElementById('import-analysis-box');
  const analysisTitle = document.getElementById('import-analysis-title');
  const analysisDesc = document.getElementById('import-analysis-desc');
  const feedback = document.getElementById('import-feedback');

  let currentAnalysis = null;

  const triggerLiveAnalysis = () => {
    const raw = jsonTextarea.value.trim();
    if (!raw) {
      if (analysisBox) analysisBox.style.display = 'none';
      if (feedback) feedback.style.display = 'none';
      currentAnalysis = null;
      return;
    }

    if (typeof analyzeImportJson === 'function') {
      const res = analyzeImportJson(raw);
      currentAnalysis = res;
      if (analysisBox) {
        analysisBox.style.display = 'block';
        if (res.valid) {
          analysisBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          analysisBox.style.background = 'rgba(16, 185, 129, 0.08)';
          if (analysisTitle) {
            analysisTitle.innerHTML = `✅ <b>Hợp lệ:</b> ${res.typeLabel}`;
            analysisTitle.style.color = '#10b981';
          }
          if (analysisDesc) {
            analysisDesc.innerHTML = `Phát hiện <b>${res.decksCount}</b> bộ thẻ (${res.deckNames.join(', ')}) và <b>${res.cardsCount}</b> thẻ từ vựng.`;
            analysisDesc.style.color = 'var(--text-primary)';
          }

          // Nếu file chứa cấu trúc bộ thẻ đầy đủ, tự động chọn Tự động và ẩn nhập tên bộ thẻ mới
          if (res.type !== 'cards_array') {
            if (targetDeckSelect) targetDeckSelect.value = '__auto__';
            if (groupNewDeckName) groupNewDeckName.style.display = 'none';
          } else {
            // Nếu là mảng từ vựng thuần túy, nếu chưa chọn gì thì chuyển sang Tạo bộ mới hoặc bộ mặc định
            if (targetDeckSelect && targetDeckSelect.value === '__auto__') {
              targetDeckSelect.value = '__new__';
              if (groupNewDeckName) groupNewDeckName.style.display = 'block';
            }
          }
        } else {
          analysisBox.style.borderColor = 'rgba(225, 29, 72, 0.4)';
          analysisBox.style.background = 'rgba(225, 29, 72, 0.08)';
          if (analysisTitle) {
            analysisTitle.innerHTML = `❌ <b>Không hợp lệ:</b> Lỗi định dạng JSON`;
            analysisTitle.style.color = '#e11d48';
          }
          if (analysisDesc) {
            analysisDesc.innerText = res.error;
            analysisDesc.style.color = '#e11d48';
          }
        }
      }
    }
  };

  const openImportModal = (preferredDeckId = null) => {
    // Nạp danh sách bộ thẻ vào select
    if (targetDeckSelect) {
      targetDeckSelect.innerHTML = `
        <option value="__auto__">✨ Tự động theo thông tin trong file</option>
        <option value="__new__">+ Tạo bộ thẻ mới...</option>
      `;
      AppState.allDecks.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.innerText = `Bộ thẻ: ${d.name}`;
        targetDeckSelect.appendChild(opt);
      });

      if (preferredDeckId && preferredDeckId !== '__all__') {
        targetDeckSelect.value = preferredDeckId;
      } else if (AppState.currentDeckId) {
        targetDeckSelect.value = AppState.currentDeckId;
      } else {
        targetDeckSelect.value = '__auto__';
      }
    }

    // Reset giao diện
    if (feedback) feedback.style.display = 'none';
    if (analysisBox) analysisBox.style.display = 'none';
    if (jsonTextarea) jsonTextarea.value = '';
    if (fileInput) fileInput.value = '';
    if (inputNewDeckName) inputNewDeckName.value = '';
    if (groupNewDeckName) groupNewDeckName.style.display = targetDeckSelect && targetDeckSelect.value === '__new__' ? 'block' : 'none';

    document.getElementById('prompt-raw-input').value = '';
    document.getElementById('group-prompt-output').style.display = 'none';
    document.getElementById('btn-copy-ai-prompt').style.display = 'none';

    // Mặc định mở Tab 1 (Nhập file / Dán JSON)
    tabBtnImport.click();

    modal.style.display = 'flex';
  };

  // Cung cấp hàm toàn cục cho nút Nhập JSON ở trang chi tiết bộ thẻ
  window.openImportModalWithDeck = openImportModal;

  if (btnTopImport) btnTopImport.onclick = () => openImportModal();
  if (btnDeckImport) btnDeckImport.onclick = () => openImportModal();
  if (btnSettingsImport) btnSettingsImport.onclick = () => openImportModal();

  if (btnClose) btnClose.onclick = () => modal.style.display = 'none';
  if (btnCancel) btnCancel.onclick = () => modal.style.display = 'none';

  // Chuyển Tab
  tabBtnImport.onclick = () => {
    tabBtnImport.style.borderBottomColor = 'var(--primary)';
    tabBtnImport.style.color = 'var(--primary)';
    tabBtnCreate.style.borderBottomColor = 'transparent';
    tabBtnCreate.style.color = 'var(--text-secondary)';
    paneImport.style.display = 'block';
    paneCreate.style.display = 'none';
    btnExecute.style.display = 'inline-flex';
  };

  tabBtnCreate.onclick = () => {
    tabBtnCreate.style.borderBottomColor = 'var(--primary)';
    tabBtnCreate.style.color = 'var(--primary)';
    tabBtnImport.style.borderBottomColor = 'transparent';
    tabBtnImport.style.color = 'var(--text-secondary)';
    paneCreate.style.display = 'block';
    paneImport.style.display = 'none';
    btnExecute.style.display = 'none';
  };

  // Toggle ô nhập tên bộ thẻ mới
  if (targetDeckSelect && groupNewDeckName) {
    targetDeckSelect.onchange = () => {
      groupNewDeckName.style.display = targetDeckSelect.value === '__new__' ? 'block' : 'none';
    };
  }

  // Đọc file từ file input và phân tích ngay
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          jsonTextarea.value = re.target.result;
          triggerLiveAnalysis();
        };
        reader.readAsText(file);
      }
    });
  }

  // Phân tích thời gian thực khi dán hoặc gõ vào textarea
  if (jsonTextarea) {
    jsonTextarea.addEventListener('input', triggerLiveAnalysis);
  }

  // TẠO PROMPT CHUYỂN ĐỔI BẰNG AI
  const btnGenPrompt = document.getElementById('btn-generate-ai-prompt');
  const btnCopyPrompt = document.getElementById('btn-copy-ai-prompt');
  const rawInput = document.getElementById('prompt-raw-input');
  const promptOutput = document.getElementById('prompt-generated-output');
  const groupPromptOutput = document.getElementById('group-prompt-output');

  if (btnGenPrompt) {
    btnGenPrompt.onclick = () => {
      const rawText = rawInput.value.trim();
      if (!rawText) {
        alert('Vui lòng dán danh sách từ vựng thô vào ô trước khi tạo prompt!');
        return;
      }

      const standardPrompt = `Chuyển đổi danh sách từ vựng tiếng Nhật sau thành JSON với format:
[
  {
    "word": "từ vựng",
    "reading": "cách đọc hiragana",
    "hanviet": "âm Hán Việt (để rỗng \\"\\" nếu từ không có Kanji)",
    "meaning": "nghĩa tiếng Việt",
    "example": "câu ví dụ tiếng Nhật (tùy chọn)",
    "exampleMeaning": "nghĩa câu ví dụ tiếng Việt (tùy chọn)"
  }
]

Yêu cầu:
- Chỉ trả về JSON hợp lệ, không có Markdown code fence, lời giải thích hoặc nội dung bên ngoài JSON.
- Không bỏ sót từ vựng trong danh sách.
- Không tự ý tạo thêm từ vựng không có trong dữ liệu đầu vào.
- Giữ nguyên nội dung từ vựng gốc, chuẩn hóa cách đọc và nghĩa khi cần.
- Nếu từ không có Kanji hoặc không có âm Hán Việt phù hợp, đặt \`hanviet\` thành chuỗi rỗng.
- Nếu không có ví dụ, có thể bỏ hai trường ví dụ hoặc để chuỗi rỗng.
- \`word\`, \`reading\`, \`hanviet\` và \`meaning\` phải là chuỗi.
- Đảm bảo JSON có thể được nhập vào JP Dictionary Extension.

Danh sách từ vựng:
${rawText}`;

      promptOutput.value = standardPrompt;
      groupPromptOutput.style.display = 'block';
      btnCopyPrompt.style.display = 'inline-flex';
    };
  }

  if (btnCopyPrompt) {
    btnCopyPrompt.onclick = () => {
      navigator.clipboard.writeText(promptOutput.value).then(() => {
        btnCopyPrompt.innerText = '✅ Đã sao chép prompt!';
        setTimeout(() => { btnCopyPrompt.innerText = '📋 Sao chép Prompt vào Clipboard'; }, 2000);
      });
    };
  }

  // Thực hiện nhập JSON
  if (btnExecute) {
    btnExecute.onclick = async () => {
      const jsonStr = jsonTextarea.value.trim();
      const selectedTarget = targetDeckSelect.value;
      const newDeckName = inputNewDeckName ? inputNewDeckName.value.trim() : '';

      if (!jsonStr) {
        alert('Vui lòng dán chuỗi JSON hoặc tải file .json lên!');
        return;
      }

      if (selectedTarget === '__new__' && !newDeckName) {
        alert('Vui lòng nhập tên cho bộ thẻ mới!');
        if (inputNewDeckName) inputNewDeckName.focus();
        return;
      }

      // Kiểm tra tính hợp lệ trước khi nhập
      if (typeof analyzeImportJson === 'function') {
        const check = analyzeImportJson(jsonStr);
        if (!check.valid) {
          alert('Không thể nhập dữ liệu: ' + check.error);
          return;
        }

        const confirmMsg = `Bạn có chắc chắn muốn nhập dữ liệu?\n\n- Loại dữ liệu: ${check.typeLabel}\n- Số bộ thẻ: ${check.decksCount} (${check.deckNames.join(', ')})\n- Số thẻ từ vựng: ${check.cardsCount} thẻ\n\nDữ liệu sẽ được khôi phục và cập nhật an toàn vào hệ thống!`;
        if (!confirm(confirmMsg)) {
          return;
        }
      }

      feedback.style.display = 'block';
      feedback.style.background = 'rgba(2, 132, 199, 0.1)';
      feedback.style.color = '#0284c7';
      feedback.innerText = '⏳ Đang kiểm tra, xử lý và lưu dữ liệu vào hệ thống...';

      const targetId = (selectedTarget === '__new__' || selectedTarget === '__auto__') ? null : selectedTarget;
      const targetName = selectedTarget === '__new__' ? newDeckName : null;

      const res = await importDecksFromJson(jsonStr, targetId, targetName);

      if (res.success) {
        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
        feedback.style.color = '#10b981';
        
        let msg = `✅ Nhập thành công!`;
        if (res.importedDecksCount > 0) msg += ` ${res.importedDecksCount} bộ thẻ mới.`;
        if (res.updatedDecksCount > 0) msg += ` Cập nhật ${res.updatedDecksCount} bộ thẻ.`;
        if (res.importedCardsCount > 0) msg += ` Thêm ${res.importedCardsCount} từ vựng mới.`;
        if (res.updatedCardsCount > 0) msg += ` Đồng bộ ${res.updatedCardsCount} từ vựng đã có.`;
        if (res.totalCardsProcessed === 0) msg += ` Không có từ vựng nào cần cập nhật.`;

        feedback.innerText = msg;

        setTimeout(async () => {
          modal.style.display = 'none';
          await reloadAllData(true);
        }, 1200);
      } else {
        feedback.style.background = 'rgba(225, 29, 72, 0.15)';
        feedback.style.color = '#e11d48';
        feedback.innerText = `❌ Lỗi nhập dữ liệu: ${res.error}`;
      }
    };
  }
}

// ========================================================
// 12. MODAL: XUẤT JSON & TẠO PROMPT DỮ LIỆU
// ========================================================
function setupExportModal() {
  const modal = document.getElementById('modal-export');
  const btnTopExport = document.getElementById('btn-topbar-export');
  const btnSettingsExport = document.getElementById('btn-settings-export');
  const btnClose = document.getElementById('btn-close-export-modal');
  const btnCancel = document.getElementById('btn-cancel-export-modal');

  const tabBtnFile = document.getElementById('tab-btn-export-file');
  const tabBtnPrompt = document.getElementById('tab-btn-export-prompt');
  const paneFile = document.getElementById('pane-export-file');
  const panePrompt = document.getElementById('pane-export-prompt');

  const selectScope = document.getElementById('export-deck-scope-select');
  const selectPromptScope = document.getElementById('export-prompt-deck-select');
  const promptTextarea = document.getElementById('export-prompt-textarea');
  const btnDownload = document.getElementById('btn-do-download-json');
  const btnCopyPrompt = document.getElementById('btn-copy-export-prompt');

  const openExportModal = () => {
    // Nạp danh sách bộ thẻ vào các ô chọn
    if (selectScope && selectPromptScope) {
      selectScope.innerHTML = '<option value="__all__">Toàn bộ dữ liệu (Tất cả bộ thẻ & Thẻ)</option>';
      selectPromptScope.innerHTML = '<option value="__all__">Tất cả từ vựng trong hệ thống</option>';

      AppState.allDecks.forEach(d => {
        const count = AppState.allCards.filter(c => c.deckId === d.id).length;
        const opt1 = document.createElement('option');
        opt1.value = d.id;
        opt1.innerText = `Bộ thẻ: ${d.name} (${count} thẻ)`;
        selectScope.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = d.id;
        opt2.innerText = `Bộ thẻ: ${d.name} (${count} thẻ)`;
        selectPromptScope.appendChild(opt2);
      });

      if (AppState.currentDeckId) {
        selectScope.value = AppState.currentDeckId;
        selectPromptScope.value = AppState.currentDeckId;
      }
    }

    // Cập nhật textarea prompt
    updateExportPromptView();

    tabBtnFile.click();
    modal.style.display = 'flex';
  };

  if (btnTopExport) btnTopExport.onclick = openExportModal;
  if (btnSettingsExport) btnSettingsExport.onclick = openExportModal;

  if (btnClose) btnClose.onclick = () => modal.style.display = 'none';
  if (btnCancel) btnCancel.onclick = () => modal.style.display = 'none';

  tabBtnFile.onclick = () => {
    tabBtnFile.style.borderBottomColor = 'var(--primary)';
    tabBtnFile.style.color = 'var(--primary)';
    tabBtnPrompt.style.borderBottomColor = 'transparent';
    tabBtnPrompt.style.color = 'var(--text-secondary)';
    paneFile.style.display = 'block';
    panePrompt.style.display = 'none';
  };

  tabBtnPrompt.onclick = () => {
    tabBtnPrompt.style.borderBottomColor = 'var(--primary)';
    tabBtnPrompt.style.color = 'var(--primary)';
    tabBtnFile.style.borderBottomColor = 'transparent';
    tabBtnFile.style.color = 'var(--text-secondary)';
    panePrompt.style.display = 'block';
    paneFile.style.display = 'none';
    updateExportPromptView();
  };

  const updateExportPromptView = async () => {
    const scope = selectPromptScope ? selectPromptScope.value : '__all__';
    if (typeof exportDeckWordsStandardJson === 'function') {
      const jsonStr = await exportDeckWordsStandardJson(scope);
      if (promptTextarea) promptTextarea.value = jsonStr;
    }
  };

  if (selectPromptScope) {
    selectPromptScope.onchange = updateExportPromptView;
  }

  // Tải file JSON Backup
  if (btnDownload) {
    btnDownload.onclick = async () => {
      const scope = selectScope.value;
      if (typeof exportDecksToJson === 'function') {
        const json = await exportDecksToJson(scope);
        const dateStr = new Date().toISOString().slice(0, 10);
        let fileName = `jp-dictionary-backup-${dateStr}.json`;
        if (scope !== '__all__') {
          const targetDeck = AppState.allDecks.find(d => d.id === scope);
          if (targetDeck) fileName = `jp-dictionary-deck-${targetDeck.name}-${dateStr}.json`;
        }
        downloadFile(json, fileName, 'application/json');
        modal.style.display = 'none';
      }
    };
  }

  // Sao chép Prompt JSON
  if (btnCopyPrompt) {
    btnCopyPrompt.onclick = () => {
      navigator.clipboard.writeText(promptTextarea.value).then(() => {
        btnCopyPrompt.innerText = '✅ Đã sao chép vào Clipboard!';
        setTimeout(() => { btnCopyPrompt.innerText = '📋 Sao chép dữ liệu JSON vào Clipboard'; }, 2000);
      });
    };
  }
}

// ========================================================
// TIỆN ÍCH DÙNG CHUNG (UTILITIES)
// ========================================================
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function playPronunciation(text) {
  if (!text) return;
  const clean = text.replace(/\([^)]*\)/g, '').trim();

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'ja-JP';
      u.rate = AppState.speechRate;
      const jaVoice = window.speechSynthesis.getVoices().find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      if (jaVoice) u.voice = jaVoice;
      window.speechSynthesis.speak(u);
      return;
    } catch (e) {}
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(clean)}`;
  const audio = new Audio(googleTtsUrl);
  audio.playbackRate = AppState.speechRate;
  audio.play().catch(() => {});
}

/**
 * Tải file an toàn trong Chrome Extension với giải phóng tài nguyên sau độ trễ
 */
function downloadFile(content, fileName, contentType) {
  const a = document.createElement('a');
  const file = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(file);
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Giải phóng URL an toàn sau 2000ms để trình duyệt tải xong
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

// ========================================================
// 10. MODULE LUYỆN THI JLPT N1–N5 BẢN ĐỊA HÓA TIẾNG VIỆT
// ========================================================

/**
 * Khởi tạo toàn bộ sự kiện cho giao diện JLPT
 */
function setupJLPTEvents() {
  // 1. Chuyển đổi cấp độ khi bấm thẻ cấp độ (N5..N1)
  const levelCards = document.querySelectorAll('.jlpt-level-card');
  levelCards.forEach(card => {
    card.addEventListener('click', () => {
      const lvl = card.getAttribute('data-level');
      if (lvl && lvl !== AppState.jlptLevel) {
        AppState.jlptLevel = lvl;
        localStorage.setItem('jpex_jlpt_selected_level', lvl);
        AppState.jlptPage = 1;
        AppState.jlptGrammarPage = 1;
        AppState.jlptKanjiPage = 1;
        AppState.jlptSelectedIds.clear();

        syncJLPTLevelCardsUI();
        renderJLPTView();
      }
    });
  });

  // Đồng bộ trạng thái ban đầu của level card theo localStorage (mặc định N4/N5)
  syncJLPTLevelCardsUI();

  // 2. Chuyển đổi giữa các chuyên mục con (Subnav Tabs)
  const subnavBtns = document.querySelectorAll('.jlpt-tab-btn');
  subnavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.getAttribute('data-subtab');
      if (targetSubtab && targetSubtab !== AppState.jlptSubtab) {
        AppState.jlptSubtab = targetSubtab;
        syncJLPTSubtabsUI();
        renderJLPTActiveSubtab();
      }
    });
  });

  // 3. Sự kiện trong Subview: TỪ VỰNG (VOCABULARY)
  const searchInput = document.getElementById('jlpt-search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        AppState.jlptQuery = e.target.value.trim();
        AppState.jlptPage = 1;
        renderJLPTVocabSubtab();
      }, 250);
    });
  }

  const statusFilter = document.getElementById('jlpt-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      AppState.jlptStatusFilter = e.target.value;
      AppState.jlptPage = 1;
      renderJLPTVocabSubtab();
    });
  }

  const transFilter = document.getElementById('jlpt-trans-filter');
  if (transFilter) {
    transFilter.addEventListener('change', (e) => {
      AppState.jlptTransFilter = e.target.value;
      AppState.jlptPage = 1;
      renderJLPTVocabSubtab();
    });
  }

  const btnToggleSelectPage = document.getElementById('btn-jlpt-toggle-select-all');
  if (btnToggleSelectPage) {
    btnToggleSelectPage.addEventListener('click', () => {
      const pageWords = getJLPTCurrentPageWords();
      const allSelected = pageWords.length > 0 && pageWords.every(w => AppState.jlptSelectedIds.has(w.id));

      pageWords.forEach(w => {
        if (allSelected) {
          AppState.jlptSelectedIds.delete(w.id);
        } else {
          AppState.jlptSelectedIds.add(w.id);
        }
      });

      renderJLPTVocabTable();
      updateJLPTSelectionControls();
    });
  }

  const btnSelectEntire = document.getElementById('btn-jlpt-select-entire-level');
  if (btnSelectEntire) {
    btnSelectEntire.addEventListener('click', () => {
      const words = AppState.jlptFilteredWords || [];
      const allSelected = words.length > 0 && words.every(w => AppState.jlptSelectedIds.has(w.id));

      if (allSelected) {
        AppState.jlptSelectedIds.clear();
      } else {
        words.forEach(w => AppState.jlptSelectedIds.add(w.id));
      }

      renderJLPTVocabTable();
      updateJLPTSelectionControls();
    });
  }

  const tableHeaderCheckbox = document.getElementById('jlpt-table-header-checkbox');
  if (tableHeaderCheckbox) {
    tableHeaderCheckbox.addEventListener('change', (e) => {
      const pageWords = getJLPTCurrentPageWords();
      pageWords.forEach(w => {
        if (e.target.checked) {
          AppState.jlptSelectedIds.add(w.id);
        } else {
          AppState.jlptSelectedIds.delete(w.id);
        }
      });
      renderJLPTVocabTable();
      updateJLPTSelectionControls();
    });
  }

  const btnStartFlashcard = document.getElementById('btn-jlpt-start-flashcard');
  if (btnStartFlashcard) {
    btnStartFlashcard.addEventListener('click', handleJLPTStartFlashcard);
  }

  const btnAddToDeck = document.getElementById('btn-jlpt-add-to-deck');
  if (btnAddToDeck) {
    btnAddToDeck.addEventListener('click', () => openJLPTDeckPickerModal('vocab'));
  }

  const btnPrevPage = document.getElementById('btn-jlpt-prev-page');
  const btnNextPage = document.getElementById('btn-jlpt-next-page');
  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (AppState.jlptPage > 1) {
        AppState.jlptPage--;
        renderJLPTVocabTable();
      }
    });
  }
  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      const totalPages = Math.ceil((AppState.jlptFilteredWords.length || 1) / AppState.jlptPageSize);
      if (AppState.jlptPage < totalPages) {
        AppState.jlptPage++;
        renderJLPTVocabTable();
      }
    });
  }

  // 4. Sự kiện trong Subview: NGỮ PHÁP (GRAMMAR)
  const grammarSearch = document.getElementById('jlpt-grammar-search');
  if (grammarSearch) {
    let debounceTimer;
    grammarSearch.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        AppState.jlptGrammarQuery = e.target.value.trim();
        AppState.jlptGrammarPage = 1;
        renderJLPTGrammarSubtab();
      }, 250);
    });
  }

  const grammarTransFilter = document.getElementById('jlpt-grammar-trans-filter');
  if (grammarTransFilter) {
    grammarTransFilter.addEventListener('change', (e) => {
      AppState.jlptGrammarTransFilter = e.target.value;
      AppState.jlptGrammarPage = 1;
      renderJLPTGrammarSubtab();
    });
  }

  const btnGrammarReview = document.getElementById('btn-jlpt-grammar-start-review');
  if (btnGrammarReview) {
    btnGrammarReview.addEventListener('click', handleJLPTStartGrammarFlashcard);
  }

  const btnGrammarAddDeck = document.getElementById('btn-jlpt-grammar-add-deck');
  if (btnGrammarAddDeck) {
    btnGrammarAddDeck.addEventListener('click', () => openJLPTDeckPickerModal('grammar'));
  }

  const btnGrammarPrev = document.getElementById('btn-jlpt-grammar-prev');
  const btnGrammarNext = document.getElementById('btn-jlpt-grammar-next');
  if (btnGrammarPrev) {
    btnGrammarPrev.addEventListener('click', () => {
      if (AppState.jlptGrammarPage > 1) {
        AppState.jlptGrammarPage--;
        renderJLPTGrammarList();
      }
    });
  }
  if (btnGrammarNext) {
    btnGrammarNext.addEventListener('click', () => {
      const totalPages = Math.ceil((AppState.jlptFilteredGrammar.length || 1) / AppState.jlptGrammarPageSize);
      if (AppState.jlptGrammarPage < totalPages) {
        AppState.jlptGrammarPage++;
        renderJLPTGrammarList();
      }
    });
  }

  // 5. Sự kiện trong Subview: CHỮ HÁN (KANJI)
  const kanjiSearch = document.getElementById('jlpt-kanji-search');
  if (kanjiSearch) {
    let debounceTimer;
    kanjiSearch.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        AppState.jlptKanjiQuery = e.target.value.trim();
        AppState.jlptKanjiPage = 1;
        renderJLPTKanjiSubtab();
      }, 250);
    });
  }

  const btnKanjiReview = document.getElementById('btn-jlpt-kanji-start-review');
  if (btnKanjiReview) {
    btnKanjiReview.addEventListener('click', handleJLPTStartKanjiFlashcard);
  }

  const btnKanjiAddDeck = document.getElementById('btn-jlpt-kanji-add-deck');
  if (btnKanjiAddDeck) {
    btnKanjiAddDeck.addEventListener('click', () => openJLPTDeckPickerModal('kanji'));
  }

  const btnKanjiPrev = document.getElementById('btn-jlpt-kanji-prev');
  const btnKanjiNext = document.getElementById('btn-jlpt-kanji-next');
  if (btnKanjiPrev) {
    btnKanjiPrev.addEventListener('click', () => {
      if (AppState.jlptKanjiPage > 1) {
        AppState.jlptKanjiPage--;
        renderJLPTKanjiGrid();
      }
    });
  }
  if (btnKanjiNext) {
    btnKanjiNext.addEventListener('click', () => {
      const totalPages = Math.ceil((AppState.jlptFilteredKanji.length || 1) / AppState.jlptKanjiPageSize);
      if (AppState.jlptKanjiPage < totalPages) {
        AppState.jlptKanjiPage++;
        renderJLPTKanjiGrid();
      }
    });
  }

  // 6. Sự kiện trong Subview: THẺ GHI NHỚ & ÔN TẬP (FLASHCARDS HUB)
  const fcLaunchBtn = document.getElementById('btn-fc-launch-session');
  if (fcLaunchBtn) {
    fcLaunchBtn.addEventListener('click', handleJLPTLaunchSession);
  }
  ['fc-config-level', 'fc-config-category', 'fc-config-scope', 'fc-config-limit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateJLPTFlashcardHubSummary);
  });

  // 7. Sự kiện trong Subview: TIẾN ĐỘ HỌC (PROGRESS DASHBOARD)
  const btnContinueStudy = document.getElementById('btn-prog-continue-study');
  if (btnContinueStudy) {
    btnContinueStudy.addEventListener('click', () => {
      AppState.jlptSubtab = 'flashcard';
      syncJLPTSubtabsUI();
      renderJLPTActiveSubtab();
    });
  }

  // 8. Sự kiện trong Subview: NHẬP GIÁO TRÌNH CÁ NHÂN (IMPORT)
  setupPersonalImportEvents();

  // 9. Sự kiện trong Modal chọn Bộ thẻ đích
  const modalDeck = document.getElementById('modal-jlpt-deck-picker');
  const btnCloseModal = document.getElementById('btn-close-jlpt-deck-modal');
  const btnCancelModal = document.getElementById('btn-cancel-jlpt-deck-modal');
  const selectTargetDeck = document.getElementById('select-jlpt-target-deck');
  const groupNewDeckName = document.getElementById('group-jlpt-new-deck-name');
  const btnConfirmAddDeck = document.getElementById('btn-confirm-jlpt-add-deck');

  const closeDeckModal = () => {
    if (modalDeck) modalDeck.style.display = 'none';
  };
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeDeckModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeDeckModal);

  if (selectTargetDeck) {
    selectTargetDeck.addEventListener('change', (e) => {
      if (groupNewDeckName) {
        groupNewDeckName.style.display = e.target.value === '__new__' ? 'block' : 'none';
      }
    });
  }

  if (btnConfirmAddDeck) {
    btnConfirmAddDeck.addEventListener('click', handleJLPTConfirmAddToDeck);
  }
}

/**
 * Đồng bộ trạng thái giao diện cấp độ được chọn
 */
function syncJLPTLevelCardsUI() {
  const cards = document.querySelectorAll('.jlpt-level-card');
  cards.forEach(card => {
    if (card.getAttribute('data-level') === AppState.jlptLevel) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  const fcCurrLvlEl = document.getElementById('fc-config-curr-lvl');
  if (fcCurrLvlEl) fcCurrLvlEl.innerText = AppState.jlptLevel;
}

/**
 * Đồng bộ trạng thái các tab chuyên mục JLPT
 */
function syncJLPTSubtabsUI() {
  const buttons = document.querySelectorAll('.jlpt-tab-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-subtab') === AppState.jlptSubtab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const subviews = document.querySelectorAll('.jlpt-subview');
  subviews.forEach(view => {
    if (view.id === `jlpt-subview-${AppState.jlptSubtab}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });
}

/**
 * Điều phối render cho Subtab hiện tại
 */
async function renderJLPTActiveSubtab() {
  if (AppState.jlptSubtab === 'vocab') {
    await renderJLPTVocabSubtab();
  } else if (AppState.jlptSubtab === 'grammar') {
    await renderJLPTGrammarSubtab();
  } else if (AppState.jlptSubtab === 'kanji') {
    await renderJLPTKanjiSubtab();
  } else if (AppState.jlptSubtab === 'flashcard') {
    await renderJLPTFlashcardSubtab();
  } else if (AppState.jlptSubtab === 'progress') {
    await renderJLPTProgressSubtab();
  } else if (AppState.jlptSubtab === 'import') {
    await renderJLPTImportSubtab();
  }
}

/**
 * Nạp dữ liệu và hiển thị giao diện JLPT tổng thể
 */
async function renderJLPTView(reloadStats = true) {
  syncJLPTLevelCardsUI();
  syncJLPTSubtabsUI();

  // Cập nhật số liệu thống kê cấp độ
  if (reloadStats && typeof getJLPTStudyStats === 'function') {
    try {
      const statsObj = await getJLPTStudyStats();
      if (statsObj && statsObj.levels) {
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        levels.forEach(lvl => {
          const lStat = statsObj.levels[lvl];
          const countEl = document.getElementById(`jlpt-stat-count-${lvl.toLowerCase()}`);
          const progEl = document.getElementById(`jlpt-stat-prog-${lvl.toLowerCase()}`);
          if (countEl && lStat) {
            countEl.innerText = `${lStat.total.toLocaleString()} từ`;
          }
          if (progEl && lStat) {
            progEl.innerText = `${lStat.saved} đã lưu • ${lStat.percentMastered}% đã thuộc`;
          }
        });
      }
    } catch (e) {
      console.warn('[Workspace] Lỗi nạp JLPT stats:', e);
    }
  }

  // Cập nhật badges trên các subtab
  try {
    const vWords = await getJLPTWords(AppState.jlptLevel);
    const gList = await getJLPTGrammar(AppState.jlptLevel);
    const kList = await getJLPTKanji(AppState.jlptLevel);

    const bV = document.getElementById('badge-subtab-vocab');
    const bG = document.getElementById('badge-subtab-grammar');
    const bK = document.getElementById('badge-subtab-kanji');

    if (bV) bV.innerText = vWords.length.toLocaleString();
    if (bG) bG.innerText = gList.length.toLocaleString();
    if (bK) bK.innerText = kList.length.toLocaleString();
  } catch (err) {
    console.warn('[Workspace] Cập nhật badge subtabs warning:', err);
  }

  await renderJLPTActiveSubtab();
}

// ========================================================
// 10.1 SUBVIEW: TỪ VỰNG (VOCABULARY) CONTROLLER
// ========================================================

async function renderJLPTVocabSubtab() {
  let rawWords = [];
  if (typeof getJLPTWords === 'function') {
    rawWords = await getJLPTWords(AppState.jlptLevel);
  }

  const cardMap = new Map();
  (AppState.allCards || []).forEach(c => {
    const key = (c.word || c.kanji || '').trim();
    if (key) cardMap.set(key, c);
  });

  const q = (AppState.jlptQuery || '').toLowerCase();
  const statusFilter = AppState.jlptStatusFilter;
  const transFilter = AppState.jlptTransFilter;

  AppState.jlptFilteredWords = rawWords.filter(item => {
    // 1. Tìm kiếm chuỗi
    if (q) {
      const matchWord = item.word && item.word.toLowerCase().includes(q);
      const matchReading = item.reading && item.reading.toLowerCase().includes(q);
      const matchHanviet = item.hanviet && item.hanviet.toLowerCase().includes(q);
      const matchMeaningVi = item.meaningVi && item.meaningVi.toLowerCase().includes(q);
      const matchMeaningOrig = item.originalMeaning && item.originalMeaning.toLowerCase().includes(q);
      if (!matchWord && !matchReading && !matchHanviet && !matchMeaningVi && !matchMeaningOrig) {
        return false;
      }
    }

    // 2. Lọc theo trạng thái SRS
    if (statusFilter && statusFilter !== 'all') {
      const card = cardMap.get(item.word);
      let status = 'new';
      if (card) {
        const srs = card.srs || {};
        if ((srs.repetition && srs.repetition >= 4) || (srs.interval && srs.interval >= 21)) {
          status = 'mastered';
        } else {
          status = 'learning';
        }
      }
      if (status !== statusFilter) return false;
    }

    // 3. Lọc theo trạng thái dịch
    if (transFilter && transFilter !== 'all') {
      if (transFilter === 'verified' && item.translationStatus !== 'verified') return false;
      if (transFilter === 'missing' && item.translationStatus !== 'missing') return false;
    }

    return true;
  });

  renderJLPTVocabTable();
  updateJLPTSelectionControls();
}

function getJLPTCurrentPageWords() {
  const words = AppState.jlptFilteredWords || [];
  const start = (AppState.jlptPage - 1) * AppState.jlptPageSize;
  const end = start + AppState.jlptPageSize;
  return words.slice(start, end);
}

function renderJLPTVocabTable() {
  const tbody = document.getElementById('jlpt-words-tbody');
  if (!tbody) return;

  const words = AppState.jlptFilteredWords || [];
  const total = words.length;
  const pageSize = AppState.jlptPageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (AppState.jlptPage > totalPages) AppState.jlptPage = totalPages;
  if (AppState.jlptPage < 1) AppState.jlptPage = 1;

  const pageWords = getJLPTCurrentPageWords();

  const cardMap = new Map();
  (AppState.allCards || []).forEach(c => {
    const key = (c.word || c.kanji || '').trim();
    if (key) cardMap.set(key, c);
  });

  if (pageWords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 15px; font-weight: 600;">Không tìm thấy từ vựng phù hợp</div>
          <p style="font-size: 13px; margin-top: 4px;">Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.</p>
        </td>
      </tr>
    `;
  } else {
    const levelColors = {
      'N5': '#10b981',
      'N4': '#0284c7',
      'N3': '#7c3aed',
      'N2': '#f59e0b',
      'N1': '#ef4444'
    };

    tbody.innerHTML = pageWords.map(item => {
      const isChecked = AppState.jlptSelectedIds.has(item.id);
      const card = cardMap.get(item.word);
      let statusLabel = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: rgba(148, 163, 184, 0.15); color: var(--text-secondary);">Chưa học</span>';
      
      if (card) {
        const srs = card.srs || {};
        if ((srs.repetition && srs.repetition >= 4) || (srs.interval && srs.interval >= 21)) {
          statusLabel = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 600;">✅ Đã thuộc</span>';
        } else {
          statusLabel = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: rgba(2, 132, 199, 0.15); color: #0284c7; font-weight: 600;">⏳ Đang học</span>';
        }
      }

      const lvlColor = levelColors[item.level] || '#0284c7';
      const exampleHtml = item.example ? `
        <div style="font-size: 12.5px; font-family: var(--font-jp); line-height: 1.4; color: var(--text-primary);">${escapeHtml(item.example)}</div>
        ${item.exampleMeaning ? `<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(item.exampleMeaning)}</div>` : (item.exampleEn ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px; font-style: italic;">[Gốc] ${escapeHtml(item.exampleEn)}</div>` : '')}
      ` : '<span style="color: var(--text-muted); font-size: 12px;">--</span>';

      const hanvietHtml = item.hanviet 
        ? `<span style="font-weight: 700; color: #f59e0b; font-size: 12px; letter-spacing: 0.04em;">${escapeHtml(item.hanviet)}</span>`
        : '<span style="color: var(--text-muted); font-size: 12px;">--</span>';

      let meaningHtml = '';
      if (item.translationStatus === 'verified' && item.meaningVi && item.meaningVi !== 'Chưa có nghĩa tiếng Việt') {
        meaningHtml = `<div style="font-size: 13px; color: var(--text-primary); font-weight: 500; line-height: 1.4;">${escapeHtml(item.meaningVi)}</div>`;
        if (item.originalMeaning) {
          meaningHtml += `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">[Gốc] ${escapeHtml(item.originalMeaning)}</div>`;
        }
      } else {
        meaningHtml = `
          <div style="font-size: 12.5px; color: var(--text-muted); font-style: italic;">Chưa có nghĩa tiếng Việt</div>
          ${item.originalMeaning ? `<div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">[Gốc] ${escapeHtml(item.originalMeaning)}</div>` : ''}
        `;
      }

      return `
        <tr data-word-id="${item.id}" class="${isChecked ? 'row-selected' : ''}">
          <td style="text-align: center;">
            <input type="checkbox" class="jlpt-row-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 17px; font-weight: 700; font-family: var(--font-jp); color: var(--text-primary);">${escapeHtml(item.word)}</span>
              <button class="btn-tts-row" data-word="${escapeHtml(item.word)}" title="Phát âm tiếng Nhật" style="background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.75; transition: opacity 0.1s;">🔊</button>
            </div>
          </td>
          <td>
            <span style="font-size: 14px; color: var(--primary); font-family: var(--font-jp);">${escapeHtml(item.reading)}</span>
          </td>
          <td>${hanvietHtml}</td>
          <td>
            <div style="max-width: 280px;">${meaningHtml}</div>
          </td>
          <td>${exampleHtml}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #fff; background: ${lvlColor};">${item.level}</span>
          </td>
          <td style="text-align: center;">${statusLabel}</td>
          <td style="text-align: center;">
            <button class="btn btn-secondary btn-sm btn-quick-add-jlpt" data-id="${item.id}" title="Thêm nhanh vào Bộ thẻ Flashcard" style="padding: 4px 8px; font-size: 12px;">
              ➕ Thêm
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.jlpt-row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        if (e.target.checked) {
          AppState.jlptSelectedIds.add(id);
        } else {
          AppState.jlptSelectedIds.delete(id);
        }
        updateJLPTSelectionControls();
      });
    });

    tbody.querySelectorAll('.btn-tts-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = btn.getAttribute('data-word');
        playPronunciation(word);
      });
    });

    tbody.querySelectorAll('.btn-quick-add-jlpt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const targetWord = (AppState.jlptFilteredWords || []).find(w => w.id === id);
        if (targetWord) {
          AppState.jlptSelectedIds.clear();
          AppState.jlptSelectedIds.add(id);
          openJLPTDeckPickerModal('vocab');
        }
      });
    });
  }

  const startItem = total === 0 ? 0 : (AppState.jlptPage - 1) * pageSize + 1;
  const endItem = Math.min(total, AppState.jlptPage * pageSize);
  const infoEl = document.getElementById('jlpt-pagination-info');
  const pageDisplayEl = document.getElementById('jlpt-page-number-display');
  const prevBtn = document.getElementById('btn-jlpt-prev-page');
  const nextBtn = document.getElementById('btn-jlpt-next-page');

  if (infoEl) infoEl.innerText = `Hiển thị ${startItem} - ${endItem} trong số ${total.toLocaleString()} từ`;
  if (pageDisplayEl) pageDisplayEl.innerText = `${AppState.jlptPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = AppState.jlptPage <= 1;
  if (nextBtn) nextBtn.disabled = AppState.jlptPage >= totalPages;

  const headerCheckbox = document.getElementById('jlpt-table-header-checkbox');
  if (headerCheckbox && pageWords.length > 0) {
    headerCheckbox.checked = pageWords.every(w => AppState.jlptSelectedIds.has(w.id));
  } else if (headerCheckbox) {
    headerCheckbox.checked = false;
  }
}

function updateJLPTSelectionControls() {
  const count = AppState.jlptSelectedIds.size;
  const badge = document.getElementById('jlpt-selection-count-badge');
  const btnStart = document.getElementById('btn-jlpt-start-flashcard');
  const btnAdd = document.getElementById('btn-jlpt-add-to-deck');

  if (badge) badge.innerText = `Đã chọn: ${count.toLocaleString()} từ`;
  if (btnStart) btnStart.disabled = count === 0;
  if (btnAdd) btnAdd.disabled = count === 0;
}

// ========================================================
// 10.2 SUBVIEW: NGỮ PHÁP (GRAMMAR) CONTROLLER
// ========================================================

async function renderJLPTGrammarSubtab() {
  let rawGrammar = [];
  if (typeof getJLPTGrammar === 'function') {
    rawGrammar = await getJLPTGrammar(AppState.jlptLevel);
  }

  const q = (AppState.jlptGrammarQuery || '').toLowerCase();
  const transFilter = AppState.jlptGrammarTransFilter;

  AppState.jlptFilteredGrammar = rawGrammar.filter(item => {
    if (q) {
      const matchPattern = item.pattern && item.pattern.toLowerCase().includes(q);
      const matchRomaji = item.romaji && item.romaji.toLowerCase().includes(q);
      const matchMeaningVi = item.meaningVi && item.meaningVi.toLowerCase().includes(q);
      const matchFormation = item.formationVi && item.formationVi.toLowerCase().includes(q);
      const matchExplanation = item.explanationVi && item.explanationVi.toLowerCase().includes(q);
      if (!matchPattern && !matchRomaji && !matchMeaningVi && !matchFormation && !matchExplanation) {
        return false;
      }
    }

    if (transFilter && transFilter !== 'all') {
      if (transFilter === 'verified' && item.translationStatus !== 'verified') return false;
      if (transFilter === 'needs_review' && item.translationStatus !== 'needs_review') return false;
    }

    return true;
  });

  renderJLPTGrammarList();
}

function renderJLPTGrammarList() {
  const container = document.getElementById('jlpt-grammar-container');
  if (!container) return;

  const grammarList = AppState.jlptFilteredGrammar || [];
  const total = grammarList.length;
  const pageSize = AppState.jlptGrammarPageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (AppState.jlptGrammarPage > totalPages) AppState.jlptGrammarPage = totalPages;
  if (AppState.jlptGrammarPage < 1) AppState.jlptGrammarPage = 1;

  const start = (AppState.jlptGrammarPage - 1) * pageSize;
  const pageItems = grammarList.slice(start, start + pageSize);

  if (pageItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border);">
        <div style="font-size: 32px; margin-bottom: 8px;">📐</div>
        <div style="font-size: 15px; font-weight: 600;">Không có điểm ngữ pháp phù hợp</div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Hãy thử tìm kiếm với từ khóa khác.</p>
      </div>
    `;
  } else {
    container.innerHTML = pageItems.map(item => {
      const isVerified = item.translationStatus === 'verified';
      const badgeHtml = isVerified 
        ? `<span class="trans-badge-verified">Đã duyệt tiếng Việt</span>`
        : `<span class="trans-badge-review">Chờ rà soát</span>`;

      const formationText = item.formationVi || item.formation || 'Đang cập nhật cấu trúc';
      const explanationText = item.explanationVi || item.explanation || item.notes || '';

      const exampleHtml = item.example ? `
        <div style="margin-top: 10px; padding: 10px 12px; background: var(--bg-card-subtle); border-radius: 6px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="font-family: var(--font-jp); font-weight: 500; color: var(--text-primary); line-height: 1.4;">
              ${escapeHtml(item.example)}
            </div>
            <button class="btn-tts-grammar" data-text="${escapeHtml(item.example)}" title="Phát âm ví dụ" style="background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.8; margin-left: 8px;">🔊</button>
          </div>
          ${item.exampleVi ? `<div style="color: var(--text-secondary); font-size: 12px; margin-top: 3px;">${escapeHtml(item.exampleVi)}</div>` : (item.exampleMeaning ? `<div style="color: var(--text-secondary); font-size: 12px; margin-top: 3px;">${escapeHtml(item.exampleMeaning)}</div>` : '')}
        </div>
      ` : '';

      return `
        <div class="jlpt-grammar-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 18px; font-weight: 700; font-family: var(--font-jp); color: var(--text-primary);">${escapeHtml(item.pattern)}</span>
              ${item.romaji ? `<span style="font-size: 13px; color: var(--primary); margin-left: 8px;">[${escapeHtml(item.romaji)}]</span>` : ''}
              <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #fff; background: #7c3aed; margin-left: 8px;">${item.level}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              ${badgeHtml}
              <button class="btn btn-secondary btn-sm btn-quick-add-grammar" data-id="${item.id}" style="padding: 3px 8px; font-size: 12px;">
                ➕ Thêm vào Bộ thẻ
              </button>
            </div>
          </div>

          <div style="font-size: 14px; font-weight: 600; color: var(--primary); margin-bottom: 6px;">
            Ý nghĩa: ${escapeHtml(item.meaningVi || 'Chưa có nghĩa tiếng Việt')}
          </div>

          <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 6px;">
            <b>Cấu trúc:</b> <code style="background: var(--bg-card-subtle); padding: 2px 6px; border-radius: 4px; font-family: var(--font-jp); font-size: 12px;">${escapeHtml(formationText)}</code>
          </div>

          ${explanationText ? `
            <div style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 6px;">
              <b>Giải thích:</b> ${escapeHtml(explanationText)}
            </div>
          ` : ''}

          ${exampleHtml}
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-tts-grammar').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        playPronunciation(text);
      });
    });

    container.querySelectorAll('.btn-quick-add-grammar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = grammarList.find(g => g.id === id);
        if (item) {
          openJLPTDeckPickerModal('grammar', [item]);
        }
      });
    });
  }

  const startItem = total === 0 ? 0 : start + 1;
  const endItem = Math.min(total, start + pageSize);
  const infoEl = document.getElementById('jlpt-grammar-pagination-info');
  const pageDisplayEl = document.getElementById('jlpt-grammar-page-display');
  const prevBtn = document.getElementById('btn-jlpt-grammar-prev');
  const nextBtn = document.getElementById('btn-jlpt-grammar-next');

  if (infoEl) infoEl.innerText = `Hiển thị ${startItem} - ${endItem} trong số ${total.toLocaleString()} điểm ngữ pháp`;
  if (pageDisplayEl) pageDisplayEl.innerText = `${AppState.jlptGrammarPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = AppState.jlptGrammarPage <= 1;
  if (nextBtn) nextBtn.disabled = AppState.jlptGrammarPage >= totalPages;
}

// ========================================================
// 10.3 SUBVIEW: CHỮ HÁN (KANJI) CONTROLLER
// ========================================================

async function renderJLPTKanjiSubtab() {
  let rawKanji = [];
  if (typeof getJLPTKanji === 'function') {
    rawKanji = await getJLPTKanji(AppState.jlptLevel);
  }

  const q = (AppState.jlptKanjiQuery || '').toLowerCase();

  AppState.jlptFilteredKanji = rawKanji.filter(item => {
    if (!q) return true;
    const matchChar = item.character && item.character.toLowerCase().includes(q);
    const matchHanviet = item.hanviet && item.hanviet.toLowerCase().includes(q);
    const matchMeaningVi = item.meaningVi && item.meaningVi.toLowerCase().includes(q);
    const matchOn = item.onyomi && item.onyomi.some(on => on.toLowerCase().includes(q));
    const matchKun = item.kunyomi && item.kunyomi.some(kun => kun.toLowerCase().includes(q));
    return matchChar || matchHanviet || matchMeaningVi || matchOn || matchKun;
  });

  renderJLPTKanjiGrid();
}

function renderJLPTKanjiGrid() {
  const container = document.getElementById('jlpt-kanji-container');
  if (!container) return;

  const kanjiList = AppState.jlptFilteredKanji || [];
  const total = kanjiList.length;
  const pageSize = AppState.jlptKanjiPageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (AppState.jlptKanjiPage > totalPages) AppState.jlptKanjiPage = totalPages;
  if (AppState.jlptKanjiPage < 1) AppState.jlptKanjiPage = 1;

  const start = (AppState.jlptKanjiPage - 1) * pageSize;
  const pageItems = kanjiList.slice(start, start + pageSize);

  if (pageItems.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border);">
        <div style="font-size: 32px; margin-bottom: 8px;">🈸</div>
        <div style="font-size: 15px; font-weight: 600;">Không tìm thấy Chữ Hán phù hợp</div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Hãy thử tìm kiếm theo âm Hán Việt hoặc bộ thủ khác.</p>
      </div>
    `;
  } else {
    container.innerHTML = pageItems.map(item => {
      const onyomiText = (item.onyomi && item.onyomi.length > 0) ? item.onyomi.join(', ') : '--';
      const kunyomiText = (item.kunyomi && item.kunyomi.length > 0) ? item.kunyomi.join(', ') : '--';
      
      const examplesHtml = (item.examples && item.examples.length > 0) ? `
        <div style="margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 6px; font-size: 11.5px;">
          <div style="font-weight: 600; color: var(--text-muted); margin-bottom: 2px;">Từ ví dụ:</div>
          ${item.examples.slice(0, 2).map(ex => `
            <div style="color: var(--text-secondary); line-height: 1.3;">
              <span style="font-family: var(--font-jp); font-weight: 700; color: var(--text-primary);">${escapeHtml(ex.word)}</span> 
              <span style="color: var(--primary);">(${escapeHtml(ex.reading)})</span>: ${escapeHtml(ex.meaningVi || ex.meaning || '')}
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="jlpt-kanji-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-size: 42px; font-weight: 700; font-family: var(--font-jp); color: var(--text-primary); line-height: 1;">
              ${escapeHtml(item.character)}
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #fff; background: #0284c7;">${item.level}</span>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">${item.strokes || '?'} nét</div>
            </div>
          </div>

          <div style="font-size: 14px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
            ${escapeHtml(item.hanviet || '--')}
          </div>

          <div style="font-size: 12.5px; font-weight: 500; color: var(--text-primary); line-height: 1.3; margin-bottom: 6px;">
            ${escapeHtml(item.meaningVi || item.originalMeaning || 'Chưa rõ nghĩa')}
          </div>

          <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
            <div><b>On:</b> <span style="color: #ef4444; font-family: var(--font-jp);">${escapeHtml(onyomiText)}</span></div>
            <div><b>Kun:</b> <span style="color: #10b981; font-family: var(--font-jp);">${escapeHtml(kunyomiText)}</span></div>
          </div>

          ${examplesHtml}

          <div style="margin-top: 10px; display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm btn-quick-add-kanji" data-id="${item.id}" style="width: 100%; justify-content: center; font-size: 11.5px; padding: 4px;">
              ➕ Thêm vào Thẻ nhớ
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-quick-add-kanji').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const item = kanjiList.find(k => k.id === id);
        if (item) {
          openJLPTDeckPickerModal('kanji', [item]);
        }
      });
    });
  }

  const startItem = total === 0 ? 0 : start + 1;
  const endItem = Math.min(total, start + pageSize);
  const infoEl = document.getElementById('jlpt-kanji-pagination-info');
  const pageDisplayEl = document.getElementById('jlpt-kanji-page-display');
  const prevBtn = document.getElementById('btn-jlpt-kanji-prev');
  const nextBtn = document.getElementById('btn-jlpt-kanji-next');

  if (infoEl) infoEl.innerText = `Hiển thị ${startItem} - ${endItem} trong số ${total.toLocaleString()} Chữ Hán`;
  if (pageDisplayEl) pageDisplayEl.innerText = `${AppState.jlptKanjiPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = AppState.jlptKanjiPage <= 1;
  if (nextBtn) nextBtn.disabled = AppState.jlptKanjiPage >= totalPages;
}

// ========================================================
// 10.4 SUBVIEW: THẺ GHI NHỚ & ÔN TẬP (FLASHCARDS HUB)
// ========================================================

async function renderJLPTFlashcardSubtab() {
  await updateJLPTFlashcardHubSummary();
}

async function updateJLPTFlashcardHubSummary() {
  const levelSelect = document.getElementById('fc-config-level');
  const catSelect = document.getElementById('fc-config-category');
  const targetLevel = (levelSelect && levelSelect.value !== 'current') ? levelSelect.value : AppState.jlptLevel;
  const category = catSelect ? catSelect.value : 'vocab';

  let items = [];
  if (category === 'vocab') items = await getJLPTWords(targetLevel);
  else if (category === 'grammar') items = await getJLPTGrammar(targetLevel);
  else if (category === 'kanji') items = await getJLPTKanji(targetLevel);

  const cardMap = new Map();
  (AppState.allCards || []).forEach(c => {
    const key = (c.word || c.kanji || '').trim();
    if (key) cardMap.set(key, c);
  });

  const now = Date.now();
  let dueCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  items.forEach(item => {
    const key = (item.word || item.character || item.pattern || '').trim();
    const card = cardMap.get(key);
    if (card) {
      const srs = card.srs || {};
      if ((srs.repetition && srs.repetition >= 4) || (srs.interval && srs.interval >= 21)) {
        masteredCount++;
      } else {
        learningCount++;
      }
      if (!srs.dueDate || srs.dueDate <= now) {
        dueCount++;
      }
    }
  });

  const dueEl = document.getElementById('fc-summary-due-count');
  const learnEl = document.getElementById('fc-summary-learning-count');
  const mastEl = document.getElementById('fc-summary-mastered-count');
  const totalEl = document.getElementById('fc-summary-total-level');

  if (dueEl) dueEl.innerText = dueCount.toLocaleString();
  if (learnEl) learnEl.innerText = learningCount.toLocaleString();
  if (mastEl) mastEl.innerText = masteredCount.toLocaleString();
  if (totalEl) totalEl.innerText = `${items.length.toLocaleString()} (${category.toUpperCase()} ${targetLevel})`;
}

async function handleJLPTLaunchSession() {
  const levelSelect = document.getElementById('fc-config-level');
  const catSelect = document.getElementById('fc-config-category');
  const scopeSelect = document.getElementById('fc-config-scope');
  const limitSelect = document.getElementById('fc-config-limit');

  const targetLevel = (levelSelect && levelSelect.value !== 'current') ? levelSelect.value : AppState.jlptLevel;
  const category = catSelect ? catSelect.value : 'vocab';
  const scope = scopeSelect ? scopeSelect.value : 'due';
  const limit = limitSelect ? limitSelect.value : '30';

  let rawItems = [];
  if (category === 'vocab') rawItems = await getJLPTWords(targetLevel);
  else if (category === 'grammar') rawItems = await getJLPTGrammar(targetLevel);
  else if (category === 'kanji') rawItems = await getJLPTKanji(targetLevel);

  if (rawItems.length === 0) {
    alert(`Không tìm thấy dữ liệu cho cấp độ ${targetLevel}.`);
    return;
  }

  const cardMap = new Map();
  (AppState.allCards || []).forEach(c => {
    const key = (c.word || c.kanji || '').trim();
    if (key) cardMap.set(key, c);
  });

  const now = Date.now();
  let candidateItems = rawItems.filter(item => {
    const key = (item.word || item.character || item.pattern || '').trim();
    const card = cardMap.get(key);

    if (scope === 'due') {
      return card && (!card.srs || !card.srs.dueDate || card.srs.dueDate <= now);
    } else if (scope === 'new') {
      return !card;
    }
    return true; // scope === 'all'
  });

  if (candidateItems.length === 0) {
    if (scope === 'due') {
      alert(`Tuyệt vời! Hiện tại không có thẻ ${category.toUpperCase()} ${targetLevel} nào đến hạn ôn tập hôm nay.`);
      return;
    } else {
      alert(`Không có thẻ nào phù hợp với bộ lọc đã chọn.`);
      return;
    }
  }

  // Giới hạn số lượng thẻ
  if (limit !== 'all') {
    const limitNum = parseInt(limit, 10);
    if (!isNaN(limitNum)) {
      candidateItems = candidateItems.slice(0, limitNum);
    }
  }

  // Tự động bảo lưu vào bộ thẻ chuẩn tương ứng để lưu tiến độ SRS bền vững
  const deckTitle = `JLPT ${targetLevel} - ${category === 'vocab' ? 'Từ vựng' : (category === 'grammar' ? 'Ngữ pháp' : 'Chữ Hán')}`;
  try {
    if (typeof addJLPTItemsToDeck === 'function') {
      await addJLPTItemsToDeck(candidateItems, deckTitle, category);
      await reloadAllData(false);
    }
  } catch (e) {
    console.warn('[Workspace] Lưu items vào deck trước khi học warning:', e);
  }

  // Chuyển đổi sang format card SRS của workspace
  const cardsQueue = candidateItems.map(item => {
    const wordKey = item.word || item.character || item.pattern;
    const existingCard = (AppState.allCards || []).find(c => (c.word === wordKey || c.kanji === wordKey));

    if (category === 'kanji') {
      const onyomiText = (item.onyomi && item.onyomi.length > 0) ? `On: ${item.onyomi.join(', ')}` : '';
      const kunyomiText = (item.kunyomi && item.kunyomi.length > 0) ? `Kun: ${item.kunyomi.join(', ')}` : '';
      const readingCombined = [onyomiText, kunyomiText].filter(Boolean).join(' | ');

      const examplesText = (item.examples && item.examples.length > 0)
        ? item.examples.map(ex => `${ex.word} (${ex.reading}): ${ex.meaningVi || ex.meaning}`).join('\n')
        : '';

      return {
        id: (existingCard && existingCard.id) || item.id,
        word: item.character,
        reading: readingCombined,
        hanviet: item.hanviet || '',
        meaning: item.meaningVi || item.originalMeaning || 'Chưa có nghĩa tiếng Việt',
        meaningVi: item.meaningVi || item.originalMeaning,
        example: examplesText,
        exampleMeaning: '',
        level: item.level,
        notes: `Chữ Hán JLPT ${item.level} • Số nét: ${item.strokes || '?'}`,
        srs: existingCard ? existingCard.srs : { interval: 0, repetition: 0, easeFactor: 2.5, dueDate: Date.now(), state: 'new' }
      };
    } else if (category === 'grammar') {
      const notesFormatted = [
        item.formationVi ? `Cấu trúc: ${item.formationVi}` : (item.formation ? `Cấu trúc: ${item.formation}` : ''),
        item.explanationVi ? `Giải thích: ${item.explanationVi}` : (item.notes ? `Giải thích: ${item.notes}` : '')
      ].filter(Boolean).join('\n\n');

      return {
        id: (existingCard && existingCard.id) || item.id,
        word: item.pattern,
        reading: item.romaji || '',
        hanviet: '',
        meaning: item.meaningVi || item.originalMeaning || 'Chưa có nghĩa tiếng Việt',
        meaningVi: item.meaningVi || item.originalMeaning,
        example: item.example || '',
        exampleMeaning: item.exampleVi || item.exampleMeaning || '',
        level: item.level,
        notes: notesFormatted || `Ngữ pháp JLPT ${item.level}`,
        srs: existingCard ? existingCard.srs : { interval: 0, repetition: 0, easeFactor: 2.5, dueDate: Date.now(), state: 'new' }
      };
    } else {
      // category === 'vocab'
      return {
        id: (existingCard && existingCard.id) || item.id,
        word: item.word,
        reading: item.reading,
        hanviet: item.hanviet || '',
        meaning: item.meaningVi || item.meaning || 'Chưa có nghĩa tiếng Việt',
        meaningVi: item.meaningVi || item.meaning,
        example: item.example || '',
        exampleMeaning: item.exampleMeaning || item.exampleEn || '',
        level: item.level,
        notes: `Từ vựng JLPT ${item.level}`,
        srs: existingCard ? existingCard.srs : { interval: 0, repetition: 0, easeFactor: 2.5, dueDate: Date.now(), state: 'new' }
      };
    }
  });

  startReviewModeWithCustomQueue(cardsQueue, `${deckTitle} (${cardsQueue.length} thẻ)`);
}

async function handleJLPTStartGrammarFlashcard() {
  const grammarList = AppState.jlptFilteredGrammar || [];
  if (grammarList.length === 0) {
    alert('Không có ngữ pháp khả dụng để ôn tập.');
    return;
  }
  openJLPTDeckPickerModal('grammar', grammarList);
}

async function handleJLPTStartKanjiFlashcard() {
  const kanjiList = AppState.jlptFilteredKanji || [];
  if (kanjiList.length === 0) {
    alert('Không có Chữ Hán khả dụng để ôn tập.');
    return;
  }
  openJLPTDeckPickerModal('kanji', kanjiList);
}

// ========================================================
// 10.5 SUBVIEW: TIẾN ĐỘ HỌC (PROGRESS DASHBOARD)
// ========================================================

async function renderJLPTProgressSubtab() {
  if (typeof getJLPTStudyStats !== 'function') return;

  const stats = await getJLPTStudyStats();
  if (!stats) return;

  const totalEl = document.getElementById('prog-stat-total-items');
  const mastEl = document.getElementById('prog-stat-mastered');
  const learnEl = document.getElementById('prog-stat-learning');
  const dueEl = document.getElementById('prog-stat-due');

  if (totalEl) totalEl.innerText = stats.totalItems ? stats.totalItems.toLocaleString() : '10.720';
  if (mastEl) mastEl.innerText = stats.overallMastered.toLocaleString();
  if (learnEl) learnEl.innerText = stats.overallLearning.toLocaleString();
  if (dueEl) dueEl.innerText = stats.overallDue.toLocaleString();

  // Render bảng tiến độ 5 cấp độ
  const progContainer = document.getElementById('prog-levels-breakdown');
  if (progContainer && stats.levels) {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    const levelColors = {
      'N5': '#10b981',
      'N4': '#0284c7',
      'N3': '#7c3aed',
      'N2': '#f59e0b',
      'N1': '#ef4444'
    };

    progContainer.innerHTML = levels.map(lvl => {
      const lStat = stats.levels[lvl] || { total: 0, saved: 0, mastered: 0, percentMastered: 0 };
      const color = levelColors[lvl] || '#0284c7';

      return `
        <div style="background: var(--bg-card-subtle); padding: 14px 16px; border-radius: 8px; border-left: 4px solid ${color};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
              <span>Cấp độ ${lvl}</span>
              <span style="font-size: 11.5px; font-weight: normal; color: var(--text-secondary);">(${lStat.total.toLocaleString()} từ vựng)</span>
            </div>
            <div style="font-size: 12.5px; font-weight: 600; color: ${color};">
              ${lStat.mastered.toLocaleString()} / ${lStat.total.toLocaleString()} (${lStat.percentMastered}% đã thuộc)
            </div>
          </div>
          <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
            <div style="width: ${lStat.percentMastered}%; height: 100%; background: ${color}; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render bảng báo cáo chất lượng dịch
  const transTbody = document.getElementById('prog-translation-tbody');
  if (transTbody) {
    const reportData = [
      { cat: '📖 Từ vựng', lvl: 'N5', total: 674, verified: 268, review: 0, missing: 406, pct: '39.8%' },
      { cat: '📖 Từ vựng', lvl: 'N4', total: 630, verified: 125, review: 0, missing: 505, pct: '19.8%' },
      { cat: '📖 Từ vựng', lvl: 'N3', total: 1659, verified: 139, review: 0, missing: 1520, pct: '8.4%' },
      { cat: '📖 Từ vựng', lvl: 'N2', total: 1778, verified: 78, review: 0, missing: 1700, pct: '4.4%' },
      { cat: '📖 Từ vựng', lvl: 'N1', total: 3070, verified: 52, review: 0, missing: 3018, pct: '1.7%' },
      { cat: '🈸 Chữ Hán (Kanji)', lvl: 'N5', total: 84, verified: 84, review: 0, missing: 0, pct: '100%' },
      { cat: '🈸 Chữ Hán (Kanji)', lvl: 'N4', total: 169, verified: 169, review: 0, missing: 0, pct: '100%' },
      { cat: '🈸 Chữ Hán (Kanji)', lvl: 'N3', total: 387, verified: 387, review: 0, missing: 0, pct: '100%' },
      { cat: '🈸 Chữ Hán (Kanji)', lvl: 'N2', total: 398, verified: 398, review: 0, missing: 0, pct: '100%' },
      { cat: '🈸 Chữ Hán (Kanji)', lvl: 'N1', total: 1345, verified: 1345, review: 0, missing: 0, pct: '100%' },
      { cat: '📐 Ngữ pháp', lvl: 'N5', total: 81, verified: 81, review: 0, missing: 0, pct: '100%' },
      { cat: '📐 Ngữ pháp', lvl: 'N4', total: 98, verified: 44, review: 54, missing: 0, pct: '100%' },
      { cat: '📐 Ngữ pháp', lvl: 'N3', total: 101, verified: 0, review: 101, missing: 0, pct: '100%' },
      { cat: '📐 Ngữ pháp', lvl: 'N2', total: 123, verified: 0, review: 123, missing: 0, pct: '100%' },
      { cat: '📐 Ngữ pháp', lvl: 'N1', total: 123, verified: 0, review: 123, missing: 0, pct: '100%' }
    ];

    transTbody.innerHTML = reportData.map(row => `
      <tr>
        <td style="font-weight: 600;">${row.cat}</td>
        <td style="font-weight: 700; color: var(--primary);">${row.lvl}</td>
        <td style="text-align: center; font-weight: 600;">${row.total.toLocaleString()}</td>
        <td style="text-align: center;"><span class="trans-badge-verified">${row.verified.toLocaleString()}</span></td>
        <td style="text-align: center;"><span class="trans-badge-review">${row.review.toLocaleString()}</span></td>
        <td style="text-align: center;"><span class="trans-badge-missing">${row.missing.toLocaleString()}</span></td>
        <td style="text-align: center; font-weight: 700; color: #10b981;">${row.pct}</td>
      </tr>
    `).join('');
  }
}

// ========================================================
// 10.6 SUBVIEW: NHẬP GIÁO TRÌNH CÁ NHÂN (IMPORT)
// ========================================================

function setupPersonalImportEvents() {
  const dropzone = document.getElementById('personal-import-dropzone');
  const fileInput = document.getElementById('input-personal-import-file');
  const browseBtn = document.getElementById('btn-browse-personal-file');
  const clearFileBtn = document.getElementById('btn-clear-personal-file');
  const confirmBtn = document.getElementById('btn-confirm-personal-import');
  const cancelBtn = document.getElementById('btn-cancel-personal-import');

  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handlePersonalImportFile(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handlePersonalImportFile(e.dataTransfer.files[0]);
      }
    });
  }

  if (clearFileBtn) {
    clearFileBtn.addEventListener('click', resetPersonalImportUI);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', resetPersonalImportUI);
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', handlePersonalImportConfirm);
  }
}

async function renderJLPTImportSubtab() {
  const selectDeck = document.getElementById('select-import-target-deck');
  if (!selectDeck) return;

  const decks = await getDecks();
  let optionsHtml = `<option value="__new__">✨ Tạo Bộ thẻ mới theo tên Giáo trình</option>`;
  optionsHtml += `<option disabled>──────────</option>`;
  decks.forEach(d => {
    optionsHtml += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
  });

  selectDeck.innerHTML = optionsHtml;
}

function handlePersonalImportFile(file) {
  const fileNameDisplay = document.getElementById('personal-file-name-display');
  const fileInfoBadge = document.getElementById('personal-file-info-badge');
  const dropzone = document.getElementById('personal-import-dropzone');

  if (fileNameDisplay) fileNameDisplay.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if (fileInfoBadge) fileInfoBadge.style.display = 'flex';
  if (dropzone) dropzone.style.display = 'none';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const rawContent = e.target.result;
    const format = file.name.endsWith('.csv') ? 'csv' : 'json';
    
    if (typeof parseAndValidatePersonalImport === 'function') {
      const parsed = parseAndValidatePersonalImport(rawContent, format);
      AppState.personalImportParsed = parsed;
      renderPersonalImportPreview(parsed);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function renderPersonalImportPreview(parsed) {
  const previewBox = document.getElementById('personal-import-preview-box');
  const totalCountEl = document.getElementById('preview-total-count');
  const validCountEl = document.getElementById('preview-valid-count');
  const duplicateCountEl = document.getElementById('preview-duplicate-count');
  const errorCountEl = document.getElementById('preview-error-count');
  const tbody = document.getElementById('personal-import-preview-tbody');
  const confirmBtn = document.getElementById('btn-confirm-personal-import');

  if (!previewBox) return;
  previewBox.style.display = 'block';

  if (totalCountEl) totalCountEl.innerText = parsed.totalCount.toLocaleString();
  if (validCountEl) validCountEl.innerText = parsed.validCount.toLocaleString();
  if (duplicateCountEl) duplicateCountEl.innerText = parsed.duplicateCount.toLocaleString();
  if (errorCountEl) errorCountEl.innerText = parsed.errorCount.toLocaleString();

  if (confirmBtn) {
    confirmBtn.disabled = parsed.validItems.length === 0;
  }

  if (tbody) {
    const previewItems = (parsed.previewRows && parsed.previewRows.length > 0)
      ? parsed.previewRows
      : parsed.validItems.slice(0, 10);

    if (previewItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 20px; color: #ef4444;">
            Không có dữ liệu hợp lệ để hiển thị. Vui lòng kiểm tra lại cấu trúc file.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = previewItems.map((item, idx) => `
        <tr>
          <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
          <td style="font-family: var(--font-jp); font-weight: 700; color: var(--text-primary);">${escapeHtml(item.word || '--')}</td>
          <td style="font-family: var(--font-jp); color: var(--primary);">${escapeHtml(item.reading || '--')}</td>
          <td style="font-weight: 600; color: #f59e0b;">${escapeHtml(item.hanviet || '--')}</td>
          <td>${escapeHtml(item.meaning || '--')}</td>
          <td style="font-size: 11.5px; color: var(--text-secondary); max-width: 220px;">${escapeHtml(item.example || '--')}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; background: rgba(16, 185, 129, 0.15); color: #10b981;">
              Hợp lệ
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
}

function resetPersonalImportUI() {
  AppState.personalImportParsed = null;
  const fileInput = document.getElementById('input-personal-import-file');
  const fileInfoBadge = document.getElementById('personal-file-info-badge');
  const dropzone = document.getElementById('personal-import-dropzone');
  const previewBox = document.getElementById('personal-import-preview-box');

  if (fileInput) fileInput.value = '';
  if (fileInfoBadge) fileInfoBadge.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';
  if (previewBox) previewBox.style.display = 'none';
}

async function handlePersonalImportConfirm() {
  const parsed = AppState.personalImportParsed;
  if (!parsed || parsed.validItems.length === 0) {
    alert('Không có dữ liệu hợp lệ để nhập.');
    return;
  }

  const textbookInput = document.getElementById('input-import-textbook');
  const lessonInput = document.getElementById('input-import-lesson');
  const deckSelect = document.getElementById('select-import-target-deck');
  const confirmBtn = document.getElementById('btn-confirm-personal-import');
  const feedbackEl = document.getElementById('preview-import-feedback');

  const textbookName = (textbookInput ? textbookInput.value : '').trim();
  const lessonName = (lessonInput ? lessonInput.value : '').trim();
  let targetDeckIdOrName = deckSelect ? deckSelect.value : '__new__';

  if (targetDeckIdOrName === '__new__') {
    targetDeckIdOrName = textbookName || 'Giáo trình cá nhân';
    if (lessonName) targetDeckIdOrName += ` - ${lessonName}`;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  if (feedbackEl) {
    feedbackEl.style.display = 'block';
    feedbackEl.style.background = 'rgba(2, 132, 199, 0.15)';
    feedbackEl.style.color = '#0284c7';
    feedbackEl.innerText = `Đang xử lý nhập ${parsed.validItems.length.toLocaleString()} từ vào hệ thống...`;
  }

  try {
    const itemsToSave = parsed.validItems.map(item => ({
      ...item,
      notes: [
        textbookName ? `Giáo trình: ${textbookName}` : '',
        lessonName ? `Bài học: ${lessonName}` : '',
        item.tags ? `Thẻ: ${item.tags.join(', ')}` : ''
      ].filter(Boolean).join(' • ')
    }));

    const result = await addJLPTItemsToDeck(itemsToSave, targetDeckIdOrName, 'vocab');
    if (result && result.success) {
      if (feedbackEl) {
        feedbackEl.style.background = 'rgba(16, 185, 129, 0.15)';
        feedbackEl.style.color = '#10b981';
        feedbackEl.innerText = `✅ Nhập thành công ${result.addedCount} từ mới (cập nhật ${result.updatedCount} từ) vào bộ thẻ "${result.deck.name}"!`;
      }

      await reloadAllData(false);

      setTimeout(() => {
        resetPersonalImportUI();
        switchView('decks');
      }, 1500);
    } else {
      throw new Error(result ? result.message : 'Thất bại');
    }
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.style.background = 'rgba(239, 68, 68, 0.15)';
      feedbackEl.style.color = '#ef4444';
      feedbackEl.innerText = `❌ Lỗi: ${err.message}`;
    }
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

// ========================================================
// 10.7 MODAL CHỌN BỘ THẺ ĐÍCH & FLASHCARD LAUNCHERS
// ========================================================

let currentDeckPickerCategory = 'vocab';
let currentDeckPickerCustomItems = null;

async function openJLPTDeckPickerModal(category = 'vocab', customItems = null) {
  currentDeckPickerCategory = category;
  currentDeckPickerCustomItems = customItems;

  const modal = document.getElementById('modal-jlpt-deck-picker');
  const selectDeck = document.getElementById('select-jlpt-target-deck');
  const groupNewName = document.getElementById('group-jlpt-new-deck-name');
  const inputNewName = document.getElementById('input-jlpt-new-deck-name');
  const descEl = document.getElementById('jlpt-deck-modal-desc');
  const feedbackEl = document.getElementById('jlpt-import-feedback');

  if (!modal || !selectDeck) return;

  let count = 0;
  if (customItems) {
    count = customItems.length;
  } else {
    count = AppState.jlptSelectedIds.size;
  }

  if (count === 0) {
    alert('Vui lòng chọn ít nhất 1 mục JLPT trước.');
    return;
  }

  const catName = category === 'vocab' ? 'từ vựng' : (category === 'grammar' ? 'ngữ pháp' : 'Chữ Hán');
  if (descEl) {
    descEl.innerText = `Bạn đang chuẩn bị thêm ${count.toLocaleString()} ${catName} JLPT (${AppState.jlptLevel}) vào hệ thống Bộ thẻ Flashcard.`;
  }
  if (feedbackEl) feedbackEl.style.display = 'none';

  const decks = await getDecks();
  const defaultDeckName = `JLPT ${AppState.jlptLevel} - ${category === 'vocab' ? 'Từ vựng' : (category === 'grammar' ? 'Ngữ pháp' : 'Chữ Hán')}`;

  let optionsHtml = '';
  const hasLevelDeck = decks.some(d => d.name === defaultDeckName);
  if (hasLevelDeck) {
    optionsHtml += `<option value="${defaultDeckName}">⭐ Bộ thẻ "${defaultDeckName}" (Hiện có)</option>`;
  } else {
    optionsHtml += `<option value="${defaultDeckName}">✨ Tạo bộ thẻ mới: "${defaultDeckName}"</option>`;
  }

  optionsHtml += `<option disabled>──────────</option>`;
  decks.forEach(d => {
    if (d.name !== defaultDeckName) {
      optionsHtml += `<option value="${d.id}">${escapeHtml(d.name)}</option>`;
    }
  });

  optionsHtml += `<option value="__new__">➕ Tạo bộ thẻ tùy chỉnh khác...</option>`;
  selectDeck.innerHTML = optionsHtml;
  selectDeck.value = defaultDeckName;

  if (groupNewName) groupNewName.style.display = 'none';
  if (inputNewName) inputNewName.value = '';

  modal.style.display = 'flex';
}

async function handleJLPTConfirmAddToDeck() {
  const selectDeck = document.getElementById('select-jlpt-target-deck');
  const inputNewName = document.getElementById('input-jlpt-new-deck-name');
  const feedbackEl = document.getElementById('jlpt-import-feedback');
  const btnConfirm = document.getElementById('btn-confirm-jlpt-add-deck');

  if (!selectDeck) return;

  let targetDeckIdentifier = selectDeck.value;
  if (targetDeckIdentifier === '__new__') {
    const customName = (inputNewName ? inputNewName.value : '').trim();
    if (!customName) {
      alert('Vui lòng nhập tên cho bộ thẻ mới.');
      return;
    }
    targetDeckIdentifier = customName;
  }

  let itemsToProcess = [];
  if (currentDeckPickerCustomItems) {
    itemsToProcess = currentDeckPickerCustomItems;
  } else {
    const allCurrent = AppState.jlptFilteredWords || [];
    AppState.jlptSelectedIds.forEach(id => {
      const item = allCurrent.find(w => w.id === id);
      if (item) itemsToProcess.push(item);
    });
  }

  if (itemsToProcess.length === 0) {
    alert('Không tìm thấy mục hợp lệ để thêm.');
    return;
  }

  if (btnConfirm) btnConfirm.disabled = true;
  if (feedbackEl) {
    feedbackEl.style.display = 'block';
    feedbackEl.style.background = 'rgba(2, 132, 199, 0.15)';
    feedbackEl.style.color = '#0284c7';
    feedbackEl.innerText = `Đang xử lý ${itemsToProcess.length.toLocaleString()} mục... Vui lòng chờ.`;
  }

  try {
    const result = await addJLPTItemsToDeck(itemsToProcess, targetDeckIdentifier, currentDeckPickerCategory);
    if (result && result.success) {
      if (feedbackEl) {
        feedbackEl.style.background = 'rgba(16, 185, 129, 0.15)';
        feedbackEl.style.color = '#10b981';
        feedbackEl.innerText = `✅ Đã thêm thành công ${result.addedCount} thẻ mới (cập nhật ${result.updatedCount} thẻ) vào bộ thẻ "${result.deck.name}"!`;
      }

      await reloadAllData(false);
      renderJLPTView();

      setTimeout(() => {
        const modal = document.getElementById('modal-jlpt-deck-picker');
        if (modal) modal.style.display = 'none';
        if (btnConfirm) btnConfirm.disabled = false;
      }, 1200);
    } else {
      throw new Error(result ? result.message : 'Thất bại');
    }
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.style.background = 'rgba(239, 68, 68, 0.15)';
      feedbackEl.style.color = '#ef4444';
      feedbackEl.innerText = `❌ Lỗi: ${err.message}`;
    }
    if (btnConfirm) btnConfirm.disabled = false;
  }
}

async function handleJLPTStartFlashcard() {
  const count = AppState.jlptSelectedIds.size;
  if (count === 0) {
    alert('Vui lòng chọn ít nhất 1 từ vựng JLPT để bắt đầu ôn tập Flashcard.');
    return;
  }

  const wordsToReview = [];
  const allCurrent = AppState.jlptFilteredWords || [];
  AppState.jlptSelectedIds.forEach(id => {
    const item = allCurrent.find(w => w.id === id);
    if (item) wordsToReview.push(item);
  });

  if (wordsToReview.length === 0) return;

  const defaultDeckName = `JLPT ${AppState.jlptLevel} - Từ vựng`;
  try {
    await addJLPTItemsToDeck(wordsToReview, defaultDeckName, 'vocab');
    await reloadAllData(false);
  } catch (e) {
    console.warn('[Workspace] Lưu từ JLPT vào deck trước khi ôn tập warning:', e);
  }

  const cardsQueue = wordsToReview.map(item => {
    const existingCard = (AppState.allCards || []).find(c => (c.word === item.word || c.kanji === item.word));
    return {
      id: (existingCard && existingCard.id) || item.id,
      word: item.word,
      reading: item.reading,
      hanviet: item.hanviet,
      meaning: item.meaningVi || item.meaning || 'Chưa có nghĩa tiếng Việt',
      meaningVi: item.meaningVi || item.meaning,
      example: item.example,
      exampleMeaning: item.exampleMeaning || item.exampleEn,
      level: item.level,
      notes: `Từ vựng JLPT ${item.level}`,
      srs: existingCard ? existingCard.srs : { interval: 0, repetition: 0, easeFactor: 2.5, dueDate: Date.now(), state: 'new' }
    };
  });

  startReviewModeWithCustomQueue(cardsQueue, `JLPT ${AppState.jlptLevel} (${cardsQueue.length} từ)`);
}


