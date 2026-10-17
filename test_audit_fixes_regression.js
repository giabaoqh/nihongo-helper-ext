/**
 * Test Suite: Regression Verification for Audit Fixes
 * 
 * Kiểm thử toàn diện 7 lỗi phát hiện trong quá trình kiểm toán:
 * 1. getReviewStats() tính toán số lượt ôn hôm nay, chuỗi ngày liên tục (streak) và lịch sử
 * 2. recordReviewHistory() hỗ trợ cả session object và card rating
 * 3. Token từ Sentence Analyzer được lưu vào Flashcard deck bảo toàn câu ví dụ và bản dịch
 * 4. Tránh trùng ID thẻ khi thêm cùng mục JLPT vào các bộ thẻ khác nhau
 * 5. Ngăn chặn ô nhiễm savedWords khi nhập bộ thẻ chứa Kanji/Ngữ pháp từ JSON
 * 6. Tính nhất quán của Dark / Light Mode và các biến theme token
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runAuditTests() {
  console.log('========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ HỒI QUY: AUDIT BUGS & FIXES');
  console.log('========================================================\n');

  const memoryStore = {
    savedWords: [],
    savedFolders: ['Mặc định'],
    jpex_decks: [{ id: 'deck_default', name: 'Mặc định', createdAt: Date.now(), updatedAt: Date.now() }],
    jpex_cards: [],
    jpex_review_stats: {
      totalReviews: 0,
      streakDays: 1,
      lastReviewDate: null,
      history: []
    },
    jpDictAppSettings: { theme: 'auto', furiganaEnabled: true }
  };

  const mockChrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          let res = {};
          if (Array.isArray(keys)) keys.forEach(k => res[k] = memoryStore[k]);
          else if (typeof keys === 'string') res[keys] = memoryStore[keys];
          else if (typeof keys === 'object') Object.keys(keys).forEach(k => res[k] = memoryStore[k] !== undefined ? memoryStore[k] : keys[k]);
          cb(res);
        },
        set: (data, cb) => {
          Object.assign(memoryStore, data);
          if (cb) cb();
        }
      }
    }
  };

  const storageCode = fs.readFileSync(path.resolve(__dirname, 'JPEX/scripts/storage.js'), 'utf8');
  const ctx = {
    chrome: mockChrome,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Date,
    Math,
    Array,
    Object,
    String,
    Number,
    RegExp,
    Set,
    Map,
    Promise
  };
  vm.createContext(ctx);
  vm.runInContext(storageCode, ctx);

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}`);
      console.error(e);
      process.exit(1);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${desc}`);
      console.error(e);
      process.exit(1);
    }
  }

  // 1. Kiểm thử getReviewStats() & recordReviewHistory()
  console.log('--- 1. Thống kê & Nhật ký phiên học Flashcard SRS ---');
  await testAsync('getReviewStats() trả về cấu trúc hợp lệ khi chưa có lịch sử', async () => {
    const stats = await ctx.getReviewStats();
    assert(typeof stats === 'object', 'stats phải là đối tượng');
    assert(stats.totalReviews === 0, 'totalReviews ban đầu bằng 0');
    assert(stats.todayReviews === 0, 'todayReviews ban đầu bằng 0');
    assert(stats.streak === 0, 'streak ban đầu bằng 0 khi chưa có hoạt động học');
    assert(Array.isArray(stats.history), 'history phải là mảng');
  });

  await testAsync('recordReviewHistory() ghi nhận phiên học (Session Object)', async () => {
    await ctx.recordReviewHistory({
      deckTitle: 'Bộ thẻ JLPT N5',
      cardsCount: 15,
      accuracy: 85,
      timestamp: Date.now()
    });
    const stats = await ctx.getReviewStats();
    assert(stats.totalReviews === 15, 'totalReviews được cộng dồn đúng số thẻ');
    assert(stats.todayReviews === 15, 'todayReviews tính đúng số thẻ hôm nay');
    assert(stats.history.length === 1, 'history có 1 bản ghi phiên học');
    assert(stats.history[0].deckTitle === 'Bộ thẻ JLPT N5', 'Lưu đúng tiêu đề bộ thẻ');
    assert(stats.history[0].accuracy === 85, 'Lưu đúng độ chính xác %');
  });

  await testAsync('recordReviewHistory() ghi nhận chấm điểm thẻ đơn lẻ', async () => {
    await ctx.recordReviewHistory('card_test_123', 'good');
    const stats = await ctx.getReviewStats();
    assert(stats.totalReviews === 16, 'totalReviews tăng thêm 1');
    assert(stats.todayReviews === 16, 'todayReviews tăng thêm 1');
    assert(stats.history.length === 2, 'history có 2 bản ghi');
    assert(stats.history[0].cardId === 'card_test_123', 'Bản ghi đầu tiên là thẻ đơn lẻ');
  });

  // 2. Kiểm thử lưu Token từ Sentence Analyzer vào Flashcard Deck
  console.log('\n--- 2. Lưu từ Sentence Analyzer & Bảo toàn ví dụ ngữ cảnh ---');
  await testAsync('addWordToReview() lưu token vào Flashcard deck với ví dụ và bản dịch', async () => {
    const tokenVocab = {
      kanji: '映画',
      word: '映画',
      reading: 'えいが',
      hanviet: 'ÁNH HỌA',
      meaningVi: 'Phim ảnh, bộ phim điện ảnh',
      meaning: 'Phim ảnh, bộ phim điện ảnh',
      pos: 'Danh từ',
      example: '昨日、友達と映画を見ました。',
      exampleMeaning: 'Hôm qua tôi đã xem phim với bạn.',
      notes: 'Từ vựng Sentence Analyzer'
    };
    await ctx.addWordToReview(tokenVocab, 'Từ vựng bài 1');
    const cards = await ctx.getAllCards();
    const targetCard = cards.find(c => c.word === '映画');
    assert(targetCard !== undefined, 'Thẻ Flashcard 映画 được tạo thành công');
    assert(targetCard.example === '昨日、友達と映画を見ました。', 'Ví dụ câu gốc được bảo toàn');
    assert(targetCard.exampleMeaning === 'Hôm qua tôi đã xem phim với bạn.', 'Bản dịch ví dụ được bảo toàn');

    const savedWords = await ctx.getSavedWords();
    const targetWord = savedWords.find(w => w.word === '映画');
    assert(targetWord !== undefined, 'Từ vựng đồng thời được đồng bộ sang savedWords');
    assert(targetWord.folder === 'Từ vựng bài 1', 'Đúng thư mục đích');
  });

  // 3. Kiểm thử tính duy nhất của ID thẻ khi thêm cùng mục JLPT vào các deck khác nhau
  console.log('\n--- 3. Phòng chống trùng lặp ID thẻ giữa các bộ thẻ ---');
  await testAsync('addJLPTItemsToDeck() tạo ID duy nhất cho thẻ ở từng deck', async () => {
    const item = {
      id: 'k_n5_sun',
      character: '日',
      hanviet: 'NHẬT',
      level: 'N5',
      meaningVi: 'mặt trời, ngày',
      onyomi: ['ニチ'],
      kunyomi: ['ひ']
    };

    await ctx.addJLPTItemsToDeck([item], 'Deck Alpha', 'kanji');
    await ctx.addJLPTItemsToDeck([item], 'Deck Beta', 'kanji');

    const allCards = await ctx.getAllCards();
    const sunCards = allCards.filter(c => c.word === '日');
    assert(sunCards.length === 2, 'Có 2 thẻ "日" ở 2 deck khác nhau');
    assert(sunCards[0].deckId !== sunCards[1].deckId, '2 thẻ thuộc 2 deck khác nhau');
    assert(sunCards[0].id !== sunCards[1].id, '2 thẻ phải có ID hoàn toàn khác nhau (Không bị đụng độ ID)');
    assert(sunCards[0].sourceId === 'k_n5_sun' && sunCards[1].sourceId === 'k_n5_sun', 'Cả 2 thẻ đều giữ sourceId gốc');
  });

  // 4. Kiểm thử import JSON không gây ô nhiễm savedWords
  console.log('\n--- 4. Kiểm thử cách ly khi Import JSON ---');
  await testAsync('importDecksFromJson() không đưa thẻ Kanji và Ngữ pháp vào savedWords', async () => {
    const testJson = JSON.stringify({
      version: 1,
      app: 'JP Dictionary & Flashcards',
      type: 'full_backup',
      decks: [
        {
          id: 'deck_kanji_only',
          name: 'Chữ Hán N5',
          cards: [
            {
              cardType: 'kanji',
              word: '月',
              reading: 'On: ゲツ | Kun: つき',
              hanviet: 'NGUYỆT',
              meaning: 'mặt trăng, tháng'
            },
            {
              cardType: 'grammar',
              word: '〜てはいけない',
              reading: 'te wa ikenai',
              meaning: 'Không được làm gì'
            },
            {
              cardType: 'vocab',
              word: '本',
              reading: 'ほん',
              hanviet: 'BẢN',
              meaning: 'Sách'
            }
          ]
        }
      ]
    });

    await ctx.importDecksFromJson(testJson);
    const savedWords = await ctx.getSavedWords();
    assert(savedWords.some(w => w.word === '本'), 'Từ vựng "本" được đồng bộ sang savedWords');
    assert(!savedWords.some(w => w.word === '月'), 'Chữ Hán "月" KHÔNG bị ô nhiễm vào savedWords');
    assert(!savedWords.some(w => w.word === '〜てはいけない'), 'Ngữ pháp KHÔNG bị ô nhiễm vào savedWords');
  });

  // 5. Kiểm thử CSS Theme & Tokens
  console.log('\n--- 5. Kiểm thử Dark / Light Mode CSS Tokens ---');
  test('theme.css có định nghĩa [data-theme="dark"]', () => {
    const themeCss = fs.readFileSync(path.resolve(__dirname, 'JPEX/styles/theme.css'), 'utf8');
    assert(themeCss.includes('[data-theme="dark"]'), 'Phải có selector [data-theme="dark"]');
    assert(themeCss.includes('--bg-primary: #1e293b'), 'Có biến nền tối chuẩn');
    assert(themeCss.includes('--text-primary: #f8fafc'), 'Có biến chữ sáng chuẩn');
  });

  test('analyzer.css có định nghĩa [data-theme="dark"]', () => {
    const analyzerCss = fs.readFileSync(path.resolve(__dirname, 'JPEX/styles/analyzer.css'), 'utf8');
    assert(analyzerCss.includes('[data-theme="dark"]'), 'Phải có selector [data-theme="dark"]');
    assert(analyzerCss.includes('--analyzer-card-bg: #1e293b'), 'Có biến nền thẻ tối');
  });

  test('analyzer.html có nút chuyển theme', () => {
    const analyzerHtml = fs.readFileSync(path.resolve(__dirname, 'JPEX/analyzer.html'), 'utf8');
    assert(analyzerHtml.includes('id="btn-analyzer-theme-toggle"'), 'Phải có nút btn-analyzer-theme-toggle');
    assert(analyzerHtml.includes('id="analyzer-theme-icon"'), 'Phải có icon theme');
  });

  console.log('\n========================================================');
  console.log(`🏁 KẾT QUẢ: ${passed} / ${total} KIỂM THỬ ĐẠT (100% PASS)`);
  console.log('========================================================\n');
}

runAuditTests().catch(err => {
  console.error('Lỗi kiểm thử:', err);
  process.exit(1);
});
