const fs = require('fs');
const path = require('path');

console.log('=== KIỂM THỬ TỔNG HỢP TOÀN DIỆN CÁC YÊU CẦU CỦA ĐỀ BÀI ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failCount++;
  }
}

// ----------------------------------------------------
// PHẦN 1: DỮ LIỆU TỪ VỰNG JLPT N1-N5 NGHĨA TIẾNG VIỆT
// ----------------------------------------------------
console.log('--- 1. Kiểm tra nghĩa Tiếng Việt của toàn bộ từ vựng JLPT N1–N5 ---');
const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
let totalVocab = 0;
let missingVietnameseMeaningCount = 0;
let placeholderCount = 0;
let englishOnlyCount = 0;

const viCharRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

levels.forEach(lvl => {
  const filePath = path.join(__dirname, '..', 'JPEX', 'data', 'jlpt', 'vocab', `${lvl}.json`);
  assert(fs.existsSync(filePath), `File dữ liệu ${lvl}.json tồn tại`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  totalVocab += data.length;

  data.forEach(item => {
    const meaningText = (item.meaning || item.meaningVi || '').trim();
    if (!meaningText) {
      missingVietnameseMeaningCount++;
    } else if (meaningText.includes('Chưa có nghĩa') || meaningText.includes('placeholder')) {
      placeholderCount++;
    } else if (!viCharRegex.test(meaningText)) {
      englishOnlyCount++;
    }
  });
});

assert(totalVocab === 7811, `Tổng số từ vựng N1-N5 đạt 7,811 mục (thực tế: ${totalVocab})`);
assert(missingVietnameseMeaningCount === 0, `missingVietnameseMeaningCount = 0 (thực tế: ${missingVietnameseMeaningCount})`);
assert(placeholderCount === 0, `Không chứa bất kỳ placeholder nào (thực tế: ${placeholderCount})`);
assert(englishOnlyCount === 0, `Không có từ nào chỉ có tiếng Anh hoặc thiếu dấu tiếng Việt (thực tế: ${englishOnlyCount})`);

// ----------------------------------------------------
// PHẦN 2: XÓA TÍNH NĂNG TRA CỨU JLPT ĐỘC LẬP TẠI POPUP
// ----------------------------------------------------
console.log('\n--- 2. Kiểm tra việc gỡ bỏ tra cứu JLPT độc lập tại popup ---');
const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'popup.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'scripts', 'popup.js'), 'utf8');

assert(!popupHtml.includes('id="jlpt-tab"'), 'Popup HTML không còn section độc lập #jlpt-tab');
assert(!popupHtml.includes('data-tab="jlpt-tab"'), 'Popup HTML không còn nút tab data-tab="jlpt-tab"');
assert(popupHtml.includes('btn-popup-banner-workspace'), 'Popup HTML có banner điều hướng chuyển sang Workspace để học JLPT');
assert(!popupJs.includes('function setupJLPTTab'), 'Popup JS không còn hàm standalone setupJLPTTab');
assert(!popupJs.includes('function loadAndRenderJLPTWords'), 'Popup JS không còn hàm loadAndRenderJLPTWords độc lập');

// ----------------------------------------------------
// PHẦN 3: TÍCH HỢP TẬP TRUNG JLPT VÀO WORKSPACE
// ----------------------------------------------------
console.log('\n--- 3. Kiểm tra tích hợp JLPT vào Workspace ---');
const workspaceHtml = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'workspace.html'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'scripts', 'workspace.js'), 'utf8');

assert(workspaceHtml.includes('id="nav-jlpt"'), 'Workspace Sidebar có mục menu JLPT N1–N5');
assert(workspaceHtml.includes('id="view-jlpt"'), 'Workspace có view section #view-jlpt');
assert(workspaceHtml.includes('data-level="N5"') && workspaceHtml.includes('data-level="N1"'), 'Workspace có đầy đủ nút chọn cấp độ N1–N5');
assert(workspaceJs.includes("normalizedView === 'jlpt'") || workspaceJs.includes("viewName === 'jlpt'"), 'Workspace JS điều hướng chính xác vào renderJLPTView');

// ----------------------------------------------------
// PHẦN 4: HƯỚNG DẪN SỬ DỤNG TIẾNG VIỆT TOÀN DIỆN (A - F)
// ----------------------------------------------------
console.log('\n--- 4. Kiểm tra Hướng dẫn sử dụng tiếng Việt (Mục A đến F) ---');
assert(workspaceHtml.includes('id="nav-guide"'), 'Workspace có menu điều hướng #nav-guide (Hướng dẫn sử dụng)');
assert(workspaceHtml.includes('id="view-guide"'), 'Workspace có view section #view-guide');
assert(workspaceHtml.includes('id="guide-sec-a"'), 'Có Mục A: Bắt đầu học (Chọn cấp độ, danh mục, bắt đầu phiên)');
assert(workspaceHtml.includes('id="guide-sec-b"'), 'Có Mục B: Thêm từ vựng vào danh sách ôn tập');
assert(workspaceHtml.includes('id="guide-sec-c"'), 'Có Mục C: Sử dụng flashcards (Mặt trước, lật thẻ, chấm điểm)');
assert(workspaceHtml.includes('id="guide-sec-d"'), 'Có Mục D: Ôn tập và ghi nhớ (Thuật toán SRS, Chưa nhớ / Đã nhớ)');
assert(workspaceHtml.includes('id="guide-sec-e"'), 'Có Mục E: Theo dõi tiến độ (Thẻ đến hạn, tỉ lệ ghi nhớ)');
assert(workspaceHtml.includes('id="guide-sec-f"'), 'Có Mục F: Nhập dữ liệu cá nhân (Chuẩn 6 trường JSON, AI Prompt)');
assert(workspaceJs.includes("guide: 'Hướng dẫn sử dụng toàn diện'"), 'Workspace JS có tiêu đề cho view guide');
assert(workspaceJs.includes("switchView('guide')"), 'Workspace JS có sự kiện kích hoạt chuyển view guide');

// ----------------------------------------------------
// PHẦN 5: BẢO TOÀN DỮ LIỆU CÁ NHÂN VÀ TÍNH NĂNG NỀN TẢNG
// ----------------------------------------------------
console.log('\n--- 5. Kiểm tra bảo toàn các tính năng cốt lõi ---');
const storageJs = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'scripts', 'storage.js'), 'utf8');
assert(storageJs.includes('getDecks'), 'Hàm getDecks được bảo toàn');
assert(storageJs.includes('saveDeck'), 'Hàm saveDeck được bảo toàn');
assert(storageJs.includes('getSavedWords'), 'Hàm getSavedWords được bảo toàn');
assert(storageJs.includes('recordReviewHistory') || storageJs.includes('addWordToReview'), 'Hàm ghi nhận ôn tập được bảo toàn');

console.log('\n========================================================');
console.log(`KẾT QUẢ: ${passCount} / ${passCount + failCount} KIỂM TRA ĐẠT (${Math.round(passCount / (passCount + failCount) * 100)}%)`);
console.log('========================================================');

if (failCount > 0) process.exit(1);
