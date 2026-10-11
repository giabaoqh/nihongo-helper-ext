const fs = require('fs');

const storageContent = fs.readFileSync('JPEX/scripts/storage.js', 'utf8');

// Mock chrome.storage.local
const store = {
  jpex_decks: [
    { id: 'deck_default', name: 'Mặc định', count: 2, createdAt: 1000 },
    { id: 'deck_n3', name: 'Từ vựng N3', count: 3, createdAt: 2000 }
  ],
  jpex_cards: [
    { id: 'c1', deckId: 'deck_default', word: '食べる', reading: 'たべる', hanviet: 'THỰC', meaning: 'Ăn', example: 'ご飯を食べる', exampleMeaning: 'Ăn cơm' },
    { id: 'c2', deckId: 'deck_default', word: '飲む', reading: 'のむ', hanviet: 'ẨM', meaning: 'Uống' },
    { id: 'c3', deckId: 'deck_n3', word: '本', reading: 'ほん', hanviet: 'BẢN', meaning: 'Sách' },
    { id: 'c4', deckId: 'deck_n3', word: '車', reading: 'くるま', hanviet: 'XA', meaning: 'Xe hơi' },
    { id: 'c5', deckId: 'deck_n3', word: '青い', reading: 'あおい', hanviet: 'THANH', meaning: 'Xanh da trời' }
  ],
  savedWords: [
    { id: 's1', word: '猫', reading: 'ねこ', hanviet: 'MIÊU', meaning: 'Con mèo', folder: 'Động vật', example: '猫がいる', exampleMeaning: 'Có con mèo' },
    { id: 's2', word: '犬', reading: '犬', hanviet: 'KHUYỂN', meaning: 'Con chó', folder: 'Động vật' }
  ],
  jpex_srs_items: [
    { cardId: 'c1', interval: 1, repetition: 1, easeFactor: 2.5, dueDate: Date.now() - 100000 }, // due
    { cardId: 'c2', interval: 6, repetition: 2, easeFactor: 2.5, dueDate: Date.now() + 500000 }  // not due
  ]
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

  console.log('=== TEST SUITE 1: Standard JSON Export (6 Fields AI Schema) ===');
  const jsonStandard = await exportDeckWordsStandardJson();
  const parsedStandard = JSON.parse(jsonStandard);
  assert(Array.isArray(parsedStandard) && parsedStandard.length === 5, 'Exports 5 cards');
  assert(parsedStandard[0].word === '食べる' && parsedStandard[0].reading === 'たべる' && parsedStandard[0].hanviet === 'THỰC', 'Field mapping accurate');
  assert(parsedStandard[1].hanviet === 'ẨM' && (parsedStandard[1].example === '' || parsedStandard[1].example === undefined), 'Optional fields handled safely');

  console.log('=== TEST SUITE 2: Standard CSV Export with UTF-8 BOM ===');
  const csv = await exportSavedWordsToCsv();
  assert(csv.charCodeAt(0) === 0xFEFF, 'CSV starts with UTF-8 BOM byte 0xFEFF');
  assert(csv.includes('"Con mèo"') && csv.includes('"MIÊU"'), 'Contains Vietnamese text with quotes');

  console.log('=== TEST SUITE 3: AI JSON Import (Markdown fence + 6 fields) ===');
  const aiJson = '```json\n[\n  {"word": "行く", "reading": "いく", "hanviet": "HÀNH", "meaning": "Đi", "example": "学校に行く", "exampleMeaning": "Đi học"}\n]\n```';
  const importRes = await importDecksFromJson(aiJson, 'deck_n3');
  assert(importRes.importedCardsCount === 1, 'Successfully parsed and imported 1 card from markdown fence');
  const newCard = store.jpex_cards.find(c => c.word === '行く');
  assert(newCard && newCard.deckId === 'deck_n3', 'Card added to target deck');

  console.log('=== TEST SUITE 4: Delete Deck Safeguards ===');
  const delDef = await deleteDeck('deck_default');
  assert(delDef === false, 'Cannot delete system default deck');
  const delCustom = await deleteDeck('deck_n3');
  assert(delCustom === true, 'Successfully deleted custom deck');
  assert(!store.jpex_decks.some(d => d.id === 'deck_n3'), 'Deck removed from storage');
  assert(!store.jpex_cards.some(c => c.deckId === 'deck_n3'), 'Cards belonging to deleted deck removed');

  console.log('=== TEST SUITE 5: SRS Due Items Calculation ===');
  // Card without srs.dueDate or srs.dueDate <= now should be due
  const dueItems = await getDueCards('deck_default');
  assert(dueItems.length > 0 && dueItems.every(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= Date.now()), 'Accurately detected due cards in deck');

  console.log(`\n============================`);
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
