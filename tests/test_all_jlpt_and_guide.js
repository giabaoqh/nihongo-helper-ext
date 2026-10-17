const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '../JPEX');

console.log('====================================================');
console.log('KIỂM TRA HỆ THỐNG TOÀN DIỆN (COMPREHENSIVE TEST RUN)');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

// ----------------------------------------------------
// TEST SUITE 1: Kiểm định các file dữ liệu JLPT
// ----------------------------------------------------
console.log('--- TEST SUITE 1: Dữ liệu JLPT (Data Integrity) ---');

const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
const expectedVocabCounts = { n5: 674, n4: 630, n3: 1659, n2: 1778, n1: 3070 };
const expectedKanjiCounts = { n5: 84, n4: 169, n3: 387, n2: 398, n1: 1345 };
const expectedGrammarCounts = { n5: 81, n4: 98, n3: 101, n2: 123, n1: 123 };

let grandTotalRecords = 0;
let vocabTotal = 0;
let kanjiTotal = 0;
let grammarTotal = 0;

// 1.1 Kiểm tra Từ vựng (Vocab)
levels.forEach(lvl => {
  const p1 = path.join(BASE_DIR, 'data', 'jlpt', 'vocab', `${lvl}.json`);
  assert(fs.existsSync(p1), `File vocab/${lvl}.json tồn tại`);

  const d1 = JSON.parse(fs.readFileSync(p1, 'utf8'));
  assert(d1.length === expectedVocabCounts[lvl], `Vocab ${lvl.toUpperCase()} có đúng ${expectedVocabCounts[lvl]} từ (thực tế: ${d1.length})`);

  vocabTotal += d1.length;

  let validSchema = true;
  let honestTranslations = true;
  let missingVi = 0;
  for (const item of d1) {
    if (!item.id || !item.word || !item.reading || !item.level) {
      validSchema = false;
    }
    const m = (item.meaningVi || item.meaning || '').trim();
    if (!m || m === '' || m.includes('Chưa có nghĩa tiếng Việt')) {
      missingVi++;
    }
    if (item.translationStatus !== 'verified') {
      honestTranslations = false;
    }
  }
  assert(validSchema, `Vocab ${lvl.toUpperCase()} thỏa mãn schema bắt buộc (id, word, reading, level)`);
  assert(missingVi === 0, `Vocab ${lvl.toUpperCase()}: 100% mục từ có nghĩa tiếng Việt xác thực (missing = 0)`);
  assert(honestTranslations, `Vocab ${lvl.toUpperCase()}: 100% trạng thái dịch được xác thực (verified)`);
});

// 1.2 Kiểm tra Chữ Hán (Kanji)
levels.forEach(lvl => {
  const p = path.join(BASE_DIR, 'data', 'jlpt', 'kanji', `${lvl}.json`);
  assert(fs.existsSync(p), `File kanji/${lvl}.json tồn tại`);

  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert(d.length === expectedKanjiCounts[lvl], `Kanji ${lvl.toUpperCase()} có đúng ${expectedKanjiCounts[lvl]} chữ (thực tế: ${d.length})`);

  kanjiTotal += d.length;

  let validKanji = true;
  for (const item of d) {
    if (!item.id || !item.character || !item.level || !item.meaningVi) {
      validKanji = false;
    }
  }
  assert(validKanji, `Kanji ${lvl.toUpperCase()} có character, level và nghĩa tiếng Việt đầy đủ`);
});

// 1.3 Kiểm tra Ngữ pháp (Grammar)
levels.forEach(lvl => {
  const p = path.join(BASE_DIR, 'data', 'jlpt', 'grammar', `${lvl}.json`);
  assert(fs.existsSync(p), `File grammar/${lvl}.json tồn tại`);

  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert(d.length === expectedGrammarCounts[lvl], `Grammar ${lvl.toUpperCase()} có đúng ${expectedGrammarCounts[lvl]} cấu trúc (thực tế: ${d.length})`);

  grammarTotal += d.length;

  let validGrammar = true;
  for (const item of d) {
    if (!item.id || !item.pattern || !item.level || !item.meaningVi) {
      validGrammar = false;
    }
  }
  assert(validGrammar, `Grammar ${lvl.toUpperCase()} có pattern, level và giải thích tiếng Việt`);
});

grandTotalRecords = vocabTotal + kanjiTotal + grammarTotal;
assert(grandTotalRecords === 10720, `Tổng số bản ghi JLPT offline đạt chuẩn 10.720 mục (thực tế: ${grandTotalRecords})`);

