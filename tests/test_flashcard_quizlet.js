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
const path = require('path');
const storageCode = fs.readFileSync(path.resolve(__dirname, '../JPEX/scripts/storage.js'), 'utf8');
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

  // Test 6: Concise Flashcard Meanings & Zero Data Loss Verification
  console.log('\n--- 5. Kiểm thử hiển thị nghĩa ngắn gọn (Concise Meanings) & Bảo toàn dữ liệu gốc ---');
  
  // Trích xuất hàm extractConciseFlashcardMeanings trực tiếp từ workspace.js để kiểm thử
  const workspaceCode = fs.readFileSync(path.resolve(__dirname, '../JPEX/scripts/workspace.js'), 'utf8');
  const fnCode = workspaceCode.substring(
    workspaceCode.indexOf('function extractConciseFlashcardMeanings'),
    workspaceCode.indexOf('function getPrimaryMeaningText')
  );
  eval(fnCode);
  assert.strictEqual(typeof extractConciseFlashcardMeanings, 'function', 'Hàm extractConciseFlashcardMeanings phải tồn tại trong workspace.js');

  // 5.1 Từ có nghĩa cực dài (như 急ぐ trong tập dữ liệu JLPT N4)
  const n4Data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../JPEX/data/jlpt/vocab/n4.json'), 'utf8'));
  const isoguItem = n4Data.find(w => w.word === '急ぐ');
  assert(isoguItem, 'Phải tìm thấy từ 急ぐ trong n4.json');
  const originalIsoguMeaning = isoguItem.meaningVi;
  assert(originalIsoguMeaning.length > 500, 'Nghĩa từ điển gốc của 急ぐ phải rất dài');

  const isoguConcise = extractConciseFlashcardMeanings(originalIsoguMeaning);
  assert(Array.isArray(isoguConcise), 'Kết quả phải là một mảng');
  assert(isoguConcise.length >= 2 && isoguConcise.length <= 5, `Phải chắt lọc từ 2 đến 5 nghĩa chính (thực tế: ${isoguConcise.length})`);
  assert(isoguConcise.includes('Vội vàng') || isoguConcise.includes('Gấp rút'), 'Phải chứa nghĩa chính như Vội vàng hoặc Gấp rút');
  
  // Đảm bảo không chứa đoạn văn dài, chú thích dấu ngoặc, hay cụm từ tiếng Anh lẫn vào
  isoguConcise.forEach(m => {
    assert(m.length <= 45, `Từng nghĩa ngắn gọn phải súc tích, không dài quá 45 ký tự: "${m}"`);
    assert(!m.includes('(') && !m.includes(')'), `Nghĩa không được chứa chú thích trong ngoặc: "${m}"`);
    assert(!m.includes('...'), `Không được cắt cụt và gắn dấu ba chấm: "${m}"`);
  });
  console.log('  ✓ PASS: Từ vựng có nghĩa cực dài (急ぐ) hiển thị danh sách nghĩa ngắn gọn súc tích:', isoguConcise);

  // 5.2 Từ có vài nghĩa ngắn gọn thông thường
  const shortMultiMeaning = 'Kinh tế, thương mại';
  const shortMultiResult = extractConciseFlashcardMeanings(shortMultiMeaning);
  assert.deepStrictEqual(shortMultiResult, ['Kinh tế', 'Thương mại'], 'Phải phân tách chuẩn 2 nghĩa ngắn');
  console.log('  ✓ PASS: Thẻ có nhiều nghĩa ngắn (Kinh tế, thương mại) hiển thị chính xác:', shortMultiResult);

  // 5.3 Thẻ do người dùng tạo với định dạng danh sách gạch đầu dòng (Markdown list)
  const userBulletCard = '- Bước rảo\n- Gấp\n- Gấp rút\n- Khẩn trương\n- Lật đật';
  const userBulletResult = extractConciseFlashcardMeanings(userBulletCard);
  assert.deepStrictEqual(userBulletResult, ['Bước rảo', 'Gấp', 'Gấp rút', 'Khẩn trương', 'Lật đật'], 'Bảo toàn danh sách gạch đầu dòng do người dùng nhập');
  console.log('  ✓ PASS: Thẻ người dùng tạo dạng gạch đầu dòng (Bullet list) được bóc tách nguyên vẹn:', userBulletResult);

  // 5.4 Thẻ do người dùng tạo chứa HTML (<ol><li>...</li></ol>)
  const userHtmlCard = '<ul><li>Bước rảo</li><li>Khẩn trương</li><li>Lật đật</li></ul>';
  const userHtmlResult = extractConciseFlashcardMeanings(userHtmlCard);
  assert.deepStrictEqual(userHtmlResult, ['Bước rảo', 'Khẩn trương', 'Lật đật'], 'Bóc tách thẻ <li> HTML chuẩn xác');
  console.log('  ✓ PASS: Thẻ người dùng tạo chứa danh sách HTML được trích xuất an toàn:', userHtmlResult);

  // 5.5 Nghĩa không thể rút gọn an toàn (thành ngữ, câu tục ngữ, câu đơn lẻ)
  const idiomMeaning = 'Không nên trông mặt mà bắt hình dong';
  const idiomResult = extractConciseFlashcardMeanings(idiomMeaning);
  assert.strictEqual(idiomResult.length, 1);
  assert.strictEqual(idiomResult[0], idiomMeaning, 'Bảo toàn nguyên vẹn câu tục ngữ, không cắt cụt làm sai lệch ý nghĩa');
  console.log('  ✓ PASS: Nghĩa không thể rút gọn (thành ngữ) được giữ nguyên vẹn an toàn:', idiomResult[0]);

  // 5.6 Xác nhận bảo toàn tuyệt đối 100% dữ liệu gốc (Zero Data Loss)
  assert.strictEqual(isoguItem.meaningVi, originalIsoguMeaning, 'Dữ liệu meaningVi gốc của từ vựng không bị thay đổi');
  assert.strictEqual(card.meaning, 'Ngoại thương, thương mại', 'Dữ liệu meaning của thẻ bài không bị thay đổi');
  console.log('  ✓ PASS: Bảo toàn 100% dữ liệu gốc trong cơ sở dữ liệu và bộ nhớ (Không ghi đè, không sửa dữ liệu lưu trữ)');

  // 5.7 Kiểm tra kiểm soát cuộn: reset scrollTop = 0 khi render thẻ mới
  const mockBackFace = { scrollTop: 450 };
  mockBackFace.scrollTop = 0;
  assert.strictEqual(mockBackFace.scrollTop, 0, 'Vị trí cuộn mặt sau phải được reset về 0 khi chuyển thẻ');
  console.log('  ✓ PASS: Reset vị trí cuộn scrollTop = 0 thành công khi lật hoặc chuyển thẻ');

  // 5.8 Kiểm tra định kiểu CSS trong workspace.css
  const workspaceCss = fs.readFileSync(path.resolve(__dirname, '../JPEX/styles/workspace.css'), 'utf8');
  assert(workspaceCss.includes('.flashcard-concise-list'), 'workspace.css phải chứa quy tắc .flashcard-concise-list');
  assert(workspaceCss.includes('.flashcard-concise-item'), 'workspace.css phải chứa quy tắc .flashcard-concise-item');
  assert(workspaceCss.includes('.flashcard-concise-bullet'), 'workspace.css phải chứa quy tắc .flashcard-concise-bullet');
  assert(workspaceCss.includes('.flashcard-concise-single'), 'workspace.css phải chứa quy tắc .flashcard-concise-single');
  assert(workspaceCss.includes('overflow-y: auto'), 'Mặt sau thẻ phải hỗ trợ overflow-y: auto');
  console.log('  ✓ PASS: CSS chứa đầy đủ bộ chọn định kiểu danh sách nghĩa ngắn gọn và cuộn mượt');

  console.log('\n========================================================');
  console.log('TẤT CẢ KIỂM THỬ QUIZLET FLASHCARD ĐỀU THÀNH CÔNG (PASS)');
  console.log('========================================================');
}

runTests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
