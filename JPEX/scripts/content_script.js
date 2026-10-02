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

// Đọc cài đặt ban đầu từ storage
if (typeof getAppSettings === 'function') {
  getAppSettings().then(settings => {
    isAutoTranslateEnabled = !!settings.autoTranslateOnSelect;
    isHoverLookupEnabled = settings.hoverLookupEnabled !== false;
    hoverKey = settings.hoverKey || 'Shift';
    console.log('[JP-Dict Content] Cài đặt ban đầu:', { isAutoTranslateEnabled, isHoverLookupEnabled, hoverKey });
  });
}

// Lắng nghe thay đổi cài đặt Realtime từ Popup hoặc Tooltip
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['jpDictAppSettings']) {
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
      console.log('[JP-Dict Content] Đã cập nhật cài đặt Realtime:', { isAutoTranslateEnabled, isHoverLookupEnabled, hoverKey });
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
    icon.innerText = '辞';
    icon.title = 'Tra cứu từ này';

    // Cấu hình CSS inline kèm '!important'
    const styles = {
      'position': 'absolute',
      'display': 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'top': `${top}px`,
      'left': `${left}px`,
      'width': '26px',
      'height': '26px',
      'border-radius': '50%',
      'background-color': '#E11D48', // Trích xuất từ --primary
      'color': '#FFFFFF',
      'border': 'none',
      'outline': 'none',
      'cursor': 'pointer',
      'box-shadow': '0 4px 12px rgba(225, 29, 72, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)',
      'font-size': '13px',
      'font-weight': 'bold',
      'font-family': '"Outfit", "Noto Sans JP", -apple-system, BlinkMacSystemFont, sans-serif',
      'z-index': '2147483647',
      'transition': 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s',
      'padding': '0',
      'line-height': '1',
      'user-select': 'none',
      '-webkit-user-select': 'none'
    };

    for (const [key, value] of Object.entries(styles)) {
      icon.style.setProperty(key, value, 'important');
    }

    // Hiệu ứng Hover mượt mà
    icon.addEventListener('mouseenter', () => {
      icon.style.setProperty('transform', 'scale(1.15)', 'important');
      icon.style.setProperty('box-shadow', '0 6px 16px rgba(225, 29, 72, 0.55), 0 3px 6px rgba(0, 0, 0, 0.15)', 'important');
    });
    icon.addEventListener('mouseleave', () => {
      icon.style.setProperty('transform', 'none', 'important');
      icon.style.setProperty('box-shadow', '0 4px 12px rgba(225, 29, 72, 0.4), 0 2px 4px rgba(0, 0, 0, 0.1)', 'important');
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

  // Lấy cài đặt ngôn ngữ hiện hành
  let currentTargetLang = 'both';
  if (typeof getAppSettings === 'function') {
    getAppSettings().then(s => {
      if (s && s.targetLang) currentTargetLang = s.targetLang;
    }).catch(() => {});
  }

  // Gửi thông điệp tra cứu
  chrome.runtime.sendMessage({ action: 'translate', text: text, targetLang: currentTargetLang }, (response) => {
    if (chrome.runtime.lastError) {
      loaderText.innerText = 'Lỗi kết nối Extension. Hãy F5 trang web!';
      return;
    }

    if (response && response.success) {
      const data = response.data;
      currentTargetLang = data.targetLang || currentTargetLang;
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
      });

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

      // 2. Hàm dựng giao diện nội dung các Tab theo ngôn ngữ đã chọn
      const renderPanes = (lang) => {
        const vocabList = data.results || [data];
        const kanjiList = data.kanjis || [];
        const transObj = data.translation || { 
          sourceText: text, 
          translatedVi: data.meaningVi || data.meaning, 
          translatedEn: data.meaningEn || '', 
          translatedText: data.meaning 
        };

        // Render Cards Tab 1: Từ vựng
        const vocabCardsHtml = vocabList.map(item => {
          let meaningHtml = '';
          const vi = item.meaningVi || (lang !== 'en' ? item.meaning : '');
          const en = item.meaningEn || (lang === 'en' ? item.meaning : '');

          if (lang === 'both') {
            meaningHtml = `
              ${vi ? `<div class="card-meaning-row"><span class="badge-lang vi">VI</span> <span>${vi}</span></div>` : ''}
              ${en ? `<div class="card-meaning-row en"><span class="badge-lang en">EN</span> <span>${en}</span></div>` : ''}
              ${!vi && !en ? `<div>${item.meaning || 'Chưa rõ nghĩa'}</div>` : ''}
            `;
          } else if (lang === 'en') {
            meaningHtml = `<div>${en || vi || item.meaning || 'Chưa rõ nghĩa'}</div>`;
          } else {
            meaningHtml = `<div>${vi || item.meaning || 'Chưa rõ nghĩa'}</div>`;
          }

          return `
            <div class="dict-card">
              <div class="card-line-1">
                <span class="card-word">${item.kanji}</span>
                <span class="card-reading">${item.reading || ''}</span>
              </div>
              <div class="card-line-2">${item.hanviet || ''}</div>
              <div class="card-line-3">${meaningHtml}</div>
            </div>
          `;
        }).join('');

        // Render Cards Tab 2: Hán tự
        const kanjiCardsHtml = kanjiList.length > 0 ? kanjiList.map(k => {
          const metaParts = [];
          if (k.strokes) metaParts.push(`${k.strokes} nét`);
          if (k.radical) metaParts.push(`Bộ: ${k.radical}`);
          const metaStr = metaParts.length > 0 ? `<div class="kanji-meta">${metaParts.join(' • ')}</div>` : '';

          return `
            <div class="dict-card kanji-single-card">
              <div class="kanji-main-char">${k.char}</div>
              <div class="card-line-2">${k.hanviet}</div>
              ${metaStr}
              <div class="card-line-3">${k.meaning}</div>
            </div>
          `;
        }).join('') : `
          <div class="dict-card kanji-single-card">
            <div class="card-line-3">Không tìm thấy Hán tự trong từ khóa này.</div>
          </div>
        `;

        // Render Tab 3: Dịch
        let transOutputHtml = '';
        const transVi = transObj.translatedVi || (lang !== 'en' ? transObj.translatedText : '');
        const transEn = transObj.translatedEn || (lang === 'en' ? transObj.translatedText : '');

        if (lang === 'both') {
          transOutputHtml = `
            ${transVi ? `
              <div class="trans-row">
                <span class="badge-lang vi">VI</span>
                <div class="trans-dst-text">${transVi}</div>
              </div>` : ''}
            ${transEn ? `
              <div class="trans-row">
                <span class="badge-lang en">EN</span>
                <div class="trans-dst-text en-trans">${transEn}</div>
              </div>` : ''}
            ${!transVi && !transEn ? `<div class="trans-dst-text">${transObj.translatedText}</div>` : ''}
          `;
        } else if (lang === 'en') {
          transOutputHtml = `<div class="trans-dst-text">${transEn || transVi || transObj.translatedText}</div>`;
        } else {
          transOutputHtml = `<div class="trans-dst-text">${transVi || transObj.translatedText}</div>`;
        }

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
              <div class="trans-action-hint">Phân tích đa ngữ siêu tốc</div>
            </div>
          </div>

          <!-- FOOTER: BỘ CHỌN NGÔN NGỮ & CÀI ĐẶT -->
          <div class="tooltip-footer">
            <div class="lang-selector-group">
              <span class="lang-lbl">Dịch:</span>
              <button class="lang-btn ${lang === 'both' ? 'active' : ''}" data-lang="both" title="Song ngữ Việt - Anh">Song ngữ</button>
              <button class="lang-btn ${lang === 'vi' ? 'active' : ''}" data-lang="vi" title="Chỉ dịch Tiếng Việt">Việt</button>
              <button class="lang-btn ${lang === 'en' ? 'active' : ''}" data-lang="en" title="English only">Anh</button>
            </div>
            <span class="settings-hint-link" title="Mở trang cài đặt">Cài đặt</span>
          </div>
        `;

        // 3. Xử lý chuyển đổi Tab mượt mà
        const paneVocab = content.querySelector('#pane-vocab');
        const paneKanji = content.querySelector('#pane-kanji');
        const paneTrans = content.querySelector('#pane-trans');

        const tabs = [
          { btn: btnTabVocab, pane: paneVocab },
          { btn: btnTabKanji, pane: paneKanji },
          { btn: btnTabTrans, pane: paneTrans }
        ];

        // Giữ tab active hiện tại
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

        // 4. Lắng nghe chuyển đổi ngôn ngữ dịch ngay trên Tooltip
        const langBtns = content.querySelectorAll('.lang-btn');
        langBtns.forEach(b => {
          b.addEventListener('click', async (e) => {
            e.stopPropagation();
            const newLang = b.dataset.lang;
            if (newLang !== currentTargetLang) {
              currentTargetLang = newLang;
              if (typeof updateAppSettings === 'function') {
                await updateAppSettings({ targetLang: newLang });
              }
              renderPanes(newLang);
            }
          });
        });

        // 5. Nút Cài đặt
        const settingsLink = content.querySelector('.settings-hint-link');
        if (settingsLink) {
          settingsLink.addEventListener('click', (e) => {
            e.stopPropagation();
            alert('Bạn có thể tùy chỉnh Chế độ Tự Động Dịch và Ngôn Ngữ Dịch Mặc Định trong thẻ Cài đặt của Tiện ích mở rộng!');
          });
        }
      };

      // Render nội dung ban đầu
      renderPanes(currentTargetLang);

    } else {
      loaderText.innerText = 'Không tìm thấy kết quả tra cứu.';
      const spinnerEl = loader.querySelector('.spinner');
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  });
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
function playPronunciation(text) {
  const cleanText = text.replace(/\([^)]*\)/g, '').trim(); // Bỏ phần giải nghĩa phụ trong ngoặc nếu có
  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${encodeURIComponent(cleanText)}`;
  
  const audio = new Audio(googleTtsUrl);
  audio.play().catch((err) => {
    console.warn('[JP-Dict] Không phát được Google TTS (do CSP). Dùng Web Speech API:', err);
    
    // Fallback sang Web Speech API (Không bị chặn bởi CSP)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ja-JP';
      utterance.rate = 0.85; // Tốc độ vừa phải
      window.speechSynthesis.speak(utterance);
    } else {
      console.error('[JP-Dict] Trình duyệt không hỗ trợ Web Speech API.');
    }
  });
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
