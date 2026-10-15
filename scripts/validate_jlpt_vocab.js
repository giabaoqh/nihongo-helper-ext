// scripts/validate_jlpt_vocab.js
// Script kiểm thử & thẩm định toàn bộ dữ liệu từ vựng JLPT N1–N5 theo Part 2.5
const fs = require('fs');
const path = require('path');

const vocabDir = path.join(__dirname, '..', 'JPEX', 'data', 'jlpt');
const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
const validLevels = new Set(['N5', 'N4', 'N3', 'N2', 'N1']);

// Regex kiểm tra ký tự tiếng Việt có dấu
const viCharsRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

let totalRecords = 0;
let missingVietnameseMeaningCount = 0;
let invalidRecords = 0;
let duplicateCount = 0;
const seenIds = new Set();
const levelStats = {};

console.log('=== BẮT ĐẦU KIỂM ĐỊNH TOÀN DIỆN DỮ LIỆU TỪ VỰNG JLPT N1–N5 ===\n');

for (const lvl of levels) {
  const filePath = path.join(vocabDir, lvl + '.json');
  const subFilePath = path.join(vocabDir, 'vocab', lvl + '.json');
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Tệp dữ liệu không tồn tại: ${filePath}`);
  }
  if (!fs.existsSync(subFilePath)) {
    throw new Error(`Tệp dữ liệu modular không tồn tại: ${subFilePath}`);
  }

  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const subItems = JSON.parse(fs.readFileSync(subFilePath, 'utf8'));

  if (items.length !== subItems.length) {
    throw new Error(`Độ dài hai tệp mirror không đồng bộ: ${filePath} vs ${subFilePath}`);
  }

  let lvlMissing = 0;
  let lvlEnglishOnly = 0;
  let lvlPlaceholders = 0;
  let lvlValid = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    totalRecords++;

    // 1. Kiểm tra ID duy nhất
    if (seenIds.has(item.id)) {
      duplicateCount++;
    } else {
      seenIds.add(item.id);
    }

    // 2. Kiểm tra từ tiếng Nhật
    if (!item.word || typeof item.word !== 'string' || item.word.trim() === '') {
      console.error(`Lỗi từ tiếng Nhật trống tại ${lvl}[${i}] ID: ${item.id}`);
      invalidRecords++;
    }

    // 3. Kiểm tra cách đọc reading
    if (!item.reading || typeof item.reading !== 'string' || item.reading.trim() === '') {
      console.error(`Lỗi cách đọc reading trống tại ${lvl}[${i}] ID: ${item.id}`);
      invalidRecords++;
    }

    // 4. Kiểm tra cấp độ JLPT hợp lệ
    if (!validLevels.has(item.level)) {
      console.error(`Cấp độ JLPT không hợp lệ: "${item.level}" tại ${lvl}[${i}]`);
      invalidRecords++;
    }

    // 5. Kiểm tra nghĩa tiếng Việt chính (meaningVi)
    const mVi = (item.meaningVi || '').trim();
    if (!mVi || mVi === '') {
      missingVietnameseMeaningCount++;
      lvlMissing++;
    } else if (mVi === 'Chưa có nghĩa tiếng Việt' || mVi.toLowerCase().includes('placeholder')) {
      missingVietnameseMeaningCount++;
      lvlPlaceholders++;
    } else if (!viCharsRegex.test(mVi) && mVi === (item.originalMeaning || '').trim()) {
      // Sao chép nguyên gốc tiếng Anh sang tiếng Việt
      missingVietnameseMeaningCount++;
      lvlEnglishOnly++;
    } else {
      lvlValid++;
    }

    // 6. Kiểm tra nguồn dữ liệu (provenance metadata)
    if (!item.source || typeof item.source !== 'string' || item.source.trim() === '') {
      console.error(`Thiếu thông tin nguồn gốc tại ${lvl}[${i}] ID: ${item.id}`);
      invalidRecords++;
    }
  }

  levelStats[lvl.toUpperCase()] = {
    total: items.length,
    validVietnamese: lvlValid,
    missing: lvlMissing,
    placeholders: lvlPlaceholders,
    englishOnly: lvlEnglishOnly
  };
}

console.log('KẾT QUẢ THẨM ĐỊNH CHI TIẾT THEO CẤP ĐỘ:');
console.table(levelStats);

console.log('TỔNG HỢP:');
console.log(`- Tổng số mục từ vựng kiểm định: ${totalRecords.toLocaleString()} từ`);
console.log(`- Số mục từ trùng ID: ${duplicateCount}`);
console.log(`- Số bản ghi lỗi định dạng: ${invalidRecords}`);
console.log(`- missingVietnameseMeaningCount = ${missingVietnameseMeaningCount}`);

if (missingVietnameseMeaningCount === 0 && invalidRecords === 0) {
  console.log('\n✅ [CHẤP NHẬN - ACCEPTANCE PASSED]: 100% mục từ vựng có nghĩa Tiếng Việt chuẩn xác!');
  process.exit(0);
} else {
  console.error('\n❌ [THẤT BẠI - ACCEPTANCE FAILED]: Vẫn còn mục từ chưa đạt yêu cầu!');
  process.exit(1);
}