// 1.4 Kiểm tra meta.json
const metaPath = path.join(BASE_DIR, 'data', 'jlpt', 'meta.json');
assert(fs.existsSync(metaPath), 'File meta.json tồn tại');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
assert(meta.license === 'CC BY-SA 4.0', 'Meta ghi nhận đúng giấy phép CC BY-SA 4.0');
assert(meta.grandTotal === 10720, 'Meta khớp đúng 10.720 mục');

// ----------------------------------------------------
// TEST SUITE 2: Kiểm định Storage Service APIs
// ----------------------------------------------------
console.log('\n--- TEST SUITE 2: Storage Service APIs ---');

// Mock chrome & fetch cho Node.js
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => cb({ savedWords: [], jpex_decks: [], jpex_cards: [] }),
      set: (data, cb) => { if (cb) cb(); }
    }
  },
  runtime: {
    getURL: (relPath) => `chrome-extension://dummy/${relPath}`
  }
};

global.fetch = async (url) => {
  const cleanUrl = url.replace('chrome-extension://dummy/', '').replace(/^\//, '');
  const filePath = path.join(BASE_DIR, cleanUrl);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      ok: true,
      json: async () => JSON.parse(content),
      text: async () => content
    };
  }
  throw new Error(`File not found: ${filePath}`);
};

const storageCode = fs.readFileSync(path.join(BASE_DIR, 'scripts', 'storage.js'), 'utf8');
eval(storageCode);

assert(typeof getJLPTData === 'function', 'getJLPTData được định nghĩa');
assert(typeof getJLPTWords === 'function', 'getJLPTWords được định nghĩa');
assert(typeof getJLPTKanji === 'function', 'getJLPTKanji được định nghĩa');
assert(typeof getJLPTGrammar === 'function', 'getJLPTGrammar được định nghĩa');
assert(typeof searchJLPTData === 'function', 'searchJLPTData được định nghĩa');
assert(typeof getJLPTStudyStats === 'function', 'getJLPTStudyStats được định nghĩa');
assert(typeof addJLPTItemsToDeck === 'function', 'addJLPTItemsToDeck được định nghĩa');
assert(typeof parseAndValidatePersonalImport === 'function', 'parseAndValidatePersonalImport được định nghĩa');

