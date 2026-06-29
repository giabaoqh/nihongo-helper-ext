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
function cleanSelectedText(text) {
  if (!text) return '';
  return text
    .replace(/^[\s「」『』【】（）()\[\]{}、。，．,.!！？?・::：\-\/\\|_“”"’‘]+|[\s「」『』【】（）()\[\]{}、。，．,.!！？?・::：\-\/\\|_“”"’‘]+$/g, '')
    .trim();
}

// Lưu trữ các đối tượng UI đang hiển thị
let activeFloatingIcon = null;
let activeTooltipHost = null;

// Lắng nghe sự kiện thả chuột (mouseup) trên toàn bộ trang web
document.addEventListener('mouseup', handleTextSelection);

// Lắng nghe phím nhấn để hỗ trợ phím tắt Shift dịch nhanh
document.addEventListener('keydown', handleKeyDown);

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
      const rawText = selection.toString().trim();
      const selectedText = cleanSelectedText(rawText);
      
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

    const rawText = selection.toString().trim();
    const selectedText = cleanSelectedText(rawText);

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

    // Tọa độ X, Y tuyệt đối của Floating Icon
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

  const tooltipWidth = 290;

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

  // CSS cô lập lấy cảm hứng từ theme.css
  const style = document.createElement('style');
  style.textContent = `
    .tooltip-card {
      width: ${tooltipWidth}px;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(229, 231, 235, 0.9);
      border-radius: 12px;
      padding: 16px;
      padding-top: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      font-family: 'Outfit', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #1f2937;
      position: relative;
      font-size: 14px;
      line-height: 1.5;
      animation: tooltipFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .drag-handle {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 20px;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px 12px 0 0;
      z-index: 10;
      user-select: none;
      -webkit-user-select: none;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
    .drag-handle::after {
      content: '';
      width: 32px;
      height: 4px;
      background: #d1d5db;
      border-radius: 2px;
      transition: background 0.15s;
    }
    .drag-handle:hover::after {
      background: #9ca3af;
    }

    .resize-handle {
      position: absolute;
      z-index: 11;
    }
    .resize-handle-se {
      bottom: 0; right: 0;
      width: 14px; height: 14px;
      cursor: nwse-resize;
      border-bottom-right-radius: 12px;
    }
    .resize-handle-sw {
      bottom: 0; left: 0;
      width: 14px; height: 14px;
      cursor: nesw-resize;
      border-bottom-left-radius: 12px;
    }
    .resize-handle-ne {
      top: 0; right: 0;
      width: 14px; height: 14px;
      cursor: nesw-resize;
      border-top-right-radius: 12px;
    }
    .resize-handle-nw {
      top: 0; left: 0;
      width: 14px; height: 14px;
      cursor: nwse-resize;
      border-top-left-radius: 12px;
    }
    .resize-handle-e {
      top: 14px; right: 0; bottom: 14px;
      width: 6px;
      cursor: ew-resize;
    }
    .resize-handle-w {
      top: 14px; left: 0; bottom: 14px;
      width: 6px;
      cursor: ew-resize;
    }
    .resize-handle-s {
      bottom: 0; left: 14px; right: 14px;
      height: 6px;
      cursor: ns-resize;
    }
    .resize-handle-n {
      top: 0; left: 14px; right: 14px;
      height: 6px;
      cursor: ns-resize;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .action-buttons {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .close-btn, .save-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, transform 0.15s;
    }

    .close-btn {
      font-size: 18px;
      color: #9ca3af;
    }
    .close-btn:hover {
      color: #ef4444;
    }

    .audio-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
      padding: 0 4px;
      color: #3b82f6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, color 0.15s;
      line-height: 1;
    }
    .audio-btn:hover {
      color: #2563eb;
      transform: scale(1.15);
    }
    .audio-btn:active {
      transform: scale(0.9);
    }

    .save-btn {
      font-size: 20px;
      color: #9ca3af;
    }
    .save-btn:hover {
      color: #f59e0b;
      transform: scale(1.15);
    }
    .save-btn.saved {
      color: #f59e0b;
    }

    .folder-select {
      display: none;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 2px 4px;
      font-size: 11px;
      font-family: inherit;
      color: #374151;
      outline: none;
      max-width: 95px;
      cursor: pointer;
      margin-right: 4px;
      vertical-align: middle;
    }
    .folder-select:hover {
      border-color: #9ca3af;
    }

    .loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 0;
      color: #6b7280;
      font-size: 13px;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(225, 29, 72, 0.1);
      border-top: 3px solid #e11d48;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 8px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Giao diện kết quả */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      margin-bottom: 4px;
      padding-right: 48px; /* Tránh đè lên 2 nút action */
    }
    .kanji-val {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      word-break: break-all;
    }
    .badges-container {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .badge-common {
      background-color: #ECFDF5;
      color: #059669;
      border: 1px solid #A7F3D0;
    }
    .badge-jlpt {
      background-color: #EEF2FF;
      color: #4F46E5;
      border: 1px solid #C7D2FE;
    }
    .reading-row {
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 4px;
    }
    .reading-label {
      font-weight: 600;
      color: #9ca3af;
      margin-right: 4px;
    }
    .reading-val {
      font-style: italic;
    }
    .pos-val {
      font-size: 11px;
      color: #4b5563;
      background: #f3f4f6;
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .divider {
      border-top: 1px solid #e5e7eb;
      margin: 8px 0;
    }
    .info-group {
      margin-bottom: 8px;
    }
    .info-group:last-child {
      margin-bottom: 0;
    }
    .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #9ca3af;
      letter-spacing: 0.05em;
      margin-bottom: 2px;
    }
    .hanviet-val {
      font-size: 15px;
      font-weight: 600;
      color: #e11d48;
    }
    .meaning-val {
      font-size: 13px;
      color: #1f2937;
      background: rgba(243, 244, 246, 0.7);
      padding: 8px 10px;
      border-radius: 8px;
      border-left: 3px solid #e11d48;
      margin-top: 4px;
      max-height: 180px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    
    .words-breakdown-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 6px;
      max-height: 140px;
      overflow-y: auto;
    }
    .word-breakdown-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: rgba(243, 244, 246, 0.6);
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      border: 1px solid rgba(229, 231, 235, 0.5);
      gap: 8px;
    }
    .word-breakdown-left {
      font-weight: 700;
      color: #1f2937;
      white-space: nowrap;
    }
    .word-breakdown-reading {
      font-weight: 400;
      color: #6b7280;
      font-size: 10px;
      margin-left: 4px;
    }
    .word-breakdown-meaning {
      color: #374151;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }
  `;
  shadow.appendChild(style);

  // Tạo khung thẻ Tooltip Card
  const card = document.createElement('div');
  card.className = 'tooltip-card';

  // Thanh kéo (Drag Handle) ở đỉnh Tooltip
  const dragHandle = document.createElement('div');
  dragHandle.className = 'drag-handle';
  dragHandle.title = 'Kéo để di chuyển';
  card.appendChild(dragHandle);

  // --- Logic kéo thả Tooltip (Drag & Drop) ---
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

  // --- Tay cầm co giãn kích thước (Resize Handles) ---
  const resizeDirections = ['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n'];
  let isResizing = false;
  let resizeDir = '';
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartW = 0;
  let resizeStartH = 0;
  let resizeStartLeft = 0;
  let resizeStartTop = 0;
  const MIN_W = 200;
  const MIN_H = 100;

  resizeDirections.forEach(dir => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-handle-${dir}`;
    card.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      resizeDir = dir;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = card.offsetWidth;
      resizeStartH = card.offsetHeight;
      const hostRect = host.getBoundingClientRect();
      resizeStartLeft = hostRect.left + window.scrollX;
      resizeStartTop = hostRect.top + window.scrollY;
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging && !isResizing) return;
    e.preventDefault();

    if (isDragging) {
      const newLeft = e.clientX - dragOffsetX + window.scrollX;
      const newTop = e.clientY - dragOffsetY + window.scrollY;
      host.style.left = `${newLeft}px`;
      host.style.top = `${newTop}px`;
      return;
    }

    if (isResizing) {
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      let newW = resizeStartW;
      let newH = resizeStartH;
      let newLeft = resizeStartLeft;
      let newTop = resizeStartTop;

      if (resizeDir.includes('e')) newW = Math.max(MIN_W, resizeStartW + dx);
      if (resizeDir.includes('w')) { newW = Math.max(MIN_W, resizeStartW - dx); newLeft = resizeStartLeft + (resizeStartW - newW); }
      if (resizeDir.includes('s')) newH = Math.max(MIN_H, resizeStartH + dy);
      if (resizeDir.includes('n')) { newH = Math.max(MIN_H, resizeStartH - dy); newTop = resizeStartTop + (resizeStartH - newH); }

      card.style.width = `${newW}px`;
      card.style.height = `${newH}px`;
      card.style.overflow = 'auto';
      host.style.left = `${newLeft}px`;
      host.style.top = `${newTop}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      dragHandle.style.cursor = 'grab';
    }
    if (isResizing) {
      isResizing = false;
    }
  });

  // Chứa các nút góc trên bên phải
  const actionContainer = document.createElement('div');
  actionContainer.className = 'action-buttons';

  // Dropdown Chọn thư mục
  const folderSelect = document.createElement('select');
  folderSelect.className = 'folder-select';
  folderSelect.title = 'Chọn thư mục lưu từ';
  actionContainer.appendChild(folderSelect);

  // Nút Lưu từ (Bookmarks Star)
  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.innerHTML = '☆'; // Ban đầu là sao trống
  saveBtn.title = 'Lưu từ vào Dashboard';
  actionContainer.appendChild(saveBtn);

  // Nút đóng "X"
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Đóng';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTooltip();
  });
  actionContainer.appendChild(closeBtn);
  card.appendChild(actionContainer);

  // Vùng hiển thị Loading
  const loader = document.createElement('div');
  loader.className = 'loader';
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  const loaderText = document.createElement('div');
  loaderText.innerText = 'Đang kết nối API tra cứu...';
  loader.appendChild(spinner);
  loader.appendChild(loaderText);
  card.appendChild(loader);

  // Vùng hiển thị thông tin kết quả (ẩn ban đầu)
  const content = document.createElement('div');
  content.className = 'content';
  content.style.display = 'none';

  card.appendChild(content);
  shadow.appendChild(card);
  document.body.appendChild(host);
  activeTooltipHost = host;

  // Lắng nghe click ra ngoài để ẩn tooltip
  document.addEventListener('mousedown', handleOutsideClick);

  // Gửi thông điệp qua background service worker
  chrome.runtime.sendMessage({ action: 'translate', text: text }, (response) => {
    if (chrome.runtime.lastError) {
      loaderText.innerText = 'Lỗi kết nối Extension. Hãy F5 trang web!';
      console.error('[JP-Dict] Lỗi runtime.sendMessage:', chrome.runtime.lastError);
      return;
    }

    if (response && response.success) {
      const data = response.data;
      loader.style.display = 'none';
      content.style.display = 'block';

      // 1. Kiểm tra trạng thái đã lưu để thiết lập giao diện nút sao & dropdown thư mục
      getSavedWords().then(async (words) => {
        const savedWord = words.find(w => w.kanji === data.kanji);
        if (savedWord) {
          saveBtn.innerHTML = '★';
          saveBtn.classList.add('saved');
          saveBtn.title = 'Xóa khỏi danh sách lưu';
          
          folderSelect.style.display = 'inline-block';
          await loadFolderOptions(folderSelect, savedWord.folder || "Mặc định");
        } else {
          saveBtn.innerHTML = '☆';
          saveBtn.classList.remove('saved');
          saveBtn.title = 'Lưu từ vào Dashboard';
          
          folderSelect.style.display = 'none';
        }
      });

      // 2. Thêm sự kiện click cho nút lưu
      saveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const saved = saveBtn.classList.contains('saved');
        if (saved) {
          await deleteWord(data.kanji);
          saveBtn.innerHTML = '☆';
          saveBtn.classList.remove('saved');
          saveBtn.title = 'Lưu từ vào Dashboard';
          
          folderSelect.style.display = 'none';
        } else {
          const defaultFolder = "Mặc định";
          await saveWord(data, defaultFolder);
          saveBtn.innerHTML = '★';
          saveBtn.classList.add('saved');
          saveBtn.title = 'Xóa khỏi danh sách lưu';
          
          folderSelect.style.display = 'inline-block';
          await loadFolderOptions(folderSelect, defaultFolder);
        }
      });

      // Lắng nghe thay đổi thư mục chọn
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
            // Reset về thư mục cũ
            const words = await getSavedWords();
            const currentWord = words.find(w => w.kanji === data.kanji);
            await loadFolderOptions(folderSelect, currentWord ? currentWord.folder : "Mặc định");
          }
        } else {
          await updateWordFolder(data.kanji, val);
        }
      });

      // 3. Tạo chuỗi HTML các Badge
      let badgesHtml = '';
      if (data.isCommon) {
        badgesHtml += `<span class="badge badge-common">Phổ biến</span>`;
      }
      if (data.jlpt) {
        badgesHtml += `<span class="badge badge-jlpt">${data.jlpt}</span>`;
      }

      // Tạo chuỗi HTML Từ loại
      let posHtml = '';
      if (data.partOfSpeech) {
        posHtml = `<div class="pos-val">${data.partOfSpeech}</div>`;
      }

      // Tạo phần hiển thị phân tách từ nếu bôi đen câu dài
      let breakdownHtml = '';
      if (data.words && data.words.length > 0) {
        const itemsHtml = data.words.map(w => {
          const readingSpan = w.reading ? `<span class="word-breakdown-reading">(${w.reading})</span>` : '';
          return `
            <div class="word-breakdown-item">
              <div class="word-breakdown-left">
                <span>${w.kanji}</span>${readingSpan}
              </div>
              <div class="word-breakdown-meaning" title="${w.meaningVi}">${w.meaningVi}</div>
            </div>
          `;
        }).join('');

        breakdownHtml = `
          <div class="divider"></div>
          <div class="info-group">
            <div class="label">Phân tách từng từ</div>
            <div class="words-breakdown-list">${itemsHtml}</div>
          </div>
        `;
      }

      // Đổ cấu trúc nội dung giàu thông tin vào Tooltip DOM (Có loa 🔊)
      content.innerHTML = `
        <div class="header-row">
          <div class="kanji-val">${data.kanji}</div>
          <button class="audio-btn" title="Phát âm">🔊</button>
          <div class="badges-container">${badgesHtml}</div>
        </div>
        
        <div class="reading-row">
          <span class="reading-label">Cách đọc:</span>
          <span class="reading-val">${data.reading}</span>
        </div>
        
        ${posHtml}
        
        <div class="divider"></div>
        
        <div class="info-group">
          <div class="label">Âm Hán Việt</div>
          <div class="val hanviet-val">${data.hanviet}</div>
        </div>
        
        <div class="info-group">
          <div class="label">Nghĩa tiếng Việt</div>
          <div class="val meaning-val">${data.meaning}</div>
        </div>
        
        ${breakdownHtml}
      `;

      // 3. Thêm sự kiện click phát âm thanh (Phát âm theo cách đọc Kana để chính xác 100%)
      const audioBtn = content.querySelector('.audio-btn');
      if (audioBtn) {
        audioBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          playPronunciation(data.reading || data.kanji);
        });
      }
    } else {
      loaderText.innerText = 'Không tìm thấy kết quả từ API hoặc kết nối hết hạn.';
      const spinnerEl = loader.querySelector('.spinner');
      if (spinnerEl) {
        spinnerEl.style.display = 'none';
      }
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
