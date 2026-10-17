const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('KIỂM THỬ TÍNH NĂNG: CẢI THIỆN HIỂN THỊ NGHĨA TỪ VỰNG');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
  }
}

// Nạp mã nguồn workspace.js để kiểm thử các hàm tiện ích
const workspaceJs = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'scripts', 'workspace.js'), 'utf8');

// Tạo mock môi trường thực thi để eval các hàm từ workspace.js
const sandbox = {
  document: {
    addEventListener: () => {},
    querySelectorAll: () => [],
    getElementById: () => null
  },
  window: {
    addEventListener: () => {}
  },
  JPEXDatabase: class {},
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

const scriptFn = new Function('document', 'window', 'JPEXDatabase', 'localStorage', `
  ${workspaceJs}
  return {
    parseMeaningSenses,
    getPrimaryMeaningText,
    formatExpandableMeaning,
    escapeHtml
  };
`);

const { parseMeaningSenses, getPrimaryMeaningText, formatExpandableMeaning } = scriptFn(sandbox.document, sandbox.window, sandbox.JPEXDatabase, sandbox.localStorage);

// ----------------------------------------------------
// TEST 1: Kiểm thử từ vựng phức tạp nhiều nghĩa: 空く (あく)
// ----------------------------------------------------
console.log('--- TEST 1: Kiểm thử từ vựng 空く (あく) theo yêu cầu đề bài ---');

const n4Data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'data', 'jlpt', 'vocab', 'n4.json'), 'utf8'));
const aku = n4Data.find(w => w.word === '空く' && w.reading === 'あく');

assert(!!aku, 'Tìm thấy từ 空く (あく) trong tập dữ liệu N4');
assert(aku.meaning && aku.meaningVi, 'Từ 空く có cả meaning và meaningVi');

const sensesAku = parseMeaningSenses(aku.meaning);
assert(sensesAku.length >= 3, `Phân tách được ${sensesAku.length} phân đoạn ý nghĩa của 空く`);

const primaryTextAku = getPrimaryMeaningText(aku.meaning, 3);
assert(primaryTextAku.includes('Trống') || primaryTextAku.includes('trống'), 'Nghĩa chính chứa "trống / để trống" phù hợp JLPT N4');
assert(primaryTextAku.includes('Rảnh') || primaryTextAku.includes('rảnh'), 'Nghĩa chính chứa "rảnh rỗi" phù hợp với ví dụ thực tế');
assert(primaryTextAku.includes('Mở') || primaryTextAku.includes('mở'), 'Nghĩa chính chứa "mở / ngỏ"');

const htmlAku = formatExpandableMeaning(aku.meaning, aku.originalMeaning, aku.id);
assert(htmlAku.includes('class="meaning-display-wrapper"'), 'Tạo wrapper chứa layout nghĩa chuyên nghiệp');
assert(htmlAku.includes('class="meaning-primary-list"'), 'Hiển thị danh sách nghĩa chính');
assert(htmlAku.includes('class="btn-toggle-meaning"'), 'Có nút bấm mở rộng "Xem thêm nghĩa"');
assert(htmlAku.includes('class="meaning-extended-drawer"'), 'Có ngăn kéo chứa toàn bộ danh sách nghĩa chi tiết');
assert(htmlAku.includes('to open; to become empty'), 'Bảo toàn nguyên vẹn nghĩa gốc [Gốc]');

// ----------------------------------------------------
// TEST 2: Kiểm thử các từ ngắn và trung bình
// ----------------------------------------------------
console.log('\n--- TEST 2: Kiểm thử từ ngắn và trung bình ---');

const shortMeaning = 'Ăn cơm, dùng bữa';
const htmlShort = formatExpandableMeaning(shortMeaning, 'to eat', 'short_1');
assert(!htmlShort.includes('btn-toggle-meaning'), 'Từ ngắn không tạo nút Xem thêm thừa thãi');
assert(htmlShort.includes('Ăn cơm, dùng bữa'), 'Hiển thị đúng nghĩa ngắn');

