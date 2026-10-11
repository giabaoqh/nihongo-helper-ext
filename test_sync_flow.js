const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Giả lập chrome.storage.local và chrome API môi trường Node.js
const mockStorage = {};
const mockListeners = [];

global.chrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        let result = {};
        if (typeof keys === 'string') {
          result[keys] = mockStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(k => {
            if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
          });
        } else if (typeof keys === 'object' && keys !== null) {
          result = { ...keys };
          Object.keys(keys).forEach(k => {
            if (mockStorage[k] !== undefined) result[k] = mockStorage[k];
          });
        } else {
          result = { ...mockStorage };
        }
        setTimeout(() => callback(result), 0);
      },
      set: (items, callback) => {
        const changes = {};
        Object.keys(items).forEach(k => {
          changes[k] = {
            oldValue: mockStorage[k],
            newValue: items[k]
          };
          mockStorage[k] = JSON.parse(JSON.stringify(items[k]));
        });
        mockListeners.forEach(l => l(changes, 'local'));
        if (callback) setTimeout(callback, 0);
      }
    },
    onChanged: {
      addListener: (fn) => {
        mockListeners.push(fn);
      }
    }
  },
  runtime: {
    lastError: null,
    sendMessage: (msg, cb) => { if (cb) cb(); },
    onMessage: { addListener: () => {} }
  }
};

// Nạp mã nguồn storage.js
const storageCode = fs.readFileSync(path.join(__dirname, 'JPEX/scripts/storage.js'), 'utf8');
eval(storageCode);

