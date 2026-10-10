/**
 * JP Dictionary Chrome Extension - popup.js
 * 
 * Logic điều khiển chính của Dashboard Popup:
 * 1. Chuyển đổi các Tab (Tra cứu, Từ đã lưu, Cài đặt).
 * 2. Tự động kiểm tra và khởi tạo dữ liệu Từ điển (Lazy Seeding) vào IndexedDB.
 * 3. Tìm kiếm đa năng (Kanji, Kana, Romaji, Nghĩa) trên IndexedDB có Debounce (300ms).
 * 4. Hiển thị và quản lý danh sách từ vựng đã lưu (Storage).
 */

// Bộ dữ liệu từ điển mẫu ban đầu (Offline Seed)
const SEED_DICTIONARY = [
  { kanji: '日本語', kana: 'にほんご', romaji: 'nihongo', hanviet: 'Nhật Bản Ngữ', meaning: 'Tiếng Nhật, tiếng Nhật Bản.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '桜', kana: 'さくら', romaji: 'sakura', hanviet: 'Anh (Hoa Anh Đào)', meaning: 'Hoa anh đào - biểu tượng của đất nước Nhật Bản.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '東京', kana: 'とうきょう', romaji: 'tokyo', hanviet: 'Đông Kinh', meaning: 'Tokyo - thủ đô và là trung tâm kinh tế của Nhật Bản.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '先生', kana: 'せんせい', romaji: 'sensei', hanviet: 'Tiên Sinh', meaning: 'Thầy giáo, cô giáo, bác sĩ, hoặc người hướng dẫn.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '富士山', kana: 'ふじさん', romaji: 'fujisan', hanviet: 'Phú Sĩ Sơn', meaning: 'Núi Phú Sĩ - ngọn núi cao nhất và là biểu tượng của Nhật Bản.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: 'ありがとう', kana: 'ありがとう', romaji: 'arigatou', hanviet: 'Hữu Nạn (Ít dùng)', meaning: 'Lời bày tỏ sự cảm ơn (Cảm ơn bạn).', jlpt: 'N5', isCommon: true, partOfSpeech: 'Thán từ' },
  { kanji: '寿司', kana: 'すし', romaji: 'sushi', hanviet: 'Thọ Ty', meaning: 'Món cơm trộn giấm kết hợp hải sản sống của Nhật Bản.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '本', kana: 'ほん', romaji: 'hon', hanviet: 'Bản', meaning: 'Sách, tập vở; cơ sở, nguồn gốc.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '猫', kana: 'ねこ', romaji: 'neko', hanviet: 'Miêu', meaning: 'Con mèo.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '犬', kana: 'いぬ', romaji: 'inu', hanviet: 'Khuyển', meaning: 'Con chó.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '水', kana: 'みず', romaji: 'mizu', hanviet: 'Thủy', meaning: 'Nước uống, nước ngọt sinh hoạt.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '食べる', kana: 'たべる', romaji: 'taberu', hanviet: 'Thực', meaning: 'Ăn (dùng bữa, tiêu thụ thức ăn).', jlpt: 'N5', isCommon: true, partOfSpeech: 'Động từ nhóm 2 (Ichidan)' },
  { kanji: '飲む', kana: 'のむ', romaji: 'nomu', hanviet: 'Ẩm', meaning: 'Uống (nước, đồ uống, thuốc).', jlpt: 'N5', isCommon: true, partOfSpeech: 'Động từ nhóm 1 (Godan)' },
  { kanji: '学生', kana: 'がくせい', romaji: 'gakusei', hanviet: 'Học Sinh', meaning: 'Học sinh, sinh viên đang đi học.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '学校', kana: 'がっこう', romaji: 'gakkou', hanviet: 'Học Hiệu', meaning: 'Trường học, cơ sở giáo dục.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '友達', kana: 'ともだち', romaji: 'tomodachi', hanviet: 'Hữu Đạt', meaning: 'Bạn bè, người đồng hành, đồng chí.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '日本', kana: 'にほん', romaji: 'nihon', hanviet: 'Nhật Bản', meaning: 'Đất nước Nhật Bản (Đất nước Mặt trời mọc).', jlpt: 'N5', isCommon: true, partOfSpeech: 'Danh từ' },
  { kanji: '可愛い', kana: 'かわいい', romaji: 'kawaii', hanviet: 'Khả Ái', meaning: 'Đáng yêu, xinh xắn, dễ thương.', jlpt: 'N5', isCommon: true, partOfSpeech: 'Tính từ đuôi i' }
];

// Khởi tạo thực thể Database và quản lý trạng thái
const db = new JPEXDatabase();
let searchTimeout = null;

// Lắng nghe khi Popup mở ra
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupSearch();
  setupDatabase();
  setupSettingsTab();
  setupFlashcardAndExport();
  setupOcrButton();
});

/**
 * 1. Quản lý chuyển đổi các Tab trên Dashboard
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const sections = document.querySelectorAll('.tab-section');

  const switchTab = (activeTabId) => {
    tabs.forEach(t => {
      if (t.getAttribute('data-tab') === activeTabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    sections.forEach(s => {
      if (s.id === activeTabId) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    if (activeTabId === 'saved-tab') {
      initFolderFilter();
      loadAndRenderSavedWords();
    } else if (activeTabId === 'settings-tab') {
      updateDbStatusUI();
      setupSettingsTab();
    }
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const activeTabId = tab.getAttribute('data-tab');
      switchTab(activeTabId);
    });
  });

  // Tự động chuyển tab nếu được yêu cầu từ URL hoặc storage
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab === 'settings' || targetTab === 'settings-tab') {
    switchTab('settings-tab');
  } else {
    chrome.storage.local.get(['activePopupTab'], (res) => {
      if (res && res.activePopupTab) {
        switchTab(res.activePopupTab);
        chrome.storage.local.remove(['activePopupTab']);
      }
    });
  }
}

/**
 * 2. Khởi tạo và đồng bộ Database IndexedDB ngoại tuyến
 */
async function setupDatabase() {
  const dbStatus = document.getElementById('db-status');
  const btnInit = document.getElementById('btn-init-db');

  try {
    // Mở kết nối IndexedDB
    await db.open();
    
    // Đọc phiên bản dữ liệu hiện hành
    const version = await db.getDatabaseVersion();
    
    // Hàm nạp từ điển từ file local core_dict.json
    const loadCoreDictionary = async () => {
      if (dbStatus) dbStatus.innerText = 'Đang nạp từ điển offline...';
      if (btnInit) btnInit.disabled = true;

      try {
        const url = chrome.runtime.getURL('data/core_dict.json');
        const res = await fetch(url);
        const data = await res.json();
        
        // Khởi tạo từ điển với version 2
        await db.initializeDictionary(data, 2);
        if (dbStatus) dbStatus.innerText = `Phiên bản 2.0 (Offline sẵn sàng - ${data.length} từ)`;
        if (btnInit) btnInit.style.display = 'none';
        triggerSearch();
      } catch (err) {
        console.warn('[Popup] Không đọc được core_dict.json, fallback nạp SEED_DICTIONARY:', err);
        await db.initializeDictionary(SEED_DICTIONARY, 2);
        if (dbStatus) dbStatus.innerText = 'Phiên bản 2.0 (Sẵn sàng)';
        if (btnInit) btnInit.style.display = 'none';
      }
    };

    if (version >= 2) {
      if (dbStatus) dbStatus.innerText = `Phiên bản ${version}.0 (Offline sẵn sàng)`;
      if (btnInit) btnInit.style.display = 'none';
    } else {
      // Tự động nâng cấp lên gói Offline mới nhất
      await loadCoreDictionary();
    }

    // Sự kiện click nút tải thủ công (nếu cần tải lại)
    if (btnInit) {
      btnInit.addEventListener('click', async () => {
        await loadCoreDictionary();
      });
    }

  } catch (error) {
    console.error('[Popup] Lỗi quản lý Database:', error);
    if (dbStatus) dbStatus.innerText = 'Lỗi kết nối';
  }
}

/**
 * Cập nhật trạng thái database hiển thị trong thẻ Cài đặt
 */
async function updateDbStatusUI() {
  const dbStatus = document.getElementById('db-status');
  const btnInit = document.getElementById('btn-init-db');
  const version = await db.getDatabaseVersion();
  if (version > 0) {
    if (dbStatus) dbStatus.innerText = `Phiên bản ${version}.0 (Offline sẵn sàng)`;
    if (btnInit) {
      btnInit.innerText = 'Đồng bộ lại từ điển';
      btnInit.style.display = 'inline-block';
    }
  } else {
    if (dbStatus) dbStatus.innerText = 'Chưa có dữ liệu';
    if (btnInit) {
      btnInit.innerText = 'Nạp từ điển offline';
      btnInit.style.display = 'inline-block';
    }
  }
}

/**
 * Cấu hình các tùy chọn trong thẻ Cài đặt (Bật/tắt dịch tự động khi bôi đen, Hover, Ngôn ngữ)
 */
async function setupSettingsTab() {
  const autoTranslateToggle = document.getElementById('toggle-auto-translate');
  const hoverLookupToggle = document.getElementById('toggle-hover-lookup');
  const hoverKeySelect = document.getElementById('select-hover-key');
  const targetLangSelect = document.getElementById('select-target-lang');
  if (!autoTranslateToggle) return;

  try {
    const settings = await getAppSettings();
    autoTranslateToggle.checked = !!settings.autoTranslateOnSelect;
    if (hoverLookupToggle) {
      hoverLookupToggle.checked = settings.hoverLookupEnabled !== false;
    }
    if (hoverKeySelect) {
      hoverKeySelect.value = settings.hoverKey || 'Shift';
    }
    if (targetLangSelect) {
      targetLangSelect.value = settings.targetLang || 'both';
    }

    // Tránh gán lặp lại listener
    if (!autoTranslateToggle.dataset.hasListener) {
      autoTranslateToggle.dataset.hasListener = 'true';
      autoTranslateToggle.addEventListener('change', async (e) => {
        await updateAppSettings({ autoTranslateOnSelect: e.target.checked });
        console.log('[JP-Dict Popup] Đã đổi trạng thái tự động dịch:', e.target.checked);
      });
    }

    if (hoverLookupToggle && !hoverLookupToggle.dataset.hasListener) {
      hoverLookupToggle.dataset.hasListener = 'true';
      hoverLookupToggle.addEventListener('change', async (e) => {
        await updateAppSettings({ hoverLookupEnabled: e.target.checked });
        console.log('[JP-Dict Popup] Đã đổi trạng thái Hover tra nhanh:', e.target.checked);
      });
    }

    if (hoverKeySelect && !hoverKeySelect.dataset.hasListener) {
      hoverKeySelect.dataset.hasListener = 'true';
      hoverKeySelect.addEventListener('change', async (e) => {
        await updateAppSettings({ hoverKey: e.target.value });
        console.log('[JP-Dict Popup] Đã đổi phím tắt Hover:', e.target.value);
      });
    }

    if (targetLangSelect && !targetLangSelect.dataset.hasListener) {
      targetLangSelect.dataset.hasListener = 'true';
      targetLangSelect.addEventListener('change', async (e) => {
        await updateAppSettings({ targetLang: e.target.value });
        console.log('[JP-Dict Popup] Đã đổi ngôn ngữ dịch:', e.target.value);
      });
    }
  } catch (err) {
    console.error('[JP-Dict Popup] Lỗi nạp cài đặt:', err);
  }
}

/**
 * 3. Xử lý tìm kiếm đa năng tại tab Tra cứu
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    triggerSearch();
  });
}

function triggerSearch() {
  const searchInput = document.getElementById('search-input');
  const query = searchInput.value.trim();
  
  clearTimeout(searchTimeout);

  if (!query) {
    renderEmptySearchState();
    return;
  }

  // Thiết lập debounce 300ms để tối ưu hiệu năng gõ phím
  searchTimeout = setTimeout(async () => {
    try {
      // 1. Tìm kiếm nhanh trong Database Offline trước
      const offlineResults = await db.search(query);
      
      // Đảm bảo không render nếu từ khóa trong ô nhập liệu đã thay đổi trước khi tìm kiếm offline hoàn tất
      const currentQuery1 = searchInput.value.trim();
      if (currentQuery1 !== query) return;
      
      renderSearchResults(offlineResults);

      // 2. Kích hoạt tìm kiếm Online song song (qua background script gửi tới Jisho & Translate API)
      chrome.runtime.sendMessage({ action: 'translate', text: query }, (response) => {
        if (chrome.runtime.lastError) {
          // Lỗi kết nối nền (chỉ sử dụng offline)
          return;
        }

        // Đảm bảo không render đè nếu người dùng đã gõ sang từ khóa khác trong thời gian chờ API phản hồi
        const currentQuery2 = searchInput.value.trim();
        if (currentQuery2 !== query) {
          return; // Discard stale response
        }

        if (response && response.success && response.data) {
          const onlineItem = response.data;
          
          // Tránh hiển thị trùng lặp nếu từ online đã có trong offlineResults
          const exists = offlineResults.some(w => w.kanji.toLowerCase() === onlineItem.kanji.toLowerCase());
          if (!exists) {
            const finalResults = [...offlineResults];
            finalResults.unshift(onlineItem); // Đẩy từ online lên trên cùng
            renderSearchResults(finalResults);
          }
        }
      });
      
    } catch (err) {
      console.error('[Popup] Lỗi trong quá trình tìm kiếm:', err);
      const resultsContainer = document.getElementById('search-results');
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Lỗi truy vấn dữ liệu</h3>
          <p>Có lỗi xảy ra khi truy vấn dữ liệu từ điển: ${err.message || err}</p>
        </div>
      `;
    }
  }, 300);
}

/**
 * Hiển thị giao diện chào mừng/trống khi chưa gõ từ khóa
 */
function renderEmptySearchState() {
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📖</div>
      <h3>Sẵn sàng tra cứu</h3>
      <p>Nhập từ tiếng Nhật hoặc nghĩa tiếng Việt để bắt đầu tìm kiếm ngoại tuyến siêu tốc.</p>
    </div>
  `;
}

/**
 * Vẽ danh sách kết quả tìm kiếm lên giao diện
 */
async function renderSearchResults(results) {
  const resultsContainer = document.getElementById('search-results');
  
  if (results.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Không tìm thấy từ</h3>
        <p>Thử tìm kiếm bằng Kanji, Hiragana, Romaji khác hoặc nghĩa tiếng Việt tương ứng.</p>
      </div>
    `;
    return;
  }

  resultsContainer.innerHTML = '';
  
  // Lấy toàn bộ từ đã lưu một lần để kiểm tra
  const savedWords = await getSavedWords();

  for (const item of results) {
    const card = document.createElement('div');
    card.className = 'word-card';

    // Tạo các badge hiển thị
    let badgesHtml = '';
    if (item.isCommon) {
      badgesHtml += `<span class="badge badge-common">Phổ biến</span>`;
    }
    if (item.jlpt) {
      badgesHtml += `<span class="badge badge-jlpt">${item.jlpt}</span>`;
    }

    // Nhãn từ loại
    const posHtml = item.partOfSpeech ? `<div class="card-pos">${item.partOfSpeech}</div>` : '';

    // Nút Lưu/Bỏ lưu từ
    const savedWord = savedWords.find(w => w.kanji === item.kanji);
    const isSaved = !!savedWord;
    const starClass = isSaved ? 'saved' : '';
    const starText = isSaved ? '★' : '☆';
    const starTitle = isSaved ? 'Xóa khỏi danh sách lưu' : 'Lưu vào danh sách';

    const romajiPart = item.romaji ? ` (${item.romaji})` : '';
    const readingVal = item.kana || item.reading || 'Đang cập nhật...';

    let wordsBreakdownHtml = '';
    if (item.words && item.words.length > 0) {
      const itemsHtml = item.words.map(w => {
        const readingSpan = w.reading ? `<span style="font-weight: 400; color: var(--text-light); font-size: 10px; margin-left: 4px;">(${w.reading})</span>` : '';
        return `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; background: var(--bg-secondary); padding: 6px 8px; border-radius: var(--radius-sm); font-size: 11.5px; margin-top: 4px; border: 1px solid var(--border); gap: 8px;">
            <div style="font-weight: 700; color: var(--text-primary); white-space: nowrap;">
              <span>${w.kanji}</span>${readingSpan}
            </div>
            <div style="color: var(--text-secondary); text-align: right; font-weight: 600; word-break: break-word;" title="${w.meaningVi}">${w.meaningVi}</div>
          </div>
        `;
      }).join('');
      
      wordsBreakdownHtml = `
        <div class="card-divider"></div>
        <div class="card-info-group">
          <div class="card-label">Phân tách từng từ</div>
          <div style="display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; margin-top: 4px;">${itemsHtml}</div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <span class="card-kanji">${item.kanji}</span>
        <button class="card-audio-btn" title="Phát âm" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 0 4px; color: #3b82f6; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.1s;">🔊</button>
        <div class="card-badges">${badgesHtml}</div>
      </div>
      <div class="card-reading">
        <span class="card-label">Cách đọc:</span>
        <span class="card-reading-val">${readingVal}${romajiPart}</span>
      </div>
      ${posHtml}
      <div class="card-divider"></div>
      <div class="card-info-group">
        <div class="card-label">Âm Hán Việt</div>
        <div class="card-hanviet-val">${item.hanviet}</div>
      </div>
      <div class="card-info-group">
        <div class="card-label">Nghĩa tiếng Việt</div>
        <div class="card-meaning-val">${item.meaning}</div>
      </div>
      ${wordsBreakdownHtml}
      <select class="card-folder-select" title="Chọn thư mục lưu từ"></select>
      <button class="card-action-btn ${starClass}" title="${starTitle}">${starText}</button>
    `;

    // Lắng nghe sự kiện phát âm thanh (Phát âm theo cách đọc Kana để chính xác 100%)
    const audioBtn = card.querySelector('.card-audio-btn');
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(item.kana || item.reading || item.kanji);
    });

    const actionBtn = card.querySelector('.card-action-btn');
    const folderSelect = card.querySelector('.card-folder-select');

    // Hàm hỗ trợ nạp thư mục cục bộ của thẻ kết quả tìm kiếm
    const populateCardFolderSelect = async (selectedFolder = "Mặc định") => {
      const folders = await getSavedFolders();
      folderSelect.innerHTML = '';
      folders.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.innerText = f;
        if (f === selectedFolder) option.selected = true;
        folderSelect.appendChild(option);
      });
      // Tạo thư mục mới option
      const newOption = document.createElement('option');
      newOption.value = '__new_folder__';
      newOption.innerText = '+ Tạo thư mục...';
      folderSelect.appendChild(newOption);
    };

    // Khởi tạo hiển thị dropdown thư mục
    if (isSaved) {
      folderSelect.style.display = 'block';
      populateCardFolderSelect(savedWord.folder || "Mặc định");
    } else {
      folderSelect.style.display = 'none';
    }

    // Lắng nghe sự kiện click lưu từ trực tiếp trên Card của Popup
    actionBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const saved = actionBtn.classList.contains('saved');
      if (saved) {
        await deleteWord(item.kanji);
        actionBtn.classList.remove('saved');
        actionBtn.innerHTML = '☆';
        actionBtn.title = 'Lưu vào danh sách';
        folderSelect.style.display = 'none';
      } else {
        const defaultFolder = "Mặc định";
        await saveWord(item, defaultFolder);
        actionBtn.classList.add('saved');
        actionBtn.innerHTML = '★';
        actionBtn.title = 'Xóa khỏi danh sách lưu';
        
        folderSelect.style.display = 'block';
        await populateCardFolderSelect(defaultFolder);
      }
    });

    // Lắng nghe sự kiện đổi thư mục trên Card của Popup
    folderSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      const val = folderSelect.value;
      if (val === '__new_folder__') {
        const newFolderName = prompt('Nhập tên thư mục mới:');
        if (newFolderName && newFolderName.trim()) {
          const cleanName = newFolderName.trim();
          await createFolder(cleanName);
          await updateWordFolder(item.kanji, cleanName);
          await populateCardFolderSelect(cleanName);
        } else {
          // Khôi phục về thư mục hiện tại
          const currentWords = await getSavedWords();
          const curWord = currentWords.find(w => w.kanji === item.kanji);
          await populateCardFolderSelect(curWord ? curWord.folder : "Mặc định");
        }
      } else {
        await updateWordFolder(item.kanji, val);
      }
    });

    resultsContainer.appendChild(card);
  }
}

