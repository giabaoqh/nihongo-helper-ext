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
  autoPlayAudio: false
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
    saved: 'Danh sách từ đã lưu',
    decks: 'Quản lý Bộ thẻ Flashcard',
    'deck-detail': AppState.activeDeck ? AppState.activeDeck.name : 'Chi tiết bộ thẻ',
    deck_detail: AppState.activeDeck ? AppState.activeDeck.name : 'Chi tiết bộ thẻ',
    review: 'Trung tâm Ôn tập SRS',
    test: 'Kiểm tra trắc nghiệm',
    stats: 'Thống kê tiến độ ôn tập',
    settings: 'Cài đặt & Sao lưu dữ liệu'
  };
  if (pageTitle) {
    pageTitle.innerText = titles[viewName] || titles[normalizedView] || 'Không gian học tập';
  }

  // Render lại nội dung tương ứng
  if (normalizedView === 'overview') renderOverview();
  else if (normalizedView === 'decks') renderDecksView();
  else if (normalizedView === 'saved') renderSavedWordsView();
  else if (normalizedView === 'review') renderSrsHubView();
  else if (normalizedView === 'stats') renderStatsView();
  else if (normalizedView === 'test') setupQuizView();
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
  const btnBackToDecks = document.getElementById('btn-back-to-decks');
  const btnStartReviewThisDeck = document.getElementById('btn-start-review-this-deck');
  const btnEditThisDeck = document.getElementById('btn-edit-this-deck');
  const btnDeleteThisDeck = document.getElementById('btn-delete-this-deck');
  const btnExportThisDeck = document.getElementById('btn-export-this-deck');

  if (btnCreateDeck) btnCreateDeck.onclick = () => openDeckModal();
  if (btnBannerNewDeck) btnBannerNewDeck.onclick = () => openDeckModal();
  if (btnViewAllDecks) btnViewAllDecks.onclick = () => switchView('decks');
  if (btnBannerReview) btnBannerReview.onclick = () => startReviewMode(null);
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
