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

async function runFolderSyncTests() {
  console.log('========================================================');
  console.log('BẮT ĐẦU KIỂM THỬ ĐỒNG BỘ FOLDER VÀ FLASHCARD (TEST 1 - 7)');
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

  // Khởi tạo Decks ban đầu
  const initialDecks = await getDecks();
  const defaultDeckId = initialDecks[0].id; // 'deck_default'

  // ----------------------------------------------------
  // TEST 1: Lưu từ mới vào folder mặc định
  // ----------------------------------------------------
  console.log('--- TEST 1: Lưu từ mới vào folder mặc định ---');
  const word1 = {
    word: '猫',
    reading: 'ねこ',
    hanviet: 'Miêu',
    meaning: 'Con mèo'
  };
  await addWordToReview(word1, 'Mặc định');

  const allCards1 = await getAllCards();
  const savedWords1 = await getSavedWords();
  const defaultCards1 = allCards1.filter(c => c.deckId === defaultDeckId);
  const nekoSaved = savedWords1.find(w => w.word === '猫');

  test('Từ "猫" xuất hiện đúng 1 lần trong folder Mặc định', () => {
    const nekoInDefault = defaultCards1.filter(c => c.word === '猫');
    assert.strictEqual(nekoInDefault.length, 1, 'Số lượng thẻ "猫" trong deck_default phải là 1');
  });

  test('Từ "猫" trong savedWords có folder là "Mặc định"', () => {
    assert.ok(nekoSaved, 'Không tìm thấy "猫" trong savedWords');
    assert.strictEqual(nekoSaved.folder, 'Mặc định');
  });

  // ----------------------------------------------------
  // TEST 2: Lưu từ mới vào folder A ("JLPT N3")
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Lưu từ mới vào folder A ("JLPT N3") ---');
  const deckA = await saveDeck({ name: 'JLPT N3', description: 'Từ vựng N3' });
  const word2 = {
    word: '田舎',
    reading: 'いなか',
    hanviet: 'Điền xá',
    meaning: 'Nông thôn, quê hương'
  };
  // Lưu trực tiếp vào JLPT N3
  await addWordToReview(word2, 'JLPT N3');

  const allCards2 = await getAllCards();
  const savedWords2 = await getSavedWords();
  const cardsInA = allCards2.filter(c => c.deckId === deckA.id && c.word === '田舎');
  const cardsInDefault2 = allCards2.filter(c => c.deckId === defaultDeckId && c.word === '田舎');
  const inakaSaved = savedWords2.find(w => w.word === '田舎');

  test('Từ "田舎" chỉ xuất hiện trong folder A ("JLPT N3")', () => {
    assert.strictEqual(cardsInA.length, 1, 'Thẻ "田舎" phải xuất hiện 1 lần trong deck A');
  });

  test('Từ "田舎" KHÔNG xuất hiện trong folder mặc định', () => {
    assert.strictEqual(cardsInDefault2.length, 0, 'Thẻ "田舎" KHÔNG ĐƯỢC xuất hiện trong deck_default');
  });

  test('Bản ghi trong savedWords có folder là "JLPT N3"', () => {
    assert.ok(inakaSaved, 'Không tìm thấy "田舎" trong savedWords');
    assert.strictEqual(inakaSaved.folder, 'JLPT N3');
  });

  // ----------------------------------------------------
  // TEST 3: Lưu một từ khác vào folder B ("Kinh Tế")
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Lưu một từ khác vào folder B ("Kinh Tế") ---');
  const deckB = await saveDeck({ name: 'Kinh Tế', description: 'Chủ đề thương mại kinh tế' });
  const word3 = {
    word: '貿易',
    reading: 'ぼうえき',
    hanviet: 'Mậu dịch',
    meaning: 'Thương mại quốc tế'
  };
  await addWordToReview(word3, 'Kinh Tế');

  const allCards3 = await getAllCards();
  const savedWords3 = await getSavedWords();
  const cardsInB = allCards3.filter(c => c.deckId === deckB.id && c.word === '貿易');
  const boEkiInDefault = allCards3.filter(c => c.deckId === defaultDeckId && c.word === '貿易');
  const boEkiSaved = savedWords3.find(w => w.word === '貿易');

  test('Từ "貿易" chỉ xuất hiện trong folder B ("Kinh Tế")', () => {
    assert.strictEqual(cardsInB.length, 1, 'Thẻ "貿易" phải xuất hiện 1 lần trong deck B');
  });

  test('Từ "貿易" KHÔNG bị thêm vào folder mặc định', () => {
    assert.strictEqual(boEkiInDefault.length, 0, 'Thẻ "貿易" KHÔNG ĐƯỢC xuất hiện trong deck_default');
  });

  test('Bản ghi trong savedWords có folder là "Kinh Tế"', () => {
    assert.ok(boEkiSaved, 'Không tìm thấy "貿易" trong savedWords');
    assert.strictEqual(boEkiSaved.folder, 'Kinh Tế');
  });

  // ----------------------------------------------------
  // TEST 4: Lưu lại cùng một từ vào cùng một folder (Chống trùng lặp)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Lưu lại cùng một từ vào cùng một folder ---');
  // Giả sử thẻ "田舎" đã có interval SRS
  const inakaCard = (await getAllCards()).find(c => c.deckId === deckA.id && c.word === '田舎');
  await rateCardSrs(inakaCard.id, 3);
  const cardAfterSrs = (await getAllCards()).find(c => c.id === inakaCard.id);
  const prevInterval = cardAfterSrs.srs.interval;

  // Lưu lại vào deck A với nghĩa bổ sung
  await addWordToReview({
    word: '田舎',
    reading: 'いなか',
    hanviet: 'Điền xá',
    meaning: 'Nông thôn (cập nhật chi tiết)'
  }, 'JLPT N3');

  const allCards4 = await getAllCards();
  const inakaInA_after = allCards4.filter(c => c.deckId === deckA.id && c.word === '田舎');

  test('Không tạo bản ghi trùng lặp trong deck A (Vẫn chỉ có 1 thẻ)', () => {
    assert.strictEqual(inakaInA_after.length, 1);
  });

  test('Thông tin cập nhật nhưng BẢO TOÀN tiến độ SRS', () => {
    assert.strictEqual(inakaInA_after[0].meaning, 'Nông thôn (cập nhật chi tiết)');
    assert.strictEqual(inakaInA_after[0].srs.interval, prevInterval);
  });

  // ----------------------------------------------------
  // TEST 5: Đổi folder / Di chuyển từ folder A sang folder B (updateWordFolder)
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Di chuyển từ vựng từ folder A sang folder B ---');
  // Giả sử từ "田舎" đang ở JLPT N3, người dùng chuyển sang "Kinh Tế"
  await updateWordFolder('田舎', 'Kinh Tế', 'JLPT N3');

  const allCards5 = await getAllCards();
  const savedWords5 = await getSavedWords();
  const inakaInA_afterMove = allCards5.filter(c => c.deckId === deckA.id && c.word === '田舎');
  const inakaInB_afterMove = allCards5.filter(c => c.deckId === deckB.id && c.word === '田舎');
  const inakaInDefault_afterMove = allCards5.filter(c => c.deckId === defaultDeckId && c.word === '田舎');
  const inakaSavedAfterMove = savedWords5.find(w => w.word === '田舎');

  test('Từ "田舎" đã chuyển sang folder B ("Kinh Tế")', () => {
    assert.strictEqual(inakaInB_afterMove.length, 1);
  });

  test('Từ "田舎" KHÔNG CÒN trong folder cũ A ("JLPT N3")', () => {
    assert.strictEqual(inakaInA_afterMove.length, 0);
  });

  test('Từ "田舎" KHÔNG CÒN trong folder mặc định', () => {
    assert.strictEqual(inakaInDefault_afterMove.length, 0);
  });

  test('Bản ghi savedWords cập nhật folder mới là "Kinh Tế"', () => {
    assert.strictEqual(inakaSavedAfterMove.folder, 'Kinh Tế');
  });

  // ----------------------------------------------------
  // TEST 6: Mô phỏng lưu nhầm vào Mặc định rồi đổi sang Folder A
  // (Đúng như tình huống người dùng bôi đen từ trên web)
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Bôi đen lưu vào Mặc định rồi đổi sang Folder A ngay ---');
  const wordWeb = {
    word: '会議',
    reading: 'かいぎ',
    hanviet: 'Hội nghị',
    meaning: 'Cuộc họp'
  };
  // Bước 1: Lúc đầu bấm lưu (tạm vào Mặc định)
  await addWordToReview(wordWeb, 'Mặc định');
  let cardsMid = await getAllCards();
  assert.strictEqual(cardsMid.filter(c => c.word === '会議' && c.deckId === defaultDeckId).length, 1);

  // Bước 2: Người dùng chọn đổi dropdown sang "JLPT N3"
  await updateWordFolder('会議', 'JLPT N3');

  const allCards6 = await getAllCards();
  const savedWords6 = await getSavedWords();
  const kaigiInDefault = allCards6.filter(c => c.word === '会議' && c.deckId === defaultDeckId);
  const kaigiInN3 = allCards6.filter(c => c.word === '会議' && c.deckId === deckA.id);
  const kaigiSaved = savedWords6.find(w => w.word === '会議');

  test('Từ "会議" xuất hiện trong "JLPT N3"', () => {
    assert.strictEqual(kaigiInN3.length, 1);
  });

  test('Bản ghi của "会議" đã được xóa sạch khỏi folder mặc định (KHÔNG CÒN DƯ THỪA)', () => {
    assert.strictEqual(kaigiInDefault.length, 0, 'LỖI: Bản ghi vẫn còn trong folder mặc định!');
  });

  test('savedWords ghi nhận "会議" chỉ thuộc "JLPT N3"', () => {
    assert.strictEqual(kaigiSaved.folder, 'JLPT N3');
  });

  // ----------------------------------------------------
  // TEST 7: Dọn dẹp dữ liệu cũ (cleanupDuplicateDefaultCards)
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Kiểm tra tính năng dọn dẹp an toàn các bản sao cũ bị lưu nhầm ---');
  // Giả lập một bản ghi bị lưu nhầm trước đây:
  // Từ "家族" có thẻ trong deckA, savedWords ghi "JLPT N3", nhưng lại có 1 thẻ ghost trong defaultDeckId
  const ghostCard = {
    id: 'ghost_card_1',
    deckId: defaultDeckId,
    word: '家族',
    reading: 'かぞく',
    meaning: 'Gia đình'
  };
  const legitCard = {
    id: 'legit_card_1',
    deckId: deckA.id,
    word: '家族',
    reading: 'かぞく',
    meaning: 'Gia đình'
  };
  const cardsWithGhost = await getAllCards();
  cardsWithGhost.push(ghostCard, legitCard);
  await saveAllCards(cardsWithGhost);

  const wordsWithGhost = await getSavedWords();
  wordsWithGhost.push({
    word: '家族',
    folder: 'JLPT N3'
  });
  await new Promise(r => chrome.storage.local.set({ 'savedWords': wordsWithGhost }, r));

  // Chạy hàm dọn dẹp
  const cleanedCount = await cleanupDuplicateDefaultCards();

  const cardsAfterCleanup = await getAllCards();
  const kazokuInDefault = cardsAfterCleanup.filter(c => c.word === '家族' && c.deckId === defaultDeckId);
  const kazokuInA = cardsAfterCleanup.filter(c => c.word === '家族' && c.deckId === deckA.id);
  const nekoStillInDefault = cardsAfterCleanup.filter(c => c.word === '猫' && c.deckId === defaultDeckId);

  test('Đã phát hiện và dọn dẹp đúng 1 bản sao ghost trong deck_default', () => {
    assert.strictEqual(cleanedCount, 1);
    assert.strictEqual(kazokuInDefault.length, 0, 'Ghost card trong deck_default chưa được dọn dẹp');
  });

  test('Thẻ hợp lệ trong folder "JLPT N3" được bảo toàn 100%', () => {
    assert.strictEqual(kazokuInA.length, 1);
  });

  test('Từ "猫" vốn được lưu hợp lệ vào "Mặc định" KHÔNG HỀ BỊ ẢNH HƯỞNG', () => {
    assert.strictEqual(nekoStillInDefault.length, 1);
  });

  console.log('\n========================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL.`);
  console.log('========================================================');
  if (failed > 0) process.exit(1);
}

runFolderSyncTests().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
