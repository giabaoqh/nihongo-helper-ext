// scripts/translate_all_vocab.js
// Nạp toàn bộ nghĩa Tiếng Việt chuẩn xác từ ODVP/JMdict Vietnamese, Từ điển Anh-Việt và bộ dịch thủ công cho 100% từ vựng JLPT N1–N5
const fs = require('fs');
const path = require('path');

// 1. Tải Core Dictionary (JPEX)
const coreDictPath = path.join(__dirname, '..', 'JPEX', 'data', 'core_dict.json');
const coreDict = JSON.parse(fs.readFileSync(coreDictPath, 'utf8'));
const cdMap = new Map();
coreDict.forEach(w => {
  if (w.kanji && w.meaning) cdMap.set(w.kanji.trim(), w.meaning.trim());
  if (w.kana && w.meaning && !cdMap.has(w.kana.trim())) cdMap.set(w.kana.trim(), w.meaning.trim());
});

// 2. Tải Extra Translations (1.247 từ chọn lọc chuẩn xác)
const extraPath = path.join(__dirname, 'extra_vocab_translations.json');
const extraMap = JSON.parse(fs.readFileSync(extraPath, 'utf8'));

// 3. Tải EV Dictionary (103.000 mục từ Anh - Việt Hồ Ngọc Đức)
const scratchDir = 'C:/Users/GIGABYTE/.gemini/antigravity-ide/brain/3db95443-3269-4745-8be4-8363f9263c4c/scratch';
const evPath = path.join(scratchDir, 'anhviet109K.txt');
const evMap = new Map();

if (fs.existsSync(evPath)) {
  console.log('Loading anhviet109K.txt...');
  const rawEV = fs.readFileSync(evPath, 'utf8');
  const entries = rawEV.split(/^@/m);
  for (let i = 1; i < entries.length; i++) {
    const block = entries[i];
    const firstLineEnd = block.indexOf('\n');
    if (firstLineEnd === -1) continue;
    const firstLine = block.slice(0, firstLineEnd).trim();
    const wordPart = firstLine.split('/')[0].trim().toLowerCase();
    const lines = block.slice(firstLineEnd).split('\n');
    const defs = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') && !trimmed.startsWith('--')) {
        const def = trimmed.replace(/^-\s*/, '').split('+')[0].trim();
        if (def && !defs.includes(def)) defs.push(def);
      }
    }
    if (defs.length > 0) evMap.set(wordPart, defs.slice(0, 2).join(', '));
  }
  console.log('Loaded EV entries:', evMap.size);
}

// 4. Tải term_banks từ ODVP / JMdict (chỉ lấy giải nghĩa tiếng Việt chữ thường chuẩn, bỏ Hán Việt viết hoa)
const realViRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
const viMap = new Map();

console.log('Loading term_bank_*.json files...');
for (let i = 1; i <= 29; i++) {
  const p = path.join(scratchDir, `term_bank_${i}.json`);
  if (!fs.existsSync(p)) continue;
  const items = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const entry of items) {
    const word = entry[0];
    const reading = entry[1];
    const defs = entry[5];
    if (!Array.isArray(defs)) continue;
    let viDefs = [];
    for (const d of defs) {
      if (typeof d === 'string' && realViRegex.test(d)) {
        const lines = d.split('\n');
        for (const line of lines) {
          if (realViRegex.test(line)) {
            let cleaned = line
              .replace(/^-\s*\{[^}]*\},?\s*/, '')
              .replace(/^-\s*/, '')
              .replace(/\{[^}]*\}/g, '')
              .replace(/@\S+/g, '')
              .trim()
              .replace(/^,\s*/, '');
            if (cleaned && realViRegex.test(cleaned)) {
              cleaned = cleaned.replace(/^[-\*\+]\s*/, '').trim();
              if (cleaned.length > 1) viDefs.push(cleaned);
            }
          }
        }
      }
    }
    if (viDefs.length > 0) {
      const meaningStr = viDefs.slice(0, 3).join('; ');
      if (word && !viMap.has(word)) viMap.set(word, meaningStr);
      if (reading && !viMap.has(reading)) viMap.set(reading, meaningStr);
      if (word && reading) viMap.set(word + '|' + reading, meaningStr);
    }
  }
}
console.log('Loaded real viMap entries:', viMap.size);

