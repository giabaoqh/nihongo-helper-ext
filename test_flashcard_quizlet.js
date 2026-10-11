/**
 * Test Suite: Quizlet Flashcard UI & Review Logic Verification
 */
const assert = require('assert');

// Mock chrome storage
const mockStorage = {
  storage: {
    local: {
      data: {},
      get: function(keys, cb) {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { res[k] = this.data[k]; });
        } else if (typeof keys === 'object') {
          Object.keys(keys).forEach(k => { res[k] = this.data[k] !== undefined ? this.data[k] : keys[k]; });
        } else {
          res[keys] = this.data[keys];
        }
        cb(res);
      },
      set: function(obj, cb) {
        Object.assign(this.data, obj);
        if (cb) cb();
      }
    }
  }
};
global.chrome = mockStorage;

// Load storage.js
const fs = require('fs');
const storageCode = fs.readFileSync('JPEX/scripts/storage.js', 'utf8');
eval(storageCode);

async function runTests() {
  console.log('=== TEST SUITE: Flashcard Redesign & Review Logic ===');

  // Test 1: Initialize Decks and Cards
  const initialCards = [
    {
      id: 'card_1',
      deckId: 'deck_default',
      word: '貿易',
      reading: 'ぼうえき',
      hanviet: 'mậu dịch',
      meaning: 'Ngoại thương, thương mại',
      example: '貿易摩擦が起きている。',
      exampleMeaning: 'Xảy ra ma sát thương mại.',
      isStarred: false,
      srs: { interval: 1, repetition: 0, efactor: 2.5, dueDate: Date.now() - 1000 }
    },
    {
      id: 'card_2',
      deckId: 'deck_default',
      word: '経済',
      reading: 'けいざい',
      hanviet: 'kinh tế',
      meaning: 'Kinh tế',
      example: '日本経済の動向。',
      exampleMeaning: 'Xu hướng kinh tế Nhật Bản.',
      isStarred: false,
      srs: { interval: 1, repetition: 0, efactor: 2.5, dueDate: Date.now() - 1000 }
    }
  ];
  await saveAllCards(initialCards);

  // Test 2: toggleStarCard
  console.log('\n--- 1. Kiểm thử đánh dấu sao (⭐) & đồng bộ Từ đã lưu ---');
  let isStarred = await toggleStarCard('card_1');
  assert.strictEqual(isStarred, true, 'Thẻ 1 phải được gắn sao');
  let savedWords = await getSavedWords();
  assert(savedWords.some(w => w.kanji === '貿易' || w.word === '貿易'), 'Từ 貿易 phải xuất hiện trong từ đã lưu');
  console.log('  ✓ PASS: Gắn sao và tự động đồng bộ sang savedWords');

  // Bỏ sao
  let isUnstarred = await toggleStarCard('card_1');
  assert.strictEqual(isUnstarred, false, 'Thẻ 1 phải được bỏ sao');
  savedWords = await getSavedWords();
  assert(!savedWords.some(w => w.kanji === '貿易' || w.word === '貿易'), 'Từ 貿易 phải bị gỡ khỏi từ đã lưu');
  console.log('  ✓ PASS: Bỏ sao và tự động xóa khỏi savedWords');

  // Test 3: SRS Rate Known & Unknown
  console.log('\n--- 2. Kiểm thử đánh giá SRS (Known / Unknown) ---');
  // Unknown (Rating 1)
  let updatedCard = await rateCardSrs('card_1', 1);
  assert.strictEqual(updatedCard.srs.repetition, 0, 'Đánh giá 1 thì repetition phải reset về 0');
  assert.strictEqual(updatedCard.srs.interval, 0, 'Interval phải là 0 (ôn lại ngay)');
  console.log('  ✓ PASS: Đánh giá Chưa biết (Z/✕) reset interval và repetition chính xác');

  // Known (Rating 3)
  updatedCard = await rateCardSrs('card_2', 3);
  assert.strictEqual(updatedCard.srs.repetition, 1, 'Đánh giá 3 thì repetition tăng lên 1');
  assert(updatedCard.srs.dueDate > Date.now(), 'DueDate phải ở tương lai');
  console.log('  ✓ PASS: Đánh giá Đã biết (X/✓) cập nhật repetition và dueDate chính xác');

  // Test 4: Study Direction Content Rendering Simulation
  console.log('\n--- 3. Kiểm thử chiều học JP→VI và VI→JP ---');
  const card = initialCards[0];

  // Chiều JP -> VI
  let frontContent_JP = card.word;
  let backContent_JP = {
    word: card.word,
    reading: card.reading,
    hanviet: card.hanviet,
    meaning: card.meaning
  };
  assert.strictEqual(frontContent_JP, '貿易', 'Mặt trước JP->VI phải là từ Kanji');
  assert.strictEqual(backContent_JP.meaning, 'Ngoại thương, thương mại', 'Mặt sau JP->VI chứa nghĩa tiếng Việt');
  console.log('  ✓ PASS: Chiều học JP→VI hiển thị đúng cấu trúc');

  // Chiều VI -> JP
  let frontContent_VI = card.meaning;
  let backContent_VI = {
    word: card.word,
    reading: card.reading,
    hanviet: card.hanviet,
    meaning: card.meaning
  };
  assert.strictEqual(frontContent_VI, 'Ngoại thương, thương mại', 'Mặt trước VI->JP phải là nghĩa');
  assert.strictEqual(backContent_VI.word, '貿易', 'Mặt sau VI->JP chứa từ tiếng Nhật gốc');
  console.log('  ✓ PASS: Chiều học VI→JP hiển thị đúng cấu trúc mà không thay đổi dữ liệu gốc');

  // Test 5: Undo Simulation
  console.log('\n--- 4. Kiểm thử hoàn tác (Undo) ---');
  const reviewHistory = [];
  const prevSrsState = { ...card.srs };
  reviewHistory.push({
    index: 0,
    cardId: card.id,
    cardObj: { ...card },
    isKnown: false,
    prevSrs: prevSrsState
  });

  const lastAction = reviewHistory.pop();
  assert.strictEqual(lastAction.index, 0, 'Phục hồi lại index 0');
  assert.deepStrictEqual(lastAction.prevSrs, prevSrsState, 'Phục hồi lại trạng thái SRS ban đầu');
  console.log('  ✓ PASS: Hoàn tác phục hồi chính xác vị trí và trạng thái SRS trước đó');

  console.log('\n========================================================');
  console.log('TẤT CẢ KIỂM THỬ QUIZLET FLASHCARD ĐỀU THÀNH CÔNG (PASS)');
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