const mediumMeaning = 'Học tập; Rèn luyện tri thức; Trau dồi kỹ năng';
const htmlMedium = formatExpandableMeaning(mediumMeaning, 'to study', 'med_1');
assert(htmlMedium.includes('Học tập'), 'Phân tách đúng nghĩa 1');
assert(htmlMedium.includes('Rèn luyện tri thức'), 'Phân tách đúng nghĩa 2');

// ----------------------------------------------------
// TEST 3: Kiểm định tính toàn vẹn của toàn bộ dữ liệu 7.811 từ
// ----------------------------------------------------
console.log('\n--- TEST 3: Kiểm định tính toàn vẹn dữ liệu N5–N1 ---');

const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
let totalChecked = 0;
let parseErrors = 0;

levels.forEach(lvl => {
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'data', 'jlpt', 'vocab', `${lvl}.json`), 'utf8'));
  totalChecked += list.length;
  list.forEach((item, idx) => {
    try {
      const out = formatExpandableMeaning(item.meaning || item.meaningVi, item.originalMeaning, `${lvl}-${idx}`);
      if (!out || typeof out !== 'string') parseErrors++;
    } catch (e) {
      parseErrors++;
    }
  });
});

assert(totalChecked === 7811, `Kiểm định đủ 7.811 mục từ trên toàn bộ 5 cấp độ N1–N5`);
assert(parseErrors === 0, `Không có bất kỳ lỗi phân tích nghĩa nào (parseErrors = 0)`);

// ----------------------------------------------------
// TEST 4: Kiểm tra tính nhất quán trong Workspace UI
// ----------------------------------------------------
console.log('\n--- TEST 4: Kiểm tra tính nhất quán trên các View của Workspace ---');

assert(workspaceJs.includes('formatExpandableMeaning(item.meaning || item.meaningVi, item.originalMeaning, item.id)'), 'renderJLPTVocabTable áp dụng formatExpandableMeaning');
assert(workspaceJs.includes('saved-${word.id || index}') && workspaceJs.includes('formatExpandableMeaning(word.meaning'), 'renderSavedWordsView áp dụng formatExpandableMeaning');
assert(workspaceJs.includes('deck-${card.id || card.word}') && workspaceJs.includes('formatExpandableMeaning(card.meaning'), 'renderDeckDetailView áp dụng formatExpandableMeaning');
assert(workspaceJs.includes('srs-${card.id || idx}') && workspaceJs.includes('formatExpandableMeaning(card.meaning'), 'renderSrsHubView áp dụng formatExpandableMeaning');
assert(workspaceJs.includes('dict-${item.word}') && workspaceJs.includes('formatExpandableMeaning(item.meaning'), 'renderDictSearchResults áp dụng formatExpandableMeaning');
assert(workspaceJs.includes('getPrimaryMeaningText(choice.meaning || choice.meaningVi)'), 'Quiz áp dụng getPrimaryMeaningText để chống tràn nút trắc nghiệm');
assert(workspaceJs.includes('getPrimaryMeaningText(card.meaning || card.meaningVi'), 'Flashcard chiều Vi->JP áp dụng getPrimaryMeaningText');

// Kiểm tra CSS styles
const workspaceCss = fs.readFileSync(path.join(__dirname, '..', 'JPEX', 'styles', 'workspace.css'), 'utf8');
assert(workspaceCss.includes('.meaning-display-wrapper'), 'CSS có định nghĩa .meaning-display-wrapper');
assert(workspaceCss.includes('.btn-toggle-meaning'), 'CSS có định nghĩa .btn-toggle-meaning');
assert(workspaceCss.includes('.meaning-extended-drawer'), 'CSS có định nghĩa .meaning-extended-drawer');

console.log('\n====================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${passedTests + failedTests} TESTS ĐẠT`);
if (failedTests === 0) {
  console.log('🎉 TẤT CẢ CÁC KIỂM TRA ĐỀU THÀNH CÔNG RỰC RỠ! (100% PASS)');
} else {
  console.error(`⚠️ CÓ ${failedTests} KIỂM TRA THẤT BẠI.`);
  process.exit(1);
}
console.log('====================================================');