/**
 * 4. Quản lý hiển thị và xóa từ tại Tab "Từ đã lưu"
 */
async function loadAndRenderSavedWords() {
  const savedContainer = document.getElementById('saved-words-list');
  const selectFilter = document.getElementById('select-folder-filter');
  const selectedFolder = selectFilter ? selectFilter.value : '__all__';
  
  const savedWords = await getSavedWords();
  
  // Lọc danh sách theo thư mục được chọn
  const filteredWords = selectedFolder === '__all__'
    ? savedWords
    : savedWords.filter(w => (w.folder || "Mặc định") === selectedFolder);

  if (filteredWords.length === 0) {
    savedContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <h3>Không có từ vựng nào</h3>
        <p>${selectedFolder === '__all__' ? 'Bôi đen từ tiếng Nhật khi duyệt web và click Ngôi sao để lưu từ tại đây.' : `Thư mục "${selectedFolder}" hiện tại đang trống.`}</p>
      </div>
    `;
    return;
  }

  savedContainer.innerHTML = '';

  filteredWords.forEach(item => {
    const card = document.createElement('div');
    card.className = 'word-card';

    let badgesHtml = '';
    if (item.isCommon) {
      badgesHtml += `<span class="badge badge-common">Phổ biến</span>`;
    }
    if (item.jlpt) {
      badgesHtml += `<span class="badge badge-jlpt">${item.jlpt}</span>`;
    }

    const posHtml = item.partOfSpeech ? `<div class="card-pos">${item.partOfSpeech}</div>` : '';
    const currentFolder = item.folder || "Mặc định";

    card.innerHTML = `
      <div class="card-header">
        <span class="card-kanji">${item.kanji}</span>
        <button class="card-audio-btn" title="Phát âm" style="background: none; border: none; cursor: pointer; font-size: 14px; padding: 0 4px; color: #3b82f6; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.1s;">🔊</button>
        <div class="card-badges">${badgesHtml}</div>
      </div>
      <div class="card-reading">
        <span class="card-label">Cách đọc:</span>
        <span class="card-reading-val">${item.reading || item.kana}</span>
      </div>
      ${posHtml}
      <div class="card-divider"></div>
      <div class="card-info-group">
        <div class="card-label">Thư mục</div>
        <div class="card-folder-val" style="font-size: 11px; font-weight: 600; color: var(--primary);">📁 ${currentFolder}</div>
      </div>
      <div class="card-info-group">
        <div class="card-label">Âm Hán Việt</div>
        <div class="card-hanviet-val">${item.hanviet}</div>
      </div>
      <div class="card-info-group">
        <div class="card-label">Nghĩa tiếng Việt</div>
        <div class="card-meaning-val">${item.meaning}</div>
      </div>
      <button class="card-action-btn delete-btn" title="Xóa từ vựng này">🗑️</button>
    `;

    // Lắng nghe sự kiện phát âm thanh (Phát âm theo cách đọc Kana để chính xác 100%)
    const audioBtn = card.querySelector('.card-audio-btn');
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPronunciation(item.reading || item.kana || item.kanji);
    });

    const deleteBtn = card.querySelector('.card-action-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteWord(item.kanji);
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      card.style.transition = '0.2s ease';
      setTimeout(() => {
        loadAndRenderSavedWords(); // Render lại danh sách
        initFolderFilter(); // Cập nhật lại bộ lọc nếu cần
      }, 200);
    });

    savedContainer.appendChild(card);
  });
}

/**
 * Khởi tạo bộ lọc thư mục trên Tab Từ đã lưu
 */
async function initFolderFilter() {
  const selectFilter = document.getElementById('select-folder-filter');
  const btnRename = document.getElementById('btn-rename-folder');
  const btnDelete = document.getElementById('btn-delete-folder');
  if (!selectFilter) return;

  const folders = await getSavedFolders();
  const currentSelected = selectFilter.value || '__all__';

  selectFilter.innerHTML = '<option value="__all__">Tất cả</option>';
  
  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder;
    option.innerText = folder;
    if (folder === currentSelected) {
      option.selected = true;
    }
    selectFilter.appendChild(option);
  });
  
  // Hàm cập nhật trạng thái hiển thị của các nút sửa/xóa thư mục
  const updateFolderButtonsVisibility = () => {
    const selectedVal = selectFilter.value;
    // Chỉ hiển thị nút sửa/xóa nếu là thư mục tùy chỉnh (không phải "Tất cả" hay "Mặc định")
    if (selectedVal !== '__all__' && selectedVal !== 'Mặc định') {
      if (btnRename) btnRename.style.display = 'inline-block';
      if (btnDelete) btnDelete.style.display = 'inline-block';
    } else {
      if (btnRename) btnRename.style.display = 'none';
      if (btnDelete) btnDelete.style.display = 'none';
    }
  };
  
  updateFolderButtonsVisibility();

  selectFilter.removeEventListener('change', onFolderFilterChange);
  selectFilter.addEventListener('change', () => {
    updateFolderButtonsVisibility();
    onFolderFilterChange();
  });
  
  // Cài đặt sự kiện Đổi tên thư mục
  if (btnRename) {
    btnRename.onclick = async (e) => {
      e.stopPropagation();
      const currentFolder = selectFilter.value;
      if (currentFolder === '__all__' || currentFolder === 'Mặc định') return;
      
      const newName = prompt(`Nhập tên mới cho thư mục "${currentFolder}":`, currentFolder);
      if (newName && newName.trim() && newName.trim() !== currentFolder) {
        const cleanName = newName.trim();
        // Kiểm tra trùng lặp
        const existingFolders = await getSavedFolders();
        if (existingFolders.includes(cleanName)) {
          alert('Tên thư mục đã tồn tại!');
          return;
        }
        await renameFolder(currentFolder, cleanName);
        selectFilter.value = cleanName; // Chọn thư mục mới
        await initFolderFilter();
        loadAndRenderSavedWords();
      }
    };
  }
  
  // Cài đặt sự kiện Xóa thư mục
  if (btnDelete) {
    btnDelete.onclick = async (e) => {
      e.stopPropagation();
      const currentFolder = selectFilter.value;
      if (currentFolder === '__all__' || currentFolder === 'Mặc định') return;
      
      const confirmDelete = confirm(`Bạn có chắc chắn muốn xóa thư mục "${currentFolder}"?\nTất cả từ vựng trong thư mục này sẽ được chuyển về thư mục "Mặc định".`);
      if (confirmDelete) {
        await deleteFolder(currentFolder);
        selectFilter.value = '__all__'; // Reset lọc về Tất cả
        await initFolderFilter();
        loadAndRenderSavedWords();
      }
    };
  }
}

function onFolderFilterChange() {
  loadAndRenderSavedWords();
}

/**
 * Phát âm thanh của từ vựng tiếng Nhật (Hybrid: Google TTS & Web Speech API fallback)
 */
function playPronunciation(text) {
  const cleanText = text.replace(/\([^)]*\)/g, '').trim(); // Bỏ phần giải nghĩa phụ trong ngoặc
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;
  
  const audio = new Audio(googleTtsUrl);
  audio.play().catch((err) => {
    console.warn('[Popup] Không phát được Google TTS (do CSP). Dùng Web Speech API:', err);
    
    // Fallback sang Web Speech API (Không bị chặn bởi CSP)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85; // Tốc độ vừa phải
      window.speechSynthesis.speak(utterance);
    } else {
      console.error('[Popup] Trình duyệt không hỗ trợ Web Speech API.');
    }
  });
}

/**
 * 6. Quản lý tính năng Ôn tập Flashcard (SRS) & Xuất dữ liệu CSV (Excel)
 */
let flashcardDeck = [];
let flashcardIndex = 0;
let isFlipped = false;

function setupFlashcardAndExport() {
  const btnPractice = document.getElementById('btn-practice-flashcard');
  const btnExport = document.getElementById('btn-export-csv');
  const flashcardContainer = document.getElementById('flashcard-container');
  const btnCloseFlashcard = document.getElementById('btn-close-flashcard');
  const savedWordsList = document.getElementById('saved-words-list');
  const flashcardCard = document.getElementById('flashcard-card');
  const flashcardFront = document.getElementById('flashcard-front');
  const flashcardBack = document.getElementById('flashcard-back');
  const fcKanji = document.getElementById('fc-kanji');
  const fcReading = document.getElementById('fc-reading');
  const fcHanviet = document.getElementById('fc-hanviet');
  const fcMeaning = document.getElementById('fc-meaning');
  const fcCounter = document.getElementById('flashcard-counter');
  const fcAudioBtn = document.getElementById('fc-audio-btn');
  const btnAgain = document.getElementById('fc-btn-again');
  const btnGood = document.getElementById('fc-btn-good');
  const selectFilter = document.getElementById('select-folder-filter');

  const updateCardView = () => {
    if (flashcardDeck.length === 0) {
      if (flashcardContainer) flashcardContainer.style.display = 'none';
      if (savedWordsList) savedWordsList.style.display = 'block';
      return;
    }

    if (flashcardIndex >= flashcardDeck.length) {
      // Hoàn tất lượt ôn tập
      flashcardFront.innerHTML = `
        <div style="font-size: 26px; margin-bottom: 6px;">🎉</div>
        <div style="font-size: 16px; font-weight: 700; color: #10b981; margin-bottom: 4px;">Xuất sắc!</div>
        <div style="font-size: 12px; color: var(--text-secondary);">Bạn đã hoàn thành lượt ôn tập này.</div>
      `;
      flashcardBack.style.display = 'none';
      flashcardFront.style.display = 'block';
      fcCounter.innerText = 'Hoàn thành!';
      btnAgain.innerText = '🔄 Ôn lại';
      btnGood.innerText = '✕ Kết thúc';
      return;
    }

    const currentWord = flashcardDeck[flashcardIndex];
    fcCounter.innerText = `${flashcardIndex + 1} / ${flashcardDeck.length}`;
    fcKanji.innerText = currentWord.kanji;
    fcReading.innerText = currentWord.reading || currentWord.kana || '';
    fcHanviet.innerText = currentWord.hanviet ? `HÁN VIỆT: ${currentWord.hanviet}` : '';
    fcMeaning.innerText = currentWord.meaning || currentWord.meaningVi || 'Chưa rõ nghĩa';

    isFlipped = false;
    flashcardFront.style.display = 'block';
    flashcardBack.style.display = 'none';
    btnAgain.innerText = '❌ Chưa nhớ';
    btnGood.innerText = '✅ Đã nhớ';
  };

  const flipCard = () => {
    if (flashcardIndex >= flashcardDeck.length) return;
    isFlipped = !isFlipped;
    if (isFlipped) {
      flashcardFront.style.display = 'none';
      flashcardBack.style.display = 'block';
    } else {
      flashcardFront.style.display = 'block';
      flashcardBack.style.display = 'none';
    }
  };

  if (flashcardCard) {
    flashcardCard.addEventListener('click', (e) => {
      if (e.target === fcAudioBtn || fcAudioBtn.contains(e.target)) return;
      flipCard();
    });
  }

  if (fcAudioBtn) {
    fcAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentWord = flashcardDeck[flashcardIndex];
      if (currentWord) {
        playPronunciation(currentWord.reading || currentWord.kana || currentWord.kanji);
      }
    });
  }

  if (btnAgain) {
    btnAgain.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flashcardIndex >= flashcardDeck.length) {
        flashcardIndex = 0;
        updateCardView();
        return;
      }
      // Đẩy thẻ chưa thuộc về cuối lượt học để ôn lại
      const missed = flashcardDeck[flashcardIndex];
      flashcardDeck.push(missed);
      flashcardIndex++;
      updateCardView();
    });
  }

  if (btnGood) {
    btnGood.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flashcardIndex >= flashcardDeck.length) {
        flashcardContainer.style.display = 'none';
        savedWordsList.style.display = 'block';
        return;
      }
      flashcardIndex++;
      updateCardView();
    });
  }

  if (btnPractice) {
    btnPractice.addEventListener('click', async (e) => {
      e.stopPropagation();
      const allWords = await getSavedWords();
      const currentFilter = selectFilter ? selectFilter.value : '__all__';
      let filtered = (currentFilter === '__all__')
        ? allWords
        : allWords.filter(w => (w.folder || 'Mặc định') === currentFilter);

      if (filtered.length === 0) {
        alert('Chưa có từ vựng nào trong thư mục này để ôn tập! Hãy tra cứu và bấm dấu Sao (★) để lưu từ.');
        return;
      }

      // Xáo trộn ngẫu nhiên bộ thẻ (Shuffle)
      flashcardDeck = [...filtered].sort(() => Math.random() - 0.5);
      flashcardIndex = 0;
      savedWordsList.style.display = 'none';
      flashcardContainer.style.display = 'block';
      updateCardView();
    });
  }

  if (btnCloseFlashcard) {
    btnCloseFlashcard.addEventListener('click', (e) => {
      e.stopPropagation();
      flashcardContainer.style.display = 'none';
      savedWordsList.style.display = 'block';
    });
  }

  // Xuất file CSV cho Excel
  if (btnExport) {
    btnExport.addEventListener('click', async (e) => {
      e.stopPropagation();
      const allWords = await getSavedWords();
      const currentFilter = selectFilter ? selectFilter.value : '__all__';
      let wordsToExport = (currentFilter === '__all__')
        ? allWords
        : allWords.filter(w => (w.folder || 'Mặc định') === currentFilter);

      if (wordsToExport.length === 0) {
        alert('Không có từ vựng nào trong thư mục này để xuất!');
        return;
      }

      // Tạo chuỗi CSV có UTF-8 BOM (\uFEFF) để Excel mở không bị lỗi font tiếng Việt/tiếng Nhật
      let csvContent = '\uFEFFKanji,Cách đọc (Kana),Âm Hán Việt,Giải nghĩa,Thư mục,JLPT\n';
      wordsToExport.forEach(w => {
        const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
        const kanji = escapeCsv(w.kanji);
        const kana = escapeCsv(w.reading || w.kana || '');
        const hv = escapeCsv(w.hanviet || '');
        const meaning = escapeCsv(w.meaning || w.meaningVi || '');
        const folder = escapeCsv(w.folder || 'Mặc định');
        const jlpt = escapeCsv(w.jlpt || '');
        csvContent += `${kanji},${kana},${hv},${meaning},${folder},${jlpt}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const folderSlug = currentFilter === '__all__' ? 'tat_ca' : currentFilter.replace(/[\s/]/g, '_');
      link.setAttribute('download', `TuVung_JPEX_${folderSlug}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }
}


  // Nạp & lưu cài đặt Furigana & Phím nóng
  const toggleFurigana = document.getElementById('toggle-furigana');
  const selectFuriganaHotkey = document.getElementById('select-furigana-hotkey');

  if (typeof getAppSettings === 'function') {
    getAppSettings().then(settings => {
      if (toggleFurigana) toggleFurigana.checked = !!settings.furiganaEnabled;
      if (selectFuriganaHotkey && settings.furiganaHotkey) selectFuriganaHotkey.value = settings.furiganaHotkey;
    });
  }

  if (toggleFurigana) {
    toggleFurigana.addEventListener('change', async () => {
      if (typeof updateAppSettings === 'function') {
        await updateAppSettings({ furiganaEnabled: toggleFurigana.checked });
      }
    });
  }

  if (selectFuriganaHotkey) {
    selectFuriganaHotkey.addEventListener('change', async () => {
      if (typeof updateAppSettings === 'function') {
        await updateAppSettings({ furiganaHotkey: selectFuriganaHotkey.value });
      }
    });
  }

/**
 * Nút kích hoạt Chụp vùng màn hình OCR từ Header
 */
function setupOcrButton() {
  const ocrBtn = document.getElementById('btn-header-ocr');
  if (ocrBtn) {
    ocrBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'startScreenOcr' });
          window.close();
        }
      });
    });
  }
}
