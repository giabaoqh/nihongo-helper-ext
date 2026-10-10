/**
 * JP Dictionary Chrome Extension - content_script.js
 * 
 * Nội dung file này thực hiện luồng UX hoàn chỉnh:
 * 1. Lắng nghe sự kiện mouseup để phát hiện khi người dùng kết thúc bôi đen văn bản.
 * 2. Lọc chỉ xử lý nếu văn bản có chứa ký tự tiếng Nhật (Kanji, Hiragana, Katakana).
 * 3. Tính toán tọa độ chính xác của đoạn text và hiển thị Floating Icon ngay cạnh đó.
 * 4. Xử lý sự kiện click vào Floating Icon -> Ẩn icon và hiển thị Tooltip UI (Shadow DOM) ở trạng thái Loading.
 * 5. Gửi thông điệp qua background.js để gọi các API Jisho, Google Translate và Thi Viện lấy kết quả thật.
 * 6. Hiển thị đầy đủ thông tin tra cứu (Kanji, Hán Việt, Cách đọc, Nghĩa tiếng Việt, JLPT, Phổ biến, Từ loại).
 * 7. Tích hợp nút ghim/lưu từ (Gold Star Button) gọi hàm lưu trữ trong storage.js vào chrome.storage.local.
 * 8. Xử lý sự kiện click ra ngoài hoặc click nút "X" để đóng nhanh.
 */

// Biểu thức chính quy phát hiện ký tự tiếng Nhật
const JAPANESE_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/;