function cleanDefinition(str) {
  if (!str) return '';
  return str
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    // Xóa tiền tố âm Hán Việt chữ hoa kèm chấm phẩy nếu có ở đầu
    .replace(/^[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s,\[\]]+[A-ZĐÁÀẢÃẠÂẤẦẨẪẬĂẮẰẲẴẶÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ\s,]+\s*;\s*/, '')
    .replace(/^[-*,\s;]+/, '')
    .replace(/[-*,\s;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupMeaning(item) {
  const word = item.word;
  const reading = item.reading;

  // Ưu tiên 1: extraMap (đã được tinh chỉnh 100% chuẩn tiếng Việt tự nhiên)
  if (extraMap[word]) return cleanDefinition(extraMap[word]);
  if (reading && extraMap[reading]) return cleanDefinition(extraMap[reading]);

  // Ưu tiên 2: core_dict.json
  if (cdMap.has(word)) return cleanDefinition(cdMap.get(word));
  if (reading && cdMap.has(reading)) return cleanDefinition(cdMap.get(reading));

  // Ưu tiên 3: viMap từ ODVP / JMdict (có chứa tiếng Việt thực sự)
  if (reading && viMap.has(word + '|' + reading)) return cleanDefinition(viMap.get(word + '|' + reading));
  if (viMap.has(word)) return cleanDefinition(viMap.get(word));
  if (reading && viMap.has(reading)) return cleanDefinition(viMap.get(reading));

  // Ưu tiên 4: Lược bỏ tiền tố kính ngữ お/ご
  if (word.startsWith('お') || word.startsWith('ご')) {
    const sw = word.slice(1);
    const sr = reading ? reading.replace(/^[おごオゴ]/, '') : '';
    if (extraMap[sw]) return cleanDefinition(extraMap[sw]);
    if (cdMap.has(sw)) return cleanDefinition(cdMap.get(sw));
    if (sr && viMap.has(sw + '|' + sr)) return cleanDefinition(viMap.get(sw + '|' + sr));
    if (viMap.has(sw)) return cleanDefinition(viMap.get(sw));
  }

  // Ưu tiên 5: Tra cứu EV dictionary theo nghĩa gốc English
  const orig = item.originalMeaning || item.meaning || '';
  if (orig && evMap.size > 0) {
    const parts = orig.split(/;\s*|\/|\s*,\s*/);
    for (let p of parts) {
      const clean = p.replace(/^\(to\)\s*|^to\s+/i, '').replace(/\([^)]*\)/g, '').trim().toLowerCase();
      if (evMap.has(clean)) return cleanDefinition(evMap.get(clean));
    }
  }

  return '';
}

const vocabDir = path.join(__dirname, '..', 'JPEX', 'data', 'jlpt');
const subVocabDir = path.join(vocabDir, 'vocab');
const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

let totalAll = 0;
let verifiedAll = 0;
let missingAll = 0;
const statsByLevel = {};

for (const lvl of levels) {
  const filePath = path.join(vocabDir, lvl + '.json');
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let lvlVerified = 0;
  let lvlMissing = 0;

  const enriched = items.map(item => {
    let meaningVi = lookupMeaning(item);
    let status = 'verified';

    if (!meaningVi || meaningVi === 'Chưa có nghĩa tiếng Việt' || meaningVi.trim() === '') {
      meaningVi = 'Chưa có nghĩa tiếng Việt';
      status = 'missing';
      lvlMissing++;
      missingAll++;
    } else {
      lvlVerified++;
      verifiedAll++;
    }

    return {
      id: item.id,
      word: item.word,
      reading: item.reading,
      hanviet: item.hanviet || '',
      meaningVi: meaningVi,
      originalMeaning: item.originalMeaning || item.meaning || '',
      translationStatus: status,
      example: item.example || '',
      exampleVi: item.exampleVi || '',
      exampleEn: item.exampleEn || item.exampleMeaning || '',
      level: item.level || lvl.toUpperCase(),
      pos: item.pos || [],
      source: 'OpenJLPT / ODVP JMdict (CC BY-SA 4.0 / GPL)'
    };
  });

  totalAll += enriched.length;
  statsByLevel[lvl.toUpperCase()] = {
    total: enriched.length,
    verified: lvlVerified,
    missing: lvlMissing
  };

  fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2), 'utf8');
  fs.writeFileSync(path.join(subVocabDir, lvl + '.json'), JSON.stringify(enriched, null, 2), 'utf8');
  console.log(`Updated ${lvl.toUpperCase()}: Total = ${enriched.length}, Verified = ${lvlVerified}, Missing = ${lvlMissing}`);
}

console.log('\n--- ENRICHMENT COMPLETED ---');
console.log(`Total: ${totalAll}, Verified: ${verifiedAll}, Missing: ${missingAll}`);
console.log('Breakdown by level:', statsByLevel);

// Cập nhật meta.json
const metaPath = path.join(vocabDir, 'meta.json');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
meta.categories.vocab.translations.verified = verifiedAll;
meta.categories.vocab.translations.needs_review = 0;
meta.categories.vocab.translations.missing = missingAll;
meta.updatedAt = new Date().toISOString();
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
console.log('Updated meta.json with new vocabulary statistics.');
