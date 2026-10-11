const fs = require('fs');

const storageContent = fs.readFileSync('JPEX/scripts/storage.js', 'utf8');

// Mock chrome.storage.local
let store = {
  jpex_decks: [
    { id: 'deck_default', name: 'Mặc định', description: 'Bộ thẻ mặc định', color: '#0284c7', createdAt: 1000, updatedAt: 1000 }
  ],
  jpex_cards: [],
  savedWords: []
};

global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        let res = {};
        if (Array.isArray(keys)) keys.forEach(k => res[k] = store[k]);
        else if (typeof keys === 'string') res[keys] = store[keys];
        else if (typeof keys === 'object') Object.keys(keys).forEach(k => res[k] = store[k] !== undefined ? store[k] : keys[k]);
        cb(res);
      },
      set: (data, cb) => {
        Object.assign(store, data);
        if (cb) cb();
      }
    }
  }
};

eval(storageContent);

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(cond, name) {
    if (cond) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  console.log('========================================================');
  console.log('TEST SUITE: KIỂM THỬ XUẤT / NHẬP JSON TOÀN DIỆN (A - E)');
  console.log('========================================================\n');

  // ========================================================
  // TEST A: Round-trip một bộ thẻ (Single Deck)
  // ========================================================
  console.log('--- TEST A: Round-trip một bộ thẻ (Single Deck) ---');
  // 1. Tạo 1 bộ thẻ có ít nhất 3 từ vựng
  const deckAId = 'deck_test_a';
  store.jpex_decks.push({
    id: deckAId,
    name: 'Từ vựng N3 Cơ bản',
    description: 'Bộ thẻ ôn luyện N3',
    color: '#0d9488',
    createdAt: 2000,
    updatedAt: 2000
  });
  store.jpex_cards.push(
    {
      id: 'card_a1',
      deckId: deckAId,
      word: '週末',
      reading: 'しゅうまつ',
      hanviet: 'CHU MẠT',
      meaning: 'Cuối tuần',
      example: '週末は休みです。',
      exampleMeaning: 'Cuối tuần tôi được nghỉ.'
    },
    {
      id: 'card_a2',
      deckId: deckAId,
      word: '約束',
      reading: 'やくそく',
      hanviet: 'ƯỚC THÚC',
      meaning: 'Lời hứa, cuộc hẹn',
      example: '友達と約束があります。',
      exampleMeaning: 'Tôi có hẹn với bạn.'
    },
    {
      id: 'card_a3',
      deckId: deckAId,
      word: '準備',
      reading: 'じゅんび',
      hanviet: 'CHUẨN BỊ',
      meaning: 'Sự chuẩn bị',
      example: '旅行の準備をします。',
      exampleMeaning: 'Chuẩn bị cho chuyến đi.'
    }
  );

  // 2. Xuất JSON của bộ thẻ này
  const exportedSingleJson = await exportDecksToJson(deckAId);
  const parsedSingle = JSON.parse(exportedSingleJson);
  assert(parsedSingle.version === 1, 'File xuất có version: 1');
  assert(parsedSingle.type === 'single_deck', 'Type được đánh dấu là single_deck');
  assert(Array.isArray(parsedSingle.decks) && parsedSingle.decks.length === 1, 'Chứa chính xác 1 bộ thẻ');
  assert(parsedSingle.decks[0].cards.length === 3, 'Bộ thẻ chứa đủ 3 thẻ từ vựng lồng nhau (nested cards)');

  // 3. Giả lập xóa bộ thẻ này khỏi storage rồi nhập lại
  store.jpex_decks = store.jpex_decks.filter(d => d.id !== deckAId);
  store.jpex_cards = store.jpex_cards.filter(c => c.deckId !== deckAId);
  assert(!store.jpex_decks.some(d => d.id === deckAId), 'Đã xóa bộ thẻ A khỏi storage để test khôi phục');

  // 4. Nhập lại file vừa xuất
  const importResultA = await importDecksFromJson(exportedSingleJson);
  assert(importResultA.success === true, 'Nhập lại file đơn thành công');
  assert(importResultA.importedDecksCount === 1, 'Khôi phục 1 bộ thẻ');
  assert(importResultA.importedCardsCount === 3, 'Khôi phục 3 thẻ từ vựng');

  const restoredDeckA = store.jpex_decks.find(d => d.name === 'Từ vựng N3 Cơ bản');
  assert(restoredDeckA !== undefined, 'Bộ thẻ A đã xuất hiện trong danh sách decks');
  const restoredCardsA = store.jpex_cards.filter(c => c.deckId === restoredDeckA.id);
  assert(restoredCardsA.length === 3, 'Đủ 3 thẻ từ vựng trong bộ thẻ');
  const cardShuumatsu = restoredCardsA.find(c => c.word === '週末');
  assert(
    cardShuumatsu &&
    cardShuumatsu.reading === 'しゅうまつ' &&
    cardShuumatsu.hanviet === 'CHU MẠT' &&
    cardShuumatsu.meaning === 'Cuối tuần' &&
    cardShuumatsu.example === '週末は休みです。' &&
    cardShuumatsu.exampleMeaning === 'Cuối tuần tôi được nghỉ.',
    'Toàn bộ trường dữ liệu của từ "週末" được bảo toàn nguyên vẹn 100%'
  );

  // ========================================================
  // TEST B: Round-trip toàn bộ dữ liệu (Full Backup)
  // ========================================================
  console.log('\n--- TEST B: Round-trip toàn bộ dữ liệu (Full Backup) ---');
  // Thêm thêm 1 bộ thẻ thứ hai
  const deckBId = 'deck_test_b';
  store.jpex_decks.push({
    id: deckBId,
    name: 'Kanji N2 Nâng cao',
    description: 'Chữ Hán N2',
    color: '#e11d48',
    createdAt: 3000,
    updatedAt: 3000
  });
  store.jpex_cards.push(
    {
      id: 'card_b1',
      deckId: deckBId,
      word: '慎重',
      reading: 'しんちょう',
      hanviet: 'THẬN TRỌNG',
      meaning: 'Cẩn trọng'
    },
    {
      id: 'card_b2',
      deckId: deckBId,
      word: '把握',
      reading: 'はあく',
      hanviet: 'BẢ ÁC',
      meaning: 'Nắm vững'
    }
  );

  // 1. Xuất toàn bộ dữ liệu
  const fullBackupJson = await exportDecksToJson('__all__');
  const parsedFull = JSON.parse(fullBackupJson);
  assert(parsedFull.version === 1, 'Full Backup version: 1');
  assert(parsedFull.type === 'full_backup', 'Type là full_backup');
  assert(parsedFull.decks.length >= 2, 'Xuất nhiều hơn hoặc bằng 2 bộ thẻ');

  // 2. Xóa sạch dữ liệu (chỉ để lại deck_default trống)
  store.jpex_decks = [{ id: 'deck_default', name: 'Mặc định' }];
  store.jpex_cards = [];

  // 3. Nhập lại Full Backup
  const importResultB = await importDecksFromJson(fullBackupJson);
  assert(importResultB.success === true, 'Nhập lại file Full Backup thành công');
  assert(importResultB.importedDecksCount >= 2, 'Khôi phục ít nhất 2 bộ thẻ');
  assert(importResultB.importedCardsCount >= 5, 'Khôi phục ít nhất 5 thẻ từ vựng');

  const hasDeckA = store.jpex_decks.some(d => d.name === 'Từ vựng N3 Cơ bản');
  const hasDeckB = store.jpex_decks.some(d => d.name === 'Kanji N2 Nâng cao');
  assert(hasDeckA && hasDeckB, 'Cả 2 bộ thẻ A và B được khôi phục chính xác');

  // ========================================================
  // TEST C: Nhập JSON mảng từ vựng (6 trường chuẩn AI)
  // ========================================================
  console.log('\n--- TEST C: Nhập JSON mảng từ vựng (6 trường chuẩn AI) ---');
  const aiVocabArray = [
    {
      word: '食べる',
      reading: 'たべる',
      hanviet: 'THỰC',
      meaning: 'Ăn',
      example: 'ご飯を食べる。',
      exampleMeaning: 'Ăn cơm.'
    },
    {
      word: '飲む',
      reading: 'のむ',
      hanviet: 'ẨM',
      meaning: 'Uống',
      example: '水を飲む。',
      exampleMeaning: 'Uống nước.'
    }
  ];

  // Thử bọc trong Markdown code fence như khi người dùng copy từ AI
  const aiFencedJson = '```json\n' + JSON.stringify(aiVocabArray, null, 2) + '\n```';
  const importResultC = await importDecksFromJson(aiFencedJson, null, 'Bộ thẻ Động từ ăn uống');
  assert(importResultC.success === true, 'Bóc tách Markdown fence và nhập mảng từ vựng thành công');
  assert(importResultC.importedDecksCount === 1, 'Tạo thành công 1 bộ thẻ mới theo tên người dùng chỉ định');
  assert(importResultC.importedCardsCount === 2, 'Nhập đủ 2 từ vựng vào bộ thẻ mới');

  const newCreatedDeck = store.jpex_decks.find(d => d.name === 'Bộ thẻ Động từ ăn uống');
  assert(newCreatedDeck !== undefined, 'Bộ thẻ mới được tạo tồn tại trong storage');
  const cardsInNewDeck = store.jpex_cards.filter(c => c.deckId === newCreatedDeck.id);
  assert(cardsInNewDeck.length === 2, '2 từ vựng được gán chính xác vào bộ thẻ mới');

  // ========================================================
  // TEST D: Nhập file lỗi (Syntax Error, Empty, Invalid)
  // ========================================================
  console.log('\n--- TEST D: Nhập file lỗi (Syntax Error, Empty, Invalid) ---');
  // 1. File rỗng
  const emptyRes = await importDecksFromJson('');
  assert(emptyRes.success === false && emptyRes.error.includes('rỗng'), 'Bắt lỗi file rỗng chuẩn tiếng Việt');

  // 2. JSON sai cú pháp
  const syntaxErrRes = await importDecksFromJson('{ "decks": [ { name: "Lỗi thiếu ngoặc kép" } ]');
  assert(syntaxErrRes.success === false && syntaxErrRes.error.includes('Cú pháp JSON không hợp lệ'), 'Bắt lỗi cú pháp JSON');

  // 3. Mảng các object không chứa trường word/kanji
  const invalidFieldsRes = await importDecksFromJson(JSON.stringify([{ foo: 'bar', baz: 123 }]));
  assert(invalidFieldsRes.success === false && invalidFieldsRes.error.includes('từ vựng'), 'Bắt lỗi mảng không có trường từ vựng');

  // ========================================================
  // TEST E: Phân tích trước khi nhập (analyzeImportJson)
  // ========================================================
  console.log('\n--- TEST E: Phân tích trước khi nhập (analyzeImportJson) ---');
  const analysisFull = analyzeImportJson(fullBackupJson);
  assert(analysisFull.valid === true, 'Phân tích file backup hợp lệ');
  assert(analysisFull.type === 'full_backup', 'Phát hiện đúng loại full_backup');
  assert(analysisFull.decksCount >= 2, 'Đếm đúng số lượng bộ thẻ');
  assert(analysisFull.cardsCount >= 5, 'Đếm đúng số lượng từ vựng');

  const analysisCards = analyzeImportJson(JSON.stringify(aiVocabArray));
  assert(analysisCards.valid === true && analysisCards.type === 'cards_array', 'Phát hiện đúng mảng từ vựng');

  console.log('\n========================================================');
  console.log(`TỔNG KẾT KIỂM THỬ: ${passed} PASS, ${failed} FAIL.`);
  console.log('========================================================');
  if (failed > 0) process.exit(1);
}

runTests();