(async () => {
  // Test query data
  const n4Words = await getJLPTWords('N4');
  assert(n4Words.length === 630, `getJLPTWords('N4') trả về đúng 630 từ`);

  const n5Kanji = await getJLPTKanji('N5');
  assert(n5Kanji.length === 84, `getJLPTKanji('N5') trả về đúng 84 chữ Hán`);

  const n5Grammar = await getJLPTGrammar('N5');
  assert(n5Grammar.length === 81, `getJLPTGrammar('N5') trả về đúng 81 điểm ngữ pháp`);

  // Test search đa năng
  const searchResultWord = await searchJLPTData('食べる', 'N5', 'vocab');
  assert(searchResultWord.length > 0 && searchResultWord[0].word === '食べる', 'Tìm kiếm từ vựng theo Kanji "食べる" thành công');

  const searchResultHanviet = await searchJLPTData('NHẬT', 'N5', 'kanji');
  assert(searchResultHanviet.length > 0 && searchResultHanviet.some(k => k.character === '日'), 'Tìm kiếm Chữ Hán theo âm Hán Việt "NHẬT" thành công');

  const searchResultGrammar = await searchJLPTData('から', 'N5', 'grammar');
  assert(searchResultGrammar.length > 0, 'Tìm kiếm Ngữ pháp theo mẫu "から" thành công');

  // Test Parse & Validate Personal Import (JSON)
  const sampleJson = JSON.stringify([
    { word: '勉強', reading: 'べんきょう', hanviet: 'MIỄN CƯỠNG', meaning: 'Học tập', example: '日本語を勉強します', exampleMeaning: 'Học tiếng Nhật' },
    { word: '飲む', reading: 'のむ', meaning: 'Uống' },
    { word: '', reading: 'thiếu word', meaning: 'Lỗi' }
  ]);

  const jsonValidation = parseAndValidatePersonalImport(sampleJson, 'json');
  assert(jsonValidation.totalCount === 3, 'Import JSON: Đếm đúng 3 dòng');
  assert(jsonValidation.validCount === 2, 'Import JSON: 2 dòng hợp lệ');
  assert(jsonValidation.errorCount === 1, 'Import JSON: Phát hiện đúng 1 dòng lỗi');

  // Test Parse & Validate Personal Import (CSV)
  const sampleCsv = `word,reading,hanviet,meaning,example,exampleMeaning\n日本語,にほんご,NHẬT BẢN NGỮ,Tiếng Nhật,日本語を学ぶ,Học tiếng Nhật\n本,ほん,BẢN,Sách,本を読む,Đọc sách`;
  const csvValidation = parseAndValidatePersonalImport(sampleCsv, 'csv');
  assert(csvValidation.totalCount === 2, 'Import CSV: Đếm đúng 2 dòng');
  assert(csvValidation.validCount === 2, 'Import CSV: 2 dòng hợp lệ');
  assert(csvValidation.validItems[0].hanviet === 'NHẬT BẢN NGỮ', 'Import CSV: Trích xuất đúng cột Hán Việt');

  // ----------------------------------------------------
  // TEST SUITE 3: Kiểm định Giao diện & Tiếng Việt (UI Labels)
  // ----------------------------------------------------
  console.log('\n--- TEST SUITE 3: Kiểm định Giao diện Tiếng Việt ---');

  const wsHtml = fs.readFileSync(path.join(BASE_DIR, 'workspace.html'), 'utf8');
  assert(wsHtml.includes('id="view-jlpt"'), 'workspace.html có section id="view-jlpt"');
  assert(wsHtml.includes('id="jlpt-subview-vocab"'), 'workspace.html có subview Từ vựng');
  assert(wsHtml.includes('id="jlpt-subview-grammar"'), 'workspace.html có subview Ngữ pháp');
  assert(wsHtml.includes('id="jlpt-subview-kanji"'), 'workspace.html có subview Chữ Hán');
  assert(wsHtml.includes('id="jlpt-subview-flashcard"'), 'workspace.html có subview Thẻ ghi nhớ');
  assert(wsHtml.includes('id="jlpt-subview-progress"'), 'workspace.html có subview Tiến độ học');
  assert(wsHtml.includes('id="jlpt-subview-import"'), 'workspace.html có subview Nhập giáo trình cá nhân');

  // Kiểm tra không sót nhãn tiếng Anh người dùng
  assert(!wsHtml.includes('<th>Vocabulary</th>'), 'Không có cột tiếng Anh "Vocabulary"');
  assert(!wsHtml.includes('<th>Grammar</th>'), 'Không có cột tiếng Anh "Grammar"');
  assert(!wsHtml.includes('<th>Review</th>'), 'Không có cột tiếng Anh "Review"');
  assert(wsHtml.includes('Chưa có nghĩa tiếng Việt'), 'Có xử lý hiển thị chuẩn "Chưa có nghĩa tiếng Việt"');
  assert(wsHtml.includes('Đã có nghĩa tiếng Việt'), 'Có bộ lọc "Đã có nghĩa tiếng Việt"');

  const popupHtml = fs.readFileSync(path.join(BASE_DIR, 'popup.html'), 'utf8');
  assert(!popupHtml.includes('id="jlpt-tab"'), 'popup.html đã gỡ bỏ tab JLPT độc lập');
  assert(!popupHtml.includes('data-tab="jlpt-tab"'), 'popup.html không còn nút chọn tab JLPT');
  assert(popupHtml.includes('btn-popup-banner-workspace'), 'popup.html có banner chuyển hướng học JLPT sang Workspace');

  // Kiểm tra Hướng dẫn sử dụng tiếng Việt (Mục A - F)
  assert(wsHtml.includes('id="view-guide"'), 'workspace.html có section id="view-guide"');
  assert(wsHtml.includes('id="nav-guide"'), 'workspace.html có menu id="nav-guide"');
  assert(wsHtml.includes('id="guide-sec-a"') && wsHtml.includes('id="guide-sec-f"'), 'Hướng dẫn sử dụng có đủ từ Mục A đến Mục F');

  // ----------------------------------------------------
  // TỔNG KẾT KẾT QUẢ
  // ----------------------------------------------------
  console.log('\n====================================================');
  console.log(`KẾT QUẢ KIỂM TRA: ${passedTests}/${totalTests} TESTS ĐẠT`);
  if (failedTests === 0) {
    console.log('🎉 TẤT CẢ CÁC KIỂM TRA ĐỀU THÀNH CÔNG RỰC RỠ! (100% PASS)');
  } else {
    console.error(`⚠️ CÓ ${failedTests} KIỂM TRA THẤT BẠI. CẦN KIỂM TRA LẠI.`);
  }
  console.log('====================================================');
})();