async function runSyncTests() {
  console.log('========================================================');
  console.log('BẮT ĐẦU KIỂM THỬ ĐỒNG BỘ DỮ LIỆU TOÀN DIỆN (10 KỊCH BẢN)');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ FAIL: ${desc}`);
      console.error(`    -> Lỗi: ${err.message}`);
      failed++;
    }
  }

  // Khởi tạo storage ban đầu
  await getDecks();

  // ----------------------------------------------------
  // KỊCH BẢN 1: Bôi đen từ 貿易 trên trang web -> Thêm vào ôn tập
  // ----------------------------------------------------
  console.log('--- 1. Bôi đen từ "貿易" và thêm vào ôn tập ---');
  let signalReceived = null;
  chrome.storage.onChanged.addListener((changes) => {
    if (changes._lastSyncSignal) {
      signalReceived = changes._lastSyncSignal.newValue;
    }
  });

  const boiDenData = {
    word: '貿易',
    reading: 'ぼうえき',
    hanviet: 'Mậu dịch',
    meaning: 'Thương mại, buôn bán',
    example: '日本と貿易をする。',
    exampleMeaning: 'Buôn bán giao thương với Nhật Bản.'
  };

  const res1 = await addWordToReview(boiDenData, 'deck_default');
  const savedWords1 = await getSavedWords();
  const allCards1 = await getAllCards();
  const dueCards1 = await getDueCards();

  test('Từ "貿易" được thêm vào savedWords với đầy đủ 6 trường', () => {
    const sw = savedWords1.find(w => w.word === '貿易' || w.kanji === '貿易');
    assert.ok(sw, 'Không tìm thấy "貿易" trong savedWords');
    assert.strictEqual(sw.reading, 'ぼうえき');
    assert.strictEqual(sw.hanviet, 'Mậu dịch');
    assert.strictEqual(sw.meaning, 'Thương mại, buôn bán');
  });

  test('Từ "貿易" xuất hiện trong jpex_cards thuộc deck_default', () => {
    const card = allCards1.find(c => (c.word === '貿易' || c.kanji === '貿易') && c.deckId === 'deck_default');
    assert.ok(card, 'Không tìm thấy thẻ "貿易" trong jpex_cards');
    assert.strictEqual(card.deckId, 'deck_default');
    assert.strictEqual(card.example, '日本と貿易をする。');
  });

  test('Thẻ mới có dueDate <= now và sẵn sàng ôn tập ngay lập tức trong SRS Hub', () => {
    const card = allCards1.find(c => c.word === '貿易' && c.deckId === 'deck_default');
    assert.ok(card.srs, 'Thẻ thiếu object srs');
    assert.ok(card.srs.dueDate <= Date.now(), 'Thẻ mới không có dueDate <= now');
    const inDue = dueCards1.some(c => c.id === card.id);
    assert.ok(inDue, 'Thẻ mới không xuất hiện trong danh sách getDueCards');
  });

  test('Phát tín hiệu broadcastDataChange kích hoạt realtime sync', () => {
    assert.ok(signalReceived, 'Không nhận được tín hiệu _lastSyncSignal');
    assert.strictEqual(signalReceived.type, 'card_added_to_review');
    assert.strictEqual(signalReceived.detail.word, '貿易');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 2: Thêm từ vào một deck cụ thể
  // ----------------------------------------------------
  console.log('\n--- 2. Thêm từ vào một deck cụ thể ("N3 Vocab") ---');
  const n3Deck = await saveDeck({ name: 'N3 Vocab', description: 'Từ vựng JLPT N3' });
  const word2 = {
    word: '経済',
    reading: 'けいざい',
    hanviet: 'Kinh tế',
    meaning: 'Nền kinh tế',
    example: '経済が発展する。',
    exampleMeaning: 'Kinh tế phát triển.'
  };
  await addWordToReview(word2, n3Deck.id);

  const cardsN3 = await getCardsByDeck(n3Deck.id);
  const foldersAfter2 = await getSavedFolders();

  test('Từ "経済" xuất hiện ngay trong deck N3 Vocab', () => {
    const card = cardsN3.find(c => c.word === '経済');
    assert.ok(card, 'Không tìm thấy "経済" trong deck N3 Vocab');
    assert.strictEqual(card.deckId, n3Deck.id);
  });

  test('Tên deck "N3 Vocab" được đồng bộ tự động sang danh sách savedFolders', () => {
    assert.ok(foldersAfter2.includes('N3 Vocab'), 'savedFolders thiếu "N3 Vocab"');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 3: Lưu một từ từ tra cứu từ điển
  // ----------------------------------------------------
  console.log('\n--- 3. Lưu một từ từ chức năng tra cứu từ điển ---');
  const dictWord = {
    kanji: '会社',
    word: '会社',
    reading: 'かいしゃ',
    hanviet: 'Hội xã',
    meaning: 'Công ty',
    meaningVi: 'Công ty'
  };
  await saveWord(dictWord, 'Mặc định');
  const savedWords3 = await getSavedWords();
  const allCards3 = await getAllCards();

  test('Từ tra cứu xuất hiện trong Từ đã lưu (savedWords)', () => {
    const sw = savedWords3.find(w => w.word === '会社' || w.kanji === '会社');
    assert.ok(sw, 'Không tìm thấy "会社" trong savedWords');
  });

  test('Từ tra cứu tự động tạo thẻ Flashcard tương ứng trong deck "Mặc định"', () => {
    const card = allCards3.find(c => c.word === '会社' && c.deckId === 'deck_default');
    assert.ok(card, 'Không tìm thấy thẻ "会社" trong deck_default');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 4: Thêm một từ đã tồn tại (Chống trùng lặp trong cùng deck)
  // ----------------------------------------------------
  console.log('\n--- 4. Thêm lại từ "貿易" vào deck_default (Chống trùng lặp) ---');
  // Giả sử thẻ "貿易" đã được ôn tập và có tiến độ SRS
  const initialCard = (await getAllCards()).find(c => c.word === '貿易' && c.deckId === 'deck_default');
  await rateCardSrs(initialCard.id, 3); // Good -> interval tăng lên
  const cardAfterSrs = (await getAllCards()).find(c => c.id === initialCard.id);
  const savedInterval = cardAfterSrs.srs.interval;
  const savedRep = cardAfterSrs.srs.repetition;

  // Thao tác lưu lại từ "貿易" vào cùng deck_default
  const reAddRes = await addWordToReview({
    word: '貿易',
    reading: 'ぼうえき',
    hanviet: 'Mậu dịch',
    meaning: 'Ngoại thương, mậu dịch quốc tế (cập nhật mới)',
    example: '新・貿易'
  }, 'deck_default');

  const cardsAfterReAdd = (await getAllCards()).filter(c => c.word === '貿易' && c.deckId === 'deck_default');

  test('Không tạo bản ghi trùng lặp trong cùng deck (Số lượng thẻ vẫn là 1)', () => {
    assert.strictEqual(cardsAfterReAdd.length, 1);
    assert.strictEqual(reAddRes.isDuplicate, true);
  });

  test('Thông tin mới được cập nhật nhưng BẢO TOÀN tiến độ SRS hiện có', () => {
    const updatedCard = cardsAfterReAdd[0];
    assert.strictEqual(updatedCard.meaning, 'Ngoại thương, mậu dịch quốc tế (cập nhật mới)');
    assert.strictEqual(updatedCard.srs.interval, savedInterval, 'Interval SRS bị reset ngoài ý muốn');
    assert.strictEqual(updatedCard.srs.repetition, savedRep, 'Repetition SRS bị reset ngoài ý muốn');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 5: Thêm cùng một từ vào 2 deck khác nhau (Độc lập giữa các deck)
  // ----------------------------------------------------
  console.log('\n--- 5. Thêm từ "貿易" vào deck thứ 2 ("N3 Vocab") ---');
  await addWordToReview({
    word: '貿易',
    reading: 'ぼうえき',
    hanviet: 'Mậu dịch',
    meaning: 'Thương mại (N3 Context)'
  }, n3Deck.id);

  const allBoEkiCards = (await getAllCards()).filter(c => c.word === '貿易');

  test('Từ "貿易" tồn tại độc lập ở cả 2 deck với 2 ID thẻ khác nhau', () => {
    assert.strictEqual(allBoEkiCards.length, 2, 'Phải có đúng 2 thẻ "貿易" trên hệ thống');
    const cDefault = allBoEkiCards.find(c => c.deckId === 'deck_default');
    const cN3 = allBoEkiCards.find(c => c.deckId === n3Deck.id);
    assert.ok(cDefault, 'Thiếu thẻ trong deck_default');
    assert.ok(cN3, 'Thiếu thẻ trong N3 Vocab');
    assert.notStrictEqual(cDefault.id, cN3.id, '2 thẻ ở 2 deck không được trùng ID');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 6: Sửa thông tin từ vựng -> Đồng bộ nhất quán
  // ----------------------------------------------------
  console.log('\n--- 6. Sửa thông tin (reading/meaning) của thẻ Flashcard ---');
  const cardToEdit = (await getAllCards()).find(c => c.word === '会社');
  await saveCard({
    id: cardToEdit.id,
    deckId: cardToEdit.deckId,
    word: '会社',
    reading: 'かいしゃ',
    hanviet: 'Hội xã (Doanh nghiệp)',
    meaning: 'Công ty, doanh nghiệp'
  });

  const savedWordsAfterEdit = await getSavedWords();
  const editedSavedWord = savedWordsAfterEdit.find(w => w.word === '会社' || w.kanji === '会社');

  test('Cập nhật thẻ Flashcard tự động đồng bộ sang mục Từ đã lưu (savedWords)', () => {
    assert.ok(editedSavedWord, 'Không tìm thấy "会社" trong savedWords');
    assert.strictEqual(editedSavedWord.hanviet, 'Hội xã (Doanh nghiệp)');
    assert.strictEqual(editedSavedWord.meaning, 'Công ty, doanh nghiệp');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 7: Xóa thẻ khỏi Deck -> Không tự ý xóa khỏi "Từ đã lưu"
  // ----------------------------------------------------
  console.log('\n--- 7. Xóa thẻ khỏi Deck và kiểm tra tính độc lập ---');
  const cardToDelete = (await getAllCards()).find(c => c.word === '貿易' && c.deckId === n3Deck.id);
  await deleteCard(cardToDelete.id);

  const cardsAfterDelete = await getAllCards();
  const savedWordsAfterDelete = await getSavedWords();

  test('Thẻ bị xóa khỏi deck "N3 Vocab"', () => {
    const existsInN3 = cardsAfterDelete.some(c => c.id === cardToDelete.id);
    assert.strictEqual(existsInN3, false);
  });

  test('Thẻ trong deck "deck_default" và từ trong "savedWords" vẫn tồn tại nguyên vẹn', () => {
    const existsInDefault = cardsAfterDelete.some(c => c.word === '貿易' && c.deckId === 'deck_default');
    const existsInSaved = savedWordsAfterDelete.some(w => w.word === '貿易' || w.kanji === '貿易');
    assert.ok(existsInDefault, 'Thẻ trong deck_default bị xóa nhầm');
    assert.ok(existsInSaved, 'Từ trong savedWords bị xóa nhầm');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 8: Xóa khỏi "Từ đã lưu" -> Không tự ý xóa thẻ trong Deck
  // ----------------------------------------------------
  console.log('\n--- 8. Xóa từ khỏi "Từ đã lưu" ---');
  await deleteWord('貿易');
  const cardsAfterWordDelete = await getAllCards();
  const savedWordsAfterWordDelete = await getSavedWords();

  test('Từ "貿易" bị xóa khỏi savedWords', () => {
    const existsInSaved = savedWordsAfterWordDelete.some(w => w.word === '貿易' || w.kanji === '貿易');
    assert.strictEqual(existsInSaved, false);
  });

  test('Thẻ "貿易" trong deck_default vẫn được bảo toàn nguyên vẹn', () => {
    const existsInDefault = cardsAfterWordDelete.some(c => c.word === '貿易' && c.deckId === 'deck_default');
    assert.ok(existsInDefault, 'Thẻ trong deck_default bị xóa ngoài ý muốn');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 9: Khởi động lại / Kiểm tra lưu bền vững (Persistent Storage)
  // ----------------------------------------------------
  console.log('\n--- 9. Kiểm tra tính bền vững (Persistence Simulation) ---');
  // Dữ liệu trong mockStorage tượng trưng cho chrome.storage.local của trình duyệt
  test('Toàn bộ dữ liệu nằm bền vững trong storage keys chuẩn', () => {
    assert.ok(Array.isArray(mockStorage['savedWords']), 'Thiếu key savedWords');
    assert.ok(Array.isArray(mockStorage['jpex_decks']), 'Thiếu key jpex_decks');
    assert.ok(Array.isArray(mockStorage['jpex_cards']), 'Thiếu key jpex_cards');
    assert.ok(Array.isArray(mockStorage['savedFolders']), 'Thiếu key savedFolders');
  });

  // ----------------------------------------------------
  // KỊCH BẢN 10: Tương thích Xuất/Nhập JSON với Schema 6 trường
  // ----------------------------------------------------
  console.log('\n--- 10. Tương thích Xuất/Nhập JSON và Schema 6 trường ---');
  const exportedSingle = await exportDecksToJson('deck_default');
  const parsedExport = JSON.parse(exportedSingle);

  test('Xuất JSON chứa đủ 6 trường schema chuẩn cho mỗi thẻ', () => {
    assert.strictEqual(parsedExport.type, 'single_deck');
    assert.ok(parsedExport.cards.length > 0, 'Không có thẻ nào được xuất');
    const cardExported = parsedExport.cards[0];
    assert.ok('word' in cardExported, 'Thiếu trường word');
    assert.ok('reading' in cardExported, 'Thiếu trường reading');
    assert.ok('hanviet' in cardExported, 'Thiếu trường hanviet');
    assert.ok('meaning' in cardExported, 'Thiếu trường meaning');
    assert.ok('example' in cardExported, 'Thiếu trường example');
    assert.ok('exampleMeaning' in cardExported, 'Thiếu trường exampleMeaning');
  });

  // Test nhập lại chuỗi JSON 6 trường
  const aiJson = JSON.stringify([
    {
      word: '契約',
      reading: 'けいやく',
      hanviet: 'Khế ước',
      meaning: 'Hợp đồng, giao kèo',
      example: '契約を結ぶ。',
      exampleMeaning: 'Ký kết hợp đồng.'
    }
  ]);

  const importRes = await importDecksFromJson(aiJson, 'deck_default');
  const importedCard = (await getAllCards()).find(c => c.word === '契約' && c.deckId === 'deck_default');
  const importedSavedWord = (await getSavedWords()).find(w => w.word === '契約' || w.kanji === '契約');

  test('Nhập JSON 6 trường tự động tạo thẻ Flashcard và đồng bộ savedWords', () => {
    assert.strictEqual(importRes.success, true);
    assert.ok(importedCard, 'Không tìm thấy thẻ "契約" sau khi nhập');
    assert.strictEqual(importedCard.hanviet, 'Khế ước');
    assert.ok(importedSavedWord, 'Không tìm thấy từ "契約" trong savedWords sau khi nhập');
  });

  console.log('\n========================================================');
  console.log(`KẾT QUẢ KIỂM THỬ ĐỒNG BỘ: ${passed} PASS, ${failed} FAIL.`);
  console.log('========================================================');
  if (failed > 0) process.exit(1);
}

runSyncTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
