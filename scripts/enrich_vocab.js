const fs = require('fs');
const path = require('path');

const coreDictPath = path.join(__dirname, '..', 'JPEX', 'data', 'core_dict.json');
const coreDict = JSON.parse(fs.readFileSync(coreDictPath, 'utf8'));

const cdMap = new Map();
coreDict.forEach(w => {
  if (w.kanji && w.meaning) {
    cdMap.set(w.kanji.trim(), w.meaning.trim());
  }
  if (w.kana && w.meaning && !cdMap.has(w.kana.trim())) {
    cdMap.set(w.kana.trim(), w.meaning.trim());
  }
});

const vocabDir = path.join(__dirname, '..', 'JPEX', 'data', 'jlpt');
const subVocabDir = path.join(vocabDir, 'vocab');
if (!fs.existsSync(subVocabDir)) {
  fs.mkdirSync(subVocabDir, { recursive: true });
}

const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
let totalVocab = 0;
let verifiedVocab = 0;
let missingVocab = 0;

for (const lvl of levels) {
  const filePath = path.join(vocabDir, lvl + '.json');
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const enriched = items.map(item => {
    let meaningVi = 'Chưa có nghĩa tiếng Việt';
    let status = 'missing';

    // 1. Kiểm tra trong core_dict.json
    if (cdMap.has(item.word)) {
      meaningVi = cdMap.get(item.word);
      status = 'verified';
      verifiedVocab++;
    } else if (cdMap.has(item.reading)) {
      meaningVi = cdMap.get(item.reading);
      status = 'verified';
      verifiedVocab++;
    } else {
      missingVocab++;
    }

    return {
      id: item.id,
      word: item.word,
      reading: item.reading,
      hanviet: item.hanviet || '',
      meaningVi: meaningVi,
      originalMeaning: item.meaning || '',
      translationStatus: status,
      example: item.example || '',
      exampleVi: '',
      exampleEn: item.exampleMeaning || '',
      level: item.level || lvl.toUpperCase(),
      pos: item.pos || [],
      source: 'OpenJLPT (CC BY-SA 4.0)'
    };
  });

  totalVocab += enriched.length;
  // Lưu cả 2 vị trí để đảm bảo tính tương thích ngược hoàn hảo
  fs.writeFileSync(filePath, JSON.stringify(enriched, null, 2), 'utf8');
  fs.writeFileSync(path.join(subVocabDir, lvl + '.json'), JSON.stringify(enriched, null, 2), 'utf8');
  console.log(`Saved vocab ${lvl}.json: ${enriched.length} items`);
}

console.log(`Total Vocab: ${totalVocab}, Verified: ${verifiedVocab}, Missing: ${missingVocab}`);