// ========================================================
// MỞ KHÓA BÔI ĐEN TRÊN CÁC TRANG WEB CHỐNG COPY / CHỐNG CHỌN
// ========================================================
function unlockTextSelectionOnProtectedPages() {
  try {
    const style = document.createElement('style');
    style.id = 'jpex-unlock-selection-style';
    style.textContent = `
      body, html, main, article, section, p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, a, b, strong, em, i, ruby, rt {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    // Chặn website hủy sự kiện chọn văn bản (selectstart)
    window.addEventListener('selectstart', (e) => {
      e.stopPropagation();
    }, true);

    // Khôi phục menu chuột phải nếu bị web chặn
    window.addEventListener('contextmenu', (e) => {
      e.stopPropagation();
    }, true);
  } catch (e) {}
}
unlockTextSelectionOnProtectedPages();


/**
 * Loại bỏ các loại dấu ngoặc, dấu câu tiếng Nhật/tiếng Anh ở đầu và cuối văn bản bôi đen
 * để giúp các công cụ tra cứu (Jisho, Database) khớp từ chuẩn xác 100%.
 */
/**
 * Loại bỏ các loại dấu ngoặc, dấu câu tiếng Nhật/tiếng Anh ở đầu và cuối văn bản bôi đen
 * Hỗ trợ khoảng trắng toàn giác (Full-width space \u3000)
 */
function cleanSelectedText(text) {
  if (!text) return '';
  return text
    .replace(/^[\s\u3000「」『』【】（）()\[\]{}、。，．,.!！？?・::：\-\/\\|_“”"’‘]+|[\s\u3000「」『』【】（）()\[\]{}、。，．,.!！？?・::：\-\/\\|_“”"’‘]+$/g, '')
    .trim();
}

/**
 * Trích xuất văn bản sạch từ vùng bôi đen (loại bỏ hoàn toàn thẻ furigana <rt> và <rp>)
 * Khắc phục triệt để lỗi bị nhân đôi chữ (như "学校がっこう") trên các trang web có phiên âm
 */
function getCleanSelectedText(selection) {
  if (!selection || selection.rangeCount === 0) return '';
  try {
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    // Loại bỏ thẻ Furigana <rt> và <rp>
    const furiganaEls = container.querySelectorAll('rt, rp');
    furiganaEls.forEach(el => el.remove());

    const text = container.textContent || container.innerText || '';
    if (text && text.trim()) {
      return cleanSelectedText(text);
    }
  } catch (err) {
    console.warn('[JP-Dict] Không phân tách được DOM Selection, fallback selection.toString():', err);
  }

  return cleanSelectedText(selection.toString());
}

// Lưu trữ các đối tượng UI đang hiển thị
// Lưu trữ các đối tượng UI đang hiển thị
let activeFloatingIcon = null;
let activeTooltipHost = null;

// Quản lý trạng thái Dịch tự động khi bôi đen & Tra từ bằng Hover
let isAutoTranslateEnabled = false;
let isHoverLookupEnabled = true;
let hoverKey = 'Shift';
let furiganaHotkey = 'Alt+F';
let isFuriganaActive = false;
let compoundWordsCache = null;
let kanjiReadingsCache = null;

// Bộ nhớ đệm tra cứu phía Client (0ms khi tra lại từ vừa xem)
const CLIENT_LOOKUP_CACHE = new Map();
const MAX_CLIENT_CACHE = 300;

// Đọc cài đặt ban đầu từ storage
if (typeof getAppSettings === 'function') {
  getAppSettings().then(settings => {
    isAutoTranslateEnabled = !!settings.autoTranslateOnSelect;
    isHoverLookupEnabled = settings.hoverLookupEnabled !== false;
    hoverKey = settings.hoverKey || 'Shift';
    if (settings.furiganaHotkey) furiganaHotkey = settings.furiganaHotkey;
    if (typeof settings.furiganaEnabled !== 'undefined') {
      isFuriganaActive = !!settings.furiganaEnabled;
      if (isFuriganaActive) {
        injectFuriganaOnPage().catch(() => {});
      }
    }
    console.log('[JP-Dict Content] Cài đặt ban đầu:', { isAutoTranslateEnabled, isHoverLookupEnabled, hoverKey, furiganaHotkey });
  }).catch(() => {});
}

// Lắng nghe thay đổi cài đặt Realtime từ Popup hoặc Tooltip
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes['jpDictAppSettings']) {
      const val = changes['jpDictAppSettings'].newValue;
      if (val) {
        if (typeof val.autoTranslateOnSelect !== 'undefined') {
          isAutoTranslateEnabled = !!val.autoTranslateOnSelect;
        }
        if (typeof val.hoverLookupEnabled !== 'undefined') {
          isHoverLookupEnabled = !!val.hoverLookupEnabled;
        }
        if (typeof val.hoverKey !== 'undefined') {
          hoverKey = val.hoverKey;
        }
        if (typeof val.furiganaHotkey !== 'undefined') {
          furiganaHotkey = val.furiganaHotkey;
        }
        console.log('[JP-Dict Content] Đã cập nhật cài đặt Realtime:', { isAutoTranslateEnabled, isHoverLookupEnabled, hoverKey, furiganaHotkey });
      }
    }
    if (changes['furiganaEnabled']) {
      const enabled = !!changes['furiganaEnabled'].newValue;
      if (enabled !== isFuriganaActive) {
        toggleFuriganaInjection(enabled).catch(() => {});
      }
    }
  }
});

// Lắng nghe sự kiện thả chuột (mouseup) trên toàn bộ trang web
document.addEventListener('mouseup', handleTextSelection);

// Lắng nghe phím nhấn để hỗ trợ phím tắt Shift dịch nhanh khi bôi đen
document.addEventListener('keydown', handleKeyDown);

// Lắng nghe sự kiện rê chuột để hỗ trợ Hover tra từ siêu tốc
let hoverLookupTimeout = null;
let lastHoveredWord = '';
document.addEventListener('mousemove', handleHoverLookup);

/**
 * Trích xuất từ tiếng Nhật tại tọa độ con trỏ (x, y) trên trang web
 */
function getJapaneseWordAtPoint(x, y) {
  let range;
  let textNode;
  let offset;

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
    if (!range) return null;
    textNode = range.startContainer;
    offset = range.startOffset;
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    textNode = pos.offsetNode;
    offset = pos.offset;
  }

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;

  const fullText = textNode.textContent;
  if (!fullText || offset >= fullText.length) return null;

  const charAtPoint = fullText[offset];
  // Regex kiểm tra ký tự tiếng Nhật
  const isJp = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\u3400-\u4dbf]/;
  if (!charAtPoint || !isJp.test(charAtPoint)) return null;

  // Mở rộng về phía trước tối đa 8 ký tự tiếng Nhật để tạo thành một từ vựng
  let end = offset;
  while (end < fullText.length && (end - offset) < 8 && isJp.test(fullText[end])) {
    end++;
  }

  const word = fullText.slice(offset, end).trim();
  if (!word) return null;

  try {
    const wordRange = document.createRange();
    wordRange.setStart(textNode, offset);
    wordRange.setEnd(textNode, end);
    const rect = wordRange.getBoundingClientRect();
    return { word, rect };
  } catch (e) {
    return null;
  }
}

/**
 * Xử lý hover chuột khi giữ phím Shift (hoặc Alt)
 */
function handleHoverLookup(event) {
  if (!isHoverLookupEnabled) return;

  const isKeyPressed = (hoverKey === 'Alt') ? event.altKey : event.shiftKey;
  if (!isKeyPressed) {
    clearTimeout(hoverLookupTimeout);
    return;
  }

  // Không kích hoạt nếu đang trong ô nhập liệu
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }

  // Bỏ qua nếu chuột đang nằm trong Tooltip hoặc Floating Icon
  if (activeTooltipHost && (activeTooltipHost === event.target || activeTooltipHost.contains(event.target))) {
    return;
  }
  if (activeFloatingIcon && activeFloatingIcon.contains(event.target)) {
    return;
  }

  clearTimeout(hoverLookupTimeout);
  hoverLookupTimeout = setTimeout(() => {
    const match = getJapaneseWordAtPoint(event.clientX, event.clientY);
    if (match && match.word) {
      if (match.word === lastHoveredWord && activeTooltipHost) {
        return; // Đang hiển thị từ này
      }
      lastHoveredWord = match.word;
      console.log(`[JP-Dict] Hover tra nhanh (${hoverKey}):`, match.word);

      removeFloatingIcon();
      removeTooltip();
      showTooltip(match.word, match.rect);
    }
  }, 120);
}

/**
 * Xử lý phím tắt Shift để dịch nhanh đoạn bôi đen
 */
function handleKeyDown(event) {
  if (event.key === 'Shift') {
    // Không kích hoạt nếu đang gõ trong ô nhập liệu
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const selectedText = getCleanSelectedText(selection);
      
      // Kiểm tra xem đoạn bôi đen có chứa tiếng Nhật không
      if (selectedText && JAPANESE_REGEX.test(selectedText)) {
        event.preventDefault();
        
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        console.log('[JP-Dict] Kích hoạt phím tắt Shift dịch nhanh:', selectedText);
        
        removeFloatingIcon();
        removeTooltip();
        
        showTooltip(selectedText, rect);
      }
    }
  }
}

/**
 * Xử lý khi người dùng bôi đen văn bản
 */
function handleTextSelection(event) {
  // BẮT BUỘC: Nếu người dùng click vào chính Floating Icon hoặc phần tử bên trong Tooltip,
  // bỏ qua sự kiện này ngay lập tức.
  if (event && event.target) {
    if (activeFloatingIcon && activeFloatingIcon.contains(event.target)) {
      return;
    }
    if (activeTooltipHost && (activeTooltipHost === event.target || activeTooltipHost.contains(event.target))) {
      return;
    }
  }

  // Trì hoãn 50ms để trình duyệt hoàn tất cập nhật trạng thái lựa chọn và reflow layout
  setTimeout(() => {
    const selection = window.getSelection();
    
    // Nếu selection rỗng hoặc bị collapsed (chỉ click chuột chứ không bôi đen)
    if (selection.isCollapsed) {
      return;
    }

    // Trích xuất văn bản sạch (đã bóc tách loại bỏ furigana <rt>)
    const selectedText = getCleanSelectedText(selection);

    // BƯỚC 1: Kiểm tra điều kiện lọc tiếng Nhật
    if (!selectedText || !JAPANESE_REGEX.test(selectedText)) {
      return;
    }

    console.log('[JP-Dict] Phát hiện bôi đen tiếng Nhật hợp lệ:', selectedText);

    // Dọn dẹp các UI cũ trước khi tạo mới
    removeFloatingIcon();
    removeTooltip();

    // Lấy range (phạm vi) bôi đen đầu tiên
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Nếu rect rỗng (không đo được kích thước), thử lấy client rects
    if (rect.width === 0 && rect.height === 0) {
      console.log('[JP-Dict] BoundingRect rỗng, thử sử dụng getClientRects()');
      const rects = range.getClientRects();
      if (rects.length === 0) {
        console.warn('[JP-Dict] Không tìm thấy kích thước vùng bôi đen.');
        return;
      }
    }

    // NẾU BẬT CHẾ ĐỘ TỰ ĐỘNG DỊCH: Hiển thị ngay bảng dịch (không cần nhấn icon)
    if (isAutoTranslateEnabled) {
      console.log('[JP-Dict] Đang ở chế độ TỰ ĐỘNG DỊCH -> Hiển thị Tooltip tức thì!');
      showTooltip(selectedText, rect);
      return;
    }

    // NẾU TẮT CHẾ ĐỘ TỰ ĐỘNG: Hiển thị Floating Icon để người dùng click
    const top = rect.bottom + window.scrollY + 6;
    const left = rect.right + window.scrollX - 12;

    // Tạo thẻ Custom Tag để tránh bị ghi đè CSS từ trang web
    const icon = document.createElement('jp-dict-floating-icon');
    icon.id = 'jp-dict-floating-icon';
    icon.title = 'Tra cứu từ này';

    const iconUrl = (chrome.runtime && chrome.runtime.getURL) ? chrome.runtime.getURL('icons/icon48.png') : '';
    if (iconUrl) {
      icon.innerHTML = `<img src="${iconUrl}" alt="JP" style="width: 100% !important; height: 100% !important; border-radius: 50% !important; object-fit: cover !important; pointer-events: none !important; display: block !important;">`;
    } else {
      icon.innerText = '辞';
    }

    // Cấu hình CSS inline kèm '!important'
    const styles = {
      'position': 'absolute',
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'top': `${top}px`,
      'left': `${left}px`,
      'width': '28px',
      'height': '28px',
      'border-radius': '50%',
      'background-color': '#ffffff',
      'border': '2px solid #ffffff',
      'outline': 'none',
      'cursor': 'pointer',
      'box-shadow': '0 4px 14px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(225, 29, 72, 0.35)',
      'z-index': '2147483647',
      'transition': 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s',
      'padding': '0',
      'overflow': 'hidden',
      'user-select': 'none',
      '-webkit-user-select': 'none',
      'box-sizing': 'border-box'
    };

    for (const [key, value] of Object.entries(styles)) {
      icon.style.setProperty(key, value, 'important');
    }

    // Hiệu ứng Hover mượt mà
    icon.addEventListener('mouseenter', () => {
      icon.style.setProperty('transform', 'scale(1.2)', 'important');
      icon.style.setProperty('box-shadow', '0 6px 18px rgba(0, 0, 0, 0.45), 0 0 0 2px #38bdf8', 'important');
    });
    icon.addEventListener('mouseleave', () => {
      icon.style.setProperty('transform', 'none', 'important');
      icon.style.setProperty('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(225, 29, 72, 0.35)', 'important');
    });

    // Sự kiện Click vào Icon -> Hiện Tooltip
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('[JP-Dict] Đã click vào Floating Icon. Đang hiển thị Tooltip...');
      removeFloatingIcon();
      showTooltip(selectedText, rect);
    });

    document.body.appendChild(icon);
    activeFloatingIcon = icon;

    // Lắng nghe sự kiện click ra ngoài để ẩn
    document.addEventListener('mousedown', handleOutsideClick);
  }, 50);
}

/**
 * Xây dựng và hiển thị Tooltip UI sử dụng Shadow DOM
 */
function showTooltip(text, rect) {
  removeTooltip();

  // Tạo phần tử Shadow Host
  const host = document.createElement('div');
  host.id = 'jp-dict-tooltip-host';

  const tooltipWidth = 350;

  // Căn giữa chiều ngang Tooltip dưới vùng bôi đen
  let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipWidth / 2);
  const top = rect.bottom + window.scrollY + 8;

  // Chống tràn viền
  if (left < 10) {
    left = 10;
  }
  const maxLeft = window.innerWidth - tooltipWidth - 10;
  if (left > maxLeft) {
    left = maxLeft;
  }

  Object.assign(host.style, {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: '2147483647',
    pointerEvents: 'auto'
  });

  const shadow = host.attachShadow({ mode: 'open' });

  // CSS phong cách Dark Mode chuyên nghiệp theo chuẩn Mazii
  const style = document.createElement('style');
  style.textContent = `
    .tooltip-card {
      width: ${tooltipWidth}px;
      box-sizing: border-box;
      background: #121214;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 10px 12px 14px 12px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 4px 12px rgba(0, 0, 0, 0.4);
      font-family: 'Noto Sans JP', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #f4f4f5;
      position: relative;
      font-size: 13px;
      line-height: 1.4;
      animation: tooltipFadeIn 0.18s ease-out;
      user-select: text;
    }

    .drag-handle {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 14px;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
    .drag-handle::after {
      content: '';
      width: 28px;
      height: 3px;
      background: #3f3f46;
      border-radius: 2px;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Header thanh trên */
    .tooltip-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
      margin-bottom: 8px;
      padding-bottom: 4px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .audio-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      padding: 2px 4px;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s;
    }
    .audio-btn:hover {
      transform: scale(1.18);
      color: #38bdf8;
    }

    .tab-nav {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .nav-tab {
      background: none;
      border: 1px solid transparent;
      color: #3b82f6;
      font-size: 13px;
      font-weight: 500;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .nav-tab:hover {
      color: #60a5fa;
    }
    .nav-tab.active {
      color: #ffffff;
      background: #26262b;
      border-color: #454550;
      font-weight: 600;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .close-btn, .save-btn, .auto-mode-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0 3px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, transform 0.15s;
    }
    .close-btn {
      font-size: 18px;
      line-height: 1;
    }
    .close-btn:hover {
      color: #ef4444;
    }
    .save-btn {
      font-size: 17px;
    }
    .save-btn:hover, .save-btn.saved {
      color: #f59e0b;
    }
    .auto-mode-btn {
      font-size: 13px;
    }

    /* Thanh thông báo & chọn thư mục lưu (Hiện gọn gàng bên dưới header) */
    .save-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 6px;
      padding: 5px 8px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #fbbf24;
      box-sizing: border-box;
      animation: tooltipFadeIn 0.15s ease-out;
    }
    .save-banner-icon {
      font-size: 13px;
      flex-shrink: 0;
    }
    .save-banner-text {
      white-space: nowrap;
      font-weight: 500;
      flex-shrink: 0;
    }
    .save-banner .folder-select {
      flex: 1;
      min-width: 0;
      background: #18181b;
      border: 1px solid #374151;
      border-radius: 4px;
      padding: 3px 6px;
      font-size: 11px;
      color: #f3f4f6;
      outline: none;
      cursor: pointer;
    }

    /* Vùng hiển thị kết quả */
    .results-info-row {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #a1a1aa;
      margin-bottom: 8px;
    }
    .search-icon {
      font-size: 12px;
    }
    .highlight-query {
      color: #fbbf24;
      font-weight: 600;
    }

    .cards-scroll-container {
      max-height: 310px;
      overflow-y: auto;
      padding-right: 3px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cards-scroll-container::-webkit-scrollbar {
      width: 4px;
    }
    .cards-scroll-container::-webkit-scrollbar-thumb {
      background: #3f3f46;
      border-radius: 4px;
    }

    /* Thẻ từ vựng (Card) */
    .dict-card {
      background: #18181b;
      border: 1px solid #2e2e36;
      border-radius: 6px;
      padding: 8px 10px;
      transition: border-color 0.15s;
    }
    .dict-card:hover {
      border-color: #4b4b55;
    }

    .card-line-1 {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 2px;
    }
    .card-word {
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
    }
    .card-reading {
      color: #e4e4e7;
      font-size: 14px;
      font-weight: 400;
    }

    .card-line-2 {
      font-size: 12px;
      font-weight: 600;
      color: #d4d4d8;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 3px;
    }

    .card-line-3 {
      font-size: 13px;
      color: #f4f4f5;
      line-height: 1.4;
      white-space: pre-wrap;
    }

    /* Badges & Meaning Rows */
    .badge-lang {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      text-transform: uppercase;
      line-height: 1.2;
      flex-shrink: 0;
    }
    .badge-lang.vi {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.35);
    }
    .badge-lang.en {
      background: rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      border: 1px solid rgba(59, 130, 246, 0.35);
    }
    .card-meaning-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 3px;
    }
    .card-meaning-row.en {
      color: #d1d5db;
      font-size: 12px;
    }

    /* Kanji Card */
    .kanji-single-card {
      padding: 12px 14px;
    }
    .kanji-main-char {
      font-size: 28px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 2px;
    }
    .kanji-meta {
      font-size: 11px;
      color: #a1a1aa;
      margin-top: 3px;
      margin-bottom: 4px;
    }

    /* Tooltip Footer */
    .tooltip-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #27272a;
    }
    .lang-selector-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .lang-lbl {
      font-size: 11px;
      color: #71717a;
      margin-right: 2px;
    }
    .lang-btn {
      background: #18181b;
      border: 1px solid #2e2e36;
      color: #a1a1aa;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .lang-btn:hover {
      border-color: #3b82f6;
      color: #ffffff;
    }
    .lang-btn.active {
      background: #2563eb;
      border-color: #3b82f6;
      color: #ffffff;
      font-weight: 600;
    }
    .settings-hint-link {
      font-size: 11px;
      color: #71717a;
      cursor: pointer;
    }
    .settings-hint-link:hover {
      color: #38bdf8;
      text-decoration: underline;
    }

    /* Translation View */
    .trans-box-view {
      padding: 4px 0;
    }
    .trans-src-text {
      font-size: 15px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .trans-row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .trans-row .badge-lang {
      margin-top: 4px;
    }
    .trans-dst-text {
      flex: 1;
      font-size: 13px;
      color: #f4f4f5;
      line-height: 1.5;
      background: #18181b;
      border: 1px solid #27272a;
      padding: 8px 10px;
      border-radius: 6px;
    }
    .trans-dst-text.en-trans {
      color: #d1d5db;
    }
    .trans-action-hint {
      color: #38bdf8;
      font-size: 11px;
      margin-top: 4px;
      cursor: pointer;
    }
    .trans-action-hint:hover {
      text-decoration: underline;
    }

    /* Loader */
    .loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 0;
      color: #a1a1aa;
      font-size: 13px;
    }
    .spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(255, 255, 255, 0.15);
      border-top: 2px solid #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 8px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  shadow.appendChild(style);

  // Tạo khung thẻ Tooltip Card
  const card = document.createElement('div');
  card.className = 'tooltip-card';

  // Thanh kéo (Drag Handle)
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.title = 'Kéo để di chuyển';
  card.appendChild(dragHandle);

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  dragHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    const hostRect = host.getBoundingClientRect();
    dragOffsetX = e.clientX - hostRect.left;
    dragOffsetY = e.clientY - hostRect.top;
    dragHandle.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const newLeft = e.clientX - dragOffsetX + window.scrollX;
    const newTop = e.clientY - dragOffsetY + window.scrollY;
    host.style.left = `${newLeft}px`;
    host.style.top = `${newTop}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
    }
  });

  // Header thanh điều hướng
  const header = document.createElement('div');
  header.className = 'tooltip-header';

  // Header Trái: Loa + 3 Tab
  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left';

  const audioBtn = document.createElement('button');
  audioBtn.className = 'audio-btn';
  audioBtn.innerHTML = '🔊';
  audioBtn.title = 'Phát âm tiếng Nhật';
  audioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    playPronunciation(text);
  });
  headerLeft.appendChild(audioBtn);

  const tabNav = document.createElement('div');
  tabNav.className = 'tab-nav';

  const btnTabVocab = document.createElement('button');
  btnTabVocab.className = 'nav-tab active';
  btnTabVocab.innerText = 'Từ vựng';

  const btnTabKanji = document.createElement('button');
  btnTabKanji.className = 'nav-tab';
  btnTabKanji.innerText = 'Hán tự';

  const btnTabTrans = document.createElement('button');
  btnTabTrans.className = 'nav-tab';
  btnTabTrans.innerText = 'Dịch';

  tabNav.appendChild(btnTabVocab);
  tabNav.appendChild(btnTabKanji);
  tabNav.appendChild(btnTabTrans);
  headerLeft.appendChild(tabNav);
  header.appendChild(headerLeft);

  // Header Phải: Auto Mode + Sao Bookmark + Nút Đóng (Không để dropdown ở đây tránh vỡ layout)
  const headerRight = document.createElement('div');
  headerRight.className = 'header-right';

  const autoModeBtn = document.createElement('button');
  autoModeBtn.className = 'auto-mode-btn';
  const updateAutoBtnUI = () => {
    if (isAutoTranslateEnabled) {
      autoModeBtn.innerHTML = '⚡';
      autoModeBtn.title = 'Chế độ Dịch: TỰ ĐỘNG THẢ CHUỘT (Click để chuyển sang Bấm Icon)';
    } else {
      autoModeBtn.innerHTML = '👆';
      autoModeBtn.title = 'Chế độ Dịch: BẤM ICON MỚI DỊCH (Click để chuyển sang Tự Động)';
    }
  };
  updateAutoBtnUI();
  autoModeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    isAutoTranslateEnabled = !isAutoTranslateEnabled;
    updateAutoBtnUI();
    if (typeof updateAppSettings === 'function') {
      await updateAppSettings({ autoTranslateOnSelect: isAutoTranslateEnabled });
    }
  });
  headerRight.appendChild(autoModeBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.innerHTML = '☆';
  saveBtn.title = 'Lưu từ vào Dashboard';
  headerRight.appendChild(saveBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Đóng';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTooltip();
  });
  headerRight.appendChild(closeBtn);

  header.appendChild(headerRight);
  card.appendChild(header);

  // Thanh thông báo & chọn Thư mục lưu (Hiển thị riêng biệt dưới header, không làm co kéo tab)
  const saveBanner = document.createElement('div');
  saveBanner.className = 'save-banner';
  saveBanner.style.display = 'none';

  const saveBannerIcon = document.createElement('span');
  saveBannerIcon.className = 'save-banner-icon';
  saveBannerIcon.innerText = '⭐';
  saveBanner.appendChild(saveBannerIcon);

  const saveBannerText = document.createElement('span');
  saveBannerText.className = 'save-banner-text';
  saveBannerText.innerText = 'Đã lưu vào:';
  saveBanner.appendChild(saveBannerText);

  const folderSelect = document.createElement('select');
  folderSelect.className = 'folder-select';
  folderSelect.title = 'Chọn thư mục lưu từ';
  saveBanner.appendChild(folderSelect);
  card.appendChild(saveBanner);

  // Vùng hiển thị Loading
  const loader = document.createElement('div');
  loader.className = 'loader';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const loaderText = document.createElement('div');
  loaderText.innerText = 'Đang tra cứu từ điển...';
  loader.appendChild(spinner);
  loader.appendChild(loaderText);
  card.appendChild(loader);

  // Vùng hiển thị các Tab Content
  const content = document.createElement('div');
  content.className = 'content';
  content.style.display = 'none';
  card.appendChild(content);

  shadow.appendChild(card);
  document.body.appendChild(host);
  activeTooltipHost = host;

  document.addEventListener('mousedown', handleOutsideClick);

  // Gửi thông điệp tra cứu với cơ chế Client-Cache (0ms) & phòng ngừa lỗi Extension Context Invalidated
  const showReloadPrompt = () => {
    loaderText.innerHTML = `
      <div style="font-weight: 600; color: #f59e0b; margin-bottom: 6px;">Tiện ích vừa được tải lại!</div>
      <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 8px;">Vui lòng F5 tải lại trang web để kết nối phiên bản mới.</div>
      <button onclick="window.location.reload()" style="background: #2563eb; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer;">🔄 Tải lại trang (F5)</button>
    `;
    const spinnerEl = loader.querySelector('.spinner');
    if (spinnerEl) spinnerEl.style.display = 'none';
  };

  const handleLookupSuccess = (response) => {
    const data = response.data;
    loader.style.display = 'none';
    content.style.display = 'block';

    // 1. Quản lý trạng thái lưu từ
    getSavedWords().then(async (words) => {
      const savedWord = words.find(w => w.kanji === data.kanji);
      if (savedWord) {
        saveBtn.innerHTML = '★';
        saveBtn.classList.add('saved');
        saveBtn.title = 'Xóa khỏi danh sách lưu';
        saveBanner.style.display = 'flex';
        await loadFolderOptions(folderSelect, savedWord.folder || "Mặc định");
      } else {
        saveBtn.innerHTML = '☆';
        saveBtn.classList.remove('saved');
        saveBtn.title = 'Lưu từ vào Dashboard';
        saveBanner.style.display = 'none';
      }
    }).catch(() => {});

    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const saved = saveBtn.classList.contains('saved');
      if (saved) {
        await deleteWord(data.kanji);
        saveBtn.innerHTML = '☆';
        saveBtn.classList.remove('saved');
        saveBtn.title = 'Lưu từ vào Dashboard';
        saveBanner.style.display = 'none';
      } else {
        const defaultFolder = "Mặc định";
        await saveWord(data, defaultFolder);
        saveBtn.innerHTML = '★';
        saveBtn.classList.add('saved');
        saveBtn.title = 'Xóa khỏi danh sách lưu';
        saveBanner.style.display = 'flex';
        await loadFolderOptions(folderSelect, defaultFolder);
      }
    });

    folderSelect.addEventListener('change', async (e) => {
      e.stopPropagation();
      const val = folderSelect.value;
      if (val === '__new_folder__') {
        const newFolderName = prompt('Nhập tên thư mục mới:');
        if (newFolderName && newFolderName.trim()) {
          const cleanName = newFolderName.trim();
          await createFolder(cleanName);
          await updateWordFolder(data.kanji, cleanName);
          await loadFolderOptions(folderSelect, cleanName);
        } else {
          const words = await getSavedWords();
          const currentWord = words.find(w => w.kanji === data.kanji);
          await loadFolderOptions(folderSelect, currentWord ? currentWord.folder : "Mặc định");
        }
      } else {
        await updateWordFolder(data.kanji, val);
      }
    });

    // 2. Render giao diện các Tab thuần Tiếng Việt
    const renderPanes = () => {
      const vocabList = data.results || [data];
      const kanjiList = data.kanjis || [];
      const transObj = data.translation || {
        sourceText: text,
        translatedVi: data.meaningVi || data.meaning,
        translatedText: data.meaning
      };

      // Tab 1: Từ vựng
      const vocabCardsHtml = vocabList.map(item => {
        const vi = item.meaningVi || item.meaning || 'Chưa rõ nghĩa';
        const meaningHtml = `<div class="card-meaning-text">${vi}</div>`;

        return `
          <div class="dict-card">
            <div class="card-line-1">
              <span class="card-word">${item.kanji}</span>
              <span class="card-reading">${item.reading || ''}</span>
            </div>
            ${item.hanviet && item.hanviet.trim() ? `<div class="card-hanviet-badge">${item.hanviet.trim()}</div>` : ''}
            <div class="card-line-3">${meaningHtml}</div>
          </div>
        `;
      }).join('');

      // Tab 2: Hán tự
      const kanjiCardsHtml = kanjiList.length > 0 ? kanjiList.map(k => {
        const metaParts = [];
        if (k.strokes) metaParts.push(`${k.strokes} nét`);
        if (k.radical) metaParts.push(`Bộ: ${k.radical}`);
        const metaStr = metaParts.length > 0 ? `<div class="kanji-meta">${metaParts.join(' • ')}</div>` : '';
        const readingHtml = k.reading ? `<div class="card-reading" style="margin-top: 4px; color: #38bdf8; font-size: 12px;">${k.reading}</div>` : '';

        return `
          <div class="dict-card kanji-single-card">
            <div class="kanji-main-char">${k.char}</div>
            <div class="card-line-2">${k.hanviet}</div>
            ${readingHtml}
            ${metaStr}
            <div class="card-line-3">${k.meaning}</div>
          </div>
        `;
      }).join('') : `
        <div class="dict-card kanji-single-card">
          <div class="card-line-3">Không tìm thấy Hán tự trong từ khóa này.</div>
        </div>
      `;

      // Tab 3: Dịch
      const viTrans = transObj.translatedVi || transObj.translatedText || 'Không có bản dịch';
      const transOutputHtml = `
        <div class="trans-row">
          <span class="badge-lang vi">VI</span>
          <div class="trans-dst-text">${viTrans}</div>
        </div>
      `;

      content.innerHTML = `
        <!-- TAB 1: TỪ VỰNG -->
        <div class="tab-pane" id="pane-vocab">
          <div class="results-info-row">
            <span class="search-icon">🔍</span>
            <span>${vocabList.length} kết quả của từ vựng</span>
            <span class="highlight-query">${data.query || text}</span>
          </div>
          <div class="cards-scroll-container">
            ${vocabCardsHtml}
          </div>
        </div>

        <!-- TAB 2: HÁN TỰ -->
        <div class="tab-pane" id="pane-kanji" style="display: none;">
          <div class="results-info-row">
            <span class="search-icon">🔍</span>
            <span>${kanjiList.length} kết quả của Hán tự</span>
            <span class="highlight-query">${data.query || text}</span>
          </div>
          <div class="cards-scroll-container">
            ${kanjiCardsHtml}
          </div>
        </div>

        <!-- TAB 3: DỊCH -->
        <div class="tab-pane" id="pane-trans" style="display: none;">
          <div class="trans-box-view">
            <div class="trans-src-text">${transObj.sourceText}</div>
            ${transOutputHtml}
            <div class="trans-action-hint">Phân tích tiếng Nhật siêu tốc</div>
          </div>
        </div>

        <!-- FOOTER: THÔNG TIN TIẾNG VIỆT & CÀI ĐẶT -->
        <div class="tooltip-footer">
          <div class="lang-selector-group">
            <span class="lang-lbl" style="color: #10b981; font-weight: 600;">🇻🇳 Tiếng Việt</span>
          </div>
          <span class="settings-hint-link" title="Mở trang cài đặt">Cài đặt</span>
        </div>
      `;

      // Chuyển đổi Tab
      const paneVocab = content.querySelector('#pane-vocab');
      const paneKanji = content.querySelector('#pane-kanji');
      const paneTrans = content.querySelector('#pane-trans');

      const tabs = [
        { btn: btnTabVocab, pane: paneVocab },
        { btn: btnTabKanji, pane: paneKanji },
        { btn: btnTabTrans, pane: paneTrans }
      ];

      const activeIdx = tabs.findIndex(t => t.btn.classList.contains('active'));
      tabs.forEach((t, idx) => {
        t.pane.style.display = (idx === (activeIdx !== -1 ? activeIdx : 0)) ? 'block' : 'none';
      });

      tabs.forEach(({ btn, pane }) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          tabs.forEach(t => {
            t.btn.classList.remove('active');
            t.pane.style.display = 'none';
          });
          btn.classList.add('active');
          pane.style.display = 'block';
        };
      });

      // Nút Cài đặt
      const settingsLink = content.querySelector('.settings-hint-link');
      if (settingsLink) {
        settingsLink.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          settingsLink.textContent = 'Đang mở...';
          try {
            chrome.storage.local.set({ activePopupTab: 'settings-tab' }, () => {
              chrome.runtime.sendMessage({ action: 'openExtensionPopup' }, (res) => {
                setTimeout(() => { settingsLink.textContent = 'Cài đặt'; }, 800);
                if (chrome.runtime.lastError || (res && !res.success)) {
                  try { window.open(chrome.runtime.getURL('popup.html?tab=settings'), '_blank'); } catch (e2) {}
                }
              });
            });
          } catch (err) {
            try { window.open(chrome.runtime.getURL('popup.html?tab=settings'), '_blank'); } catch (e2) {}
          }
        });
      }
    };

    renderPanes();
  };

  // Kiểm tra bộ nhớ đệm Client (0ms)
  if (CLIENT_LOOKUP_CACHE.has(text)) {
    handleLookupSuccess(CLIENT_LOOKUP_CACHE.get(text));
    return;
  }

  try {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || !chrome.runtime.id) {
      showReloadPrompt();
      return;
    }

    chrome.runtime.sendMessage({ action: 'translate', text: text, targetLang: 'vi' }, (response) => {
      if (chrome.runtime.lastError) {
        showReloadPrompt();
        return;
      }

      if (response && response.success) {
        // Lưu vào bộ nhớ đệm Client
        if (CLIENT_LOOKUP_CACHE.size >= MAX_CLIENT_CACHE) {
          const firstKey = CLIENT_LOOKUP_CACHE.keys().next().value;
          CLIENT_LOOKUP_CACHE.delete(firstKey);
        }
        CLIENT_LOOKUP_CACHE.set(text, response);

        handleLookupSuccess(response);
      } else {
        loaderText.innerText = 'Không tìm thấy kết quả tra cứu.';
        const spinnerEl = loader.querySelector('.spinner');
        if (spinnerEl) spinnerEl.style.display = 'none';
      }
    });
  } catch (err) {
    showReloadPrompt();
  }
}

/**
 * Xử lý khi click ra ngoài vùng hiển thị để dọn dẹp các UI nổi
 */
function handleOutsideClick(event) {
  if (activeFloatingIcon && activeFloatingIcon.contains(event.target)) {
    return;
  }
  // Click bên trong Shadow DOM
  if (activeTooltipHost && (activeTooltipHost === event.target || activeTooltipHost.contains(event.target))) {
    return;
  }
  removeFloatingIcon();
  removeTooltip();
}

/**
 * Xóa Floating Icon khỏi DOM
 */
function removeFloatingIcon() {
  if (activeFloatingIcon) {
    activeFloatingIcon.remove();
    activeFloatingIcon = null;
  }
}

/**
 * Xóa Tooltip khỏi DOM và gỡ bỏ sự kiện mousedown
 */
function removeTooltip() {
  if (activeTooltipHost) {
    activeTooltipHost.remove();
    activeTooltipHost = null;
  }
  document.removeEventListener('mousedown', handleOutsideClick);
}

/**
 * Phát âm thanh của từ vựng tiếng Nhật (Hybrid: Google TTS & Web Speech API fallback)
 */
function playPronunciation(text, rate = 1.0) {
  const cleanText = text.replace(/\([^)]*\)/g, '').trim();
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ja-JP';
      utterance.rate = rate;
      const jaVoice = window.speechSynthesis.getVoices().find(v => v.lang === 'ja-JP' || v.lang.startsWith('ja'));
      if (jaVoice) utterance.voice = jaVoice;
      window.speechSynthesis.speak(utterance);
      return;
    } catch (e) {}
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;
  const audio = new Audio(googleTtsUrl);
  audio.playbackRate = rate;
  audio.play().catch(() => {});
}

/**
 * Nạp danh sách thư mục vào phần tử Select
 */
async function loadFolderOptions(selectElement, selectedFolder = "Mặc định") {
  const folders = await getSavedFolders();
  selectElement.innerHTML = '';
  
  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder;
    option.innerText = folder;
    if (folder === selectedFolder) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });
  
  // Thêm tùy chọn tạo thư mục mới
  const newFolderOption = document.createElement('option');
  newFolderOption.value = '__new_folder__';
  newFolderOption.innerText = '+ Tạo thư mục...';
  selectElement.appendChild(newFolderOption);
}

// ==========================================
// TÍNH NĂNG TỰ ĐỘNG CHÈN FURIGANA TOÀN TRANG
// ==========================================

function ensureGlobalFuriganaStyles() {
  if (document.getElementById('jpex-furigana-global-style')) return;
  const styleEl = document.createElement('style');
  styleEl.id = 'jpex-furigana-global-style';
  styleEl.textContent = `
    .jpex-ruby {
      ruby-position: over !important;
      -webkit-ruby-position: before !important;
    }
    .jpex-rt {
      font-size: 0.65em !important;
      color: #0284c7 !important;
      user-select: none !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      letter-spacing: 0.02em !important;
    }
    #jpex-furigana-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      padding: 8px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      pointer-events: none;
      opacity: 0;
      transform: translateY(-8px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #jpex-furigana-toast.jpex-furi-toast-show {
      opacity: 1;
      transform: translateY(0);
    }
    #jpex-furigana-toast.active {
      background: #0284c7;
      color: #ffffff;
      border: 1px solid #38bdf8;
    }
    #jpex-furigana-toast.inactive {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
    }
  `;
  (document.head || document.documentElement).appendChild(styleEl);
}

function showFuriganaToast(isActive) {
  ensureGlobalFuriganaStyles();
  let toast = document.getElementById('jpex-furigana-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'jpex-furigana-toast';
    document.body.appendChild(toast);
  }
  toast.innerText = isActive ? '🈓 Furigana: ĐÃ BẬT ✨' : '🈓 Furigana: ĐÃ TẮT';
  toast.className = 'jpex-furi-toast-show ' + (isActive ? 'active' : 'inactive');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.className = '';
  }, 1600);
}

async function loadFuriganaDictionaries() {
  if (compoundWordsCache && kanjiReadingsCache) return;

  try {
    const [cw, kr] = await Promise.all([
      !compoundWordsCache
        ? fetch(chrome.runtime.getURL('data/compound_words.json')).then(r => r.json()).catch(() => ({}))
        : compoundWordsCache,
      !kanjiReadingsCache
        ? fetch(chrome.runtime.getURL('data/kanji_readings.json')).then(r => r.json()).catch(() => ({}))
        : kanjiReadingsCache
    ]);

    compoundWordsCache = compoundWordsCache || cw;
    kanjiReadingsCache = kanjiReadingsCache || kr;
  } catch (err) {
    console.error('[JP-Dict Content] Lỗi tải từ điển Furigana:', err);
  }
}

function createRubyNode(kanji, reading) {
  const ruby = document.createElement('ruby');
  ruby.className = 'jpex-ruby';
  ruby.appendChild(document.createTextNode(kanji));
  const rt = document.createElement('rt');
  rt.className = 'jpex-rt';
  rt.innerText = reading;
  ruby.appendChild(rt);
  return ruby;
}

function annotateTextToFragment(text, cw, kr) {
  const fragment = document.createDocumentFragment();
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (/[\u4e00-\u9faf]/.test(char)) {
      let matched = false;
      if (cw) {
        for (let len = Math.min(8, text.length - i); len >= 2; len--) {
          const sub = text.substr(i, len);
          if (cw[sub]) {
            const fullReading = cw[sub];
            const kanaMatch = sub.match(/[\u3040-\u309f]+$/);
            if (kanaMatch && fullReading.endsWith(kanaMatch[0])) {
              const kanjiPart = sub.substring(0, sub.length - kanaMatch[0].length);
              const rubyPart = fullReading.substring(0, fullReading.length - kanaMatch[0].length);
              fragment.appendChild(createRubyNode(kanjiPart, rubyPart));
              fragment.appendChild(document.createTextNode(kanaMatch[0]));
            } else {
              fragment.appendChild(createRubyNode(sub, fullReading));
            }
            i += len;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        let r = (kr && kr[char] && kr[char].f) ? kr[char].f.replace(/-/g, '') : '';
        if (r) {
          fragment.appendChild(createRubyNode(char, r));
        } else {
          fragment.appendChild(document.createTextNode(char));
        }
        i++;
      }
    } else {
      fragment.appendChild(document.createTextNode(char));
      i++;
    }
  }
  return fragment;
}

async function injectFuriganaOnPage() {
  ensureGlobalFuriganaStyles();
  await loadFuriganaDictionaries();

  const kanjiRegex = /[\u4e00-\u9faf]/;
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if (!node.nodeValue || !kanjiRegex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'textarea', 'input', 'ruby', 'rt', 'rp', 'pre', 'code'].includes(tag)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('#jp-dict-tooltip-host') || parent.closest('#jpex-furigana-toast')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
    if (textNodes.length >= 1000) break;
  }

  textNodes.forEach(node => {
    if (!node.parentNode || !kanjiRegex.test(node.nodeValue)) return;
    const fragment = annotateTextToFragment(node.nodeValue, compoundWordsCache, kanjiReadingsCache);
    node.parentNode.replaceChild(fragment, node);
  });
}

function removeFuriganaFromPage() {
  document.querySelectorAll('.jpex-ruby').forEach(ruby => {
    let text = '';
    ruby.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'RT' && child.tagName !== 'RP') {
        text += child.textContent;
      }
    });
    ruby.replaceWith(document.createTextNode(text));
  });
  document.body.normalize();
}

async function toggleFuriganaInjection(forceState) {
  isFuriganaActive = (typeof forceState === 'boolean') ? forceState : !isFuriganaActive;
  showFuriganaToast(isFuriganaActive);
  
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ furiganaEnabled: isFuriganaActive });
  }

  if (isFuriganaActive) {
    await injectFuriganaOnPage();
  } else {
    removeFuriganaFromPage();
  }
}

function matchesFuriganaHotkey(e, hotkeyStr) {
  if (!hotkeyStr) return false;
  const parts = hotkeyStr.split('+').map(p => p.trim().toUpperCase());
  const key = parts[parts.length - 1];
  const needAlt = parts.includes('ALT');
  const needCtrl = parts.includes('CTRL') || parts.includes('CONTROL');
  const needShift = parts.includes('SHIFT');
  const needMeta = parts.includes('META') || parts.includes('CMD');

  if (needAlt !== e.altKey) return false;
  if (needCtrl !== e.ctrlKey) return false;
  if (needShift !== e.shiftKey) return false;
  if (needMeta !== e.metaKey) return false;

  return e.key.toUpperCase() === key || e.code.toUpperCase() === ('KEY' + key);
}

document.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }

  if (matchesFuriganaHotkey(e, furiganaHotkey)) {
    e.preventDefault();
    toggleFuriganaInjection();
  }

  // Phím tắt Chụp vùng màn hình dịch chữ (Manga / Screen OCR): Alt + S
  if (e.altKey && (e.key.toUpperCase() === 'S' || e.code === 'KeyS')) {
    e.preventDefault();
    initScreenOcrOverlay();
  }
});

// ========================================================
// TÍNH NĂNG CHỤP VÙNG MÀN HÌNH DỊCH CHỮ (MANGA / SCREEN OCR)
// ========================================================

function showOcrToast(message, isSuccess = true) {
  let toast = document.getElementById('jpex-ocr-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'jpex-ocr-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      top: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      padding: '9px 18px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      pointerEvents: 'none',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      opacity: '0'
    });
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.background = isSuccess ? '#0284c7' : '#dc2626';
  toast.style.color = '#ffffff';
  toast.style.border = isSuccess ? '1px solid #38bdf8' : '1px solid #f87171';
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 2500);
}

function initScreenOcrOverlay() {
  const existingOverlay = document.getElementById('jpex-ocr-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
    return;
  }

  removeFloatingIcon();
  removeTooltip();

  const overlay = document.createElement('div');
  overlay.id = 'jpex-ocr-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '2147483645',
    background: 'rgba(0, 0, 0, 0.28)',
    cursor: 'crosshair',
    userSelect: 'none',
    webkitUserSelect: 'none'
  });

  const hint = document.createElement('div');
  hint.id = 'jpex-ocr-hint';
  hint.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 6px;">
      <span style="font-size: 15px;">📸</span> 
      <span>Kéo chuột khoanh vùng chữ tiếng Nhật cần dịch</span>
    </span>
    <span style="color: #a1a1aa; font-size: 11px; padding: 2px 7px; background: #27272a; border-radius: 4px; font-weight: 500;">Nhấn ESC để hủy</span>
  `;
  Object.assign(hint.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#18181b',
    color: '#ffffff',
    padding: '8px 18px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
    border: '1px solid #3f3f46',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    pointerEvents: 'none',
    zIndex: '2147483647'
  });
  overlay.appendChild(hint);

  const box = document.createElement('div');
  box.id = 'jpex-ocr-box';
  Object.assign(box.style, {
    position: 'fixed',
    border: '2px dashed #38bdf8',
    background: 'rgba(56, 189, 248, 0.12)',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '2147483646'
  });
  overlay.appendChild(box);

  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let currentRect = null;

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    box.style.left = `${startX}px`;
    box.style.top = `${startY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    box.style.display = 'block';
  };

  const onMouseMove = (e) => {
    if (!isSelecting) return;
    const x = Math.min(startX, e.clientX);
    const y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    currentRect = { x, y, width: w, height: h };
  };

  const cleanupOverlay = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onMouseUp = (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    if (!currentRect || currentRect.width < 12 || currentRect.height < 12) {
      cleanupOverlay();
      return;
    }

    const rect = { ...currentRect };
    cleanupOverlay();

    // Hiển thị chỉ báo loading tại vị trí vừa khoanh vùng
    const spinner = document.createElement('div');
    spinner.id = 'jpex-ocr-spinner';
    spinner.innerHTML = `
      <div style="width: 14px; height: 14px; border: 2px solid #38bdf8; border-top-color: transparent; border-radius: 50%; animation: jpex-spin 0.8s linear infinite;"></div>
      <span>Đang nhận diện chữ tiếng Nhật...</span>
    `;
    Object.assign(spinner.style, {
      position: 'fixed',
      left: `${Math.max(10, rect.x)}px`,
      top: `${rect.y + rect.height + 8}px`,
      zIndex: '2147483647',
      background: '#18181b',
      color: '#38bdf8',
      border: '1px solid #0284c7',
      borderRadius: '8px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });
    document.body.appendChild(spinner);

    // Gửi yêu cầu chụp toàn màn hình tab
    chrome.runtime.sendMessage({ action: 'captureVisibleTab' }, (capRes) => {
      if (!capRes || !capRes.success || !capRes.dataUrl) {
        spinner.remove();
        showOcrToast('❌ Không thể chụp màn hình. Vui lòng thử lại!', false);
        return;
      }

      // Cắt ảnh theo tọa độ vùng chọn bằng Canvas
      const img = new Image();
      img.onload = () => {
        try {
          const dpr = window.devicePixelRatio || 1;
          const canvas = document.createElement('canvas');
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          const ctx = canvas.getContext('2d');

          ctx.drawImage(
            img,
            rect.x * dpr,
            rect.y * dpr,
            rect.width * dpr,
            rect.height * dpr,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const croppedBase64 = canvas.toDataURL('image/png');

          // Gửi ảnh cắt tới background.js để gọi OCR
          chrome.runtime.sendMessage({ action: 'performOcr', base64Image: croppedBase64 }, (ocrRes) => {
            spinner.remove();
            if (ocrRes && ocrRes.success && ocrRes.text) {
              let cleanText = ocrRes.text.trim();
              // Chuẩn hóa xóa khoảng trắng thừa giữa các ký tự tiếng Nhật
              cleanText = cleanText.replace(/([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf])\s+([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf])/g, '$1$2');

              const targetRect = {
                left: rect.x,
                right: rect.x + rect.width,
                top: rect.y,
                bottom: rect.y + rect.height,
                width: rect.width,
                height: rect.height
              };

              showTooltip(cleanText, targetRect);
            } else {
              showOcrToast('❌ Không tìm thấy chữ trong vùng chọn. Hãy khoanh vùng sát chữ hơn!', false);
            }
          });
        } catch (err) {
          spinner.remove();
          showOcrToast('❌ Lỗi xử lý hình ảnh: ' + err.message, false);
        }
      };
      img.onerror = () => {
        spinner.remove();
        showOcrToast('❌ Không tải được dữ liệu ảnh chụp.', false);
      };
      img.src = capRes.dataUrl;
    });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      cleanupOverlay();
    }
  };

  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mouseup', onMouseUp);
  overlay.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cleanupOverlay();
  });
  document.addEventListener('keydown', onKeyDown);

  document.body.appendChild(overlay);
}

// Lắng nghe lệnh kích hoạt OCR từ Popup Extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScreenOcr') {
    initScreenOcrOverlay();
    sendResponse({ success: true });
  }
});
