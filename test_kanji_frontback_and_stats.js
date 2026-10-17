/**
 * Test Suite: Kanji Flashcard Front/Back Content & Real Learning Statistics
 *
 * Kiểm tra chuyên sâu Task 1 và Task 2 theo yêu cầu kỹ thuật:
 * 1. Nhận diện chuẩn xác thẻ Chữ Hán (Kanji) vs Từ vựng thường.
 * 2. Trích xuất thông tin Chữ Hán (Âm On, Kun, Hán Việt, Nghĩa, Số nét, Bộ thủ, Ví dụ).
 * 3. Mặt trước chỉ hiển thị duy nhất Chữ Hán (không lộ âm On/Kun/nghĩa/nét).
 * 4. Mặt sau hiển thị bố cục chuẩn hóa các mục có dữ liệu thực tế.
 * 5. Ghi nhận phiên học thực tế (recordStudySession) với đầy đủ siêu dữ liệu.
 * 6. Loại bỏ phiên rỗng (0 thẻ được đánh giá).
 * 7. Thống kê tiến độ thực tế (getReviewStats): Streak, Mastered, Learning, Due, Today/7d/30d, Accuracy, Chart, Breakdowns.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runTests() {
  console.log('========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: KANJI FRONT/BACK & REAL STATISTICS');
  console.log('========================================================\n');

  // Mock sandbox memory store
  const mockStorage = {
    savedWords: [],
    savedFolders: ['Mặc định'],
    jpex_decks: [{ id: 'deck_default', name: 'Mặc định', createdAt: Date.now(), updatedAt: Date.now() }],
    jpex_cards: [],
    jpex_review_stats: {
      totalReviews: 0,
      streakDays: 0,
      lastReviewDate: null,
      history: []
    },
    nihongo_study_sessions: []
  };

  const mockChrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          let res = {};
          if (Array.isArray(keys)) keys.forEach(k => res[k] = mockStorage[k]);
          else if (typeof keys === 'string') res[keys] = mockStorage[keys];
          else if (typeof keys === 'object') Object.keys(keys).forEach(k => res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k]);
          setTimeout(() => cb(res), 5);
        },
        set: (data, cb) => {
          Object.assign(mockStorage, data);
          setTimeout(() => cb && cb(), 5);
        }
      }
    },
    runtime: {
      sendMessage: () => {}
    }
  };

  const storageCode = fs.readFileSync(path.resolve(__dirname, 'JPEX/scripts/storage.js'), 'utf8');
  const workspaceCode = fs.readFileSync(path.resolve(__dirname, 'JPEX/scripts/workspace.js'), 'utf8');

  class MockJPEXDatabase {
    constructor() {}
    async init() { return this; }
  }

  const mockElements = new Map();
  function getOrCreateElement(id) {
    if (!mockElements.has(id)) {
      mockElements.set(id, {
        id,
        style: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          contains(c) { return this.classes.has(c); }
        },
        innerText: '',
        innerHTML: '',
        children: [],
        appendChild(ch) { this.children.push(ch); },
        addEventListener: () => {}
      });
    }
    return mockElements.get(id);
  }

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
    Promise,
    localStorage: {
      _store: {},
      getItem(k) { return this._store[k] || null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; }
    },
    JPEXDatabase: MockJPEXDatabase,
    escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    getPrimaryMeaningText: (s) => String(s || '').split(';')[0],
    playPronunciation: () => {},
    document: {
      getElementById: (id) => getOrCreateElement(id),
      createElement: (tag) => ({
        tagName: tag,
        style: {},
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); }
        },
        innerText: '',
        innerHTML: '',
        children: [],
        appendChild(ch) { this.children.push(ch); }
      }),
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.global = ctx;

  vm.createContext(ctx);
  vm.runInContext(storageCode, ctx);
  vm.runInContext(workspaceCode, ctx);

  const AppState = vm.runInContext('AppState', ctx);
  ctx.AppState = AppState;

  let passed = 0;
  let total = 0;
  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(e);
      process.exit(1);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(e);
      process.exit(1);
    }
  }

  // --------------------------------------------------------------------------
  console.log('--- 1. Nhận diện thẻ Kanji vs Từ vựng thường (isKanjiCard) ---');
  // --------------------------------------------------------------------------
  test('Thẻ có cardType = "kanji" được nhận diện là Kanji', () => {
    assert.strictEqual(ctx.isKanjiCard({ cardType: 'kanji', word: '日' }), true);
  });

  test('Thẻ có sourceType = "kanji" được nhận diện là Kanji', () => {
    assert.strictEqual(ctx.isKanjiCard({ sourceType: 'kanji', word: '月' }), true);
  });

  test('Thẻ ký tự đơn CJK có "On:" trong reading được nhận diện là Kanji', () => {
    assert.strictEqual(ctx.isKanjiCard({ word: '火', reading: 'On: カ | Kun: ひ' }), true);
  });

  test('Thẻ ký tự đơn CJK có "Số nét:" trong notes được nhận diện là Kanji', () => {
    assert.strictEqual(ctx.isKanjiCard({ word: '水', notes: 'Số nét: 4 • Bộ thủ: 水' }), true);
  });

  test('Từ vựng thông thường 1 chữ Kanji (vd: 本 - ほん) KHÔNG bị nhận diện nhầm là thẻ Kanji', () => {
    const vocabCard = {
      cardType: 'vocab',
      word: '本',
      reading: 'ほん',
      meaning: 'sách, quyển sách'
    };
    assert.strictEqual(ctx.isKanjiCard(vocabCard), false);
  });

  test('Từ vựng thông thường nhiều chữ (vd: 貿易 - ぼうえき) là vocab, KHÔNG phải Kanji', () => {
    const vocabCard = {
      cardType: 'vocab',
      word: '貿易',
      reading: 'ぼうえき',
      meaning: 'thương mại'
    };
    assert.strictEqual(ctx.isKanjiCard(vocabCard), false);
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 2. Trích xuất thông tin Chữ Hán (extractKanjiDetails) ---');
  // --------------------------------------------------------------------------
  test('Trích xuất đầy đủ On, Kun, Hán Việt, Số nét, Bộ thủ, Ví dụ từ card có cấu trúc', () => {
    const kanjiCard = {
      character: '学',
      word: '学',
      onyomi: ['ガク'],
      kunyomi: ['まな.ぶ'],
      hanviet: 'học',
      meaningVi: 'học tập, trường học',
      strokes: 8,
      radical: '子',
      examples: [
        { word: '学校', reading: 'がっこう', meaningVi: 'Trường học' },
        { word: '学生', reading: 'がくせい', meaningVi: 'Học sinh, sinh viên' }
      ],
      notes: 'Chữ Hán JLPT N5 • Mẹo nhớ: em bé đội mũ đi học'
    };

    const details = ctx.extractKanjiDetails(kanjiCard);
    assert.strictEqual(details.character, '学');
    assert.strictEqual(details.onyomi, 'ガク');
    assert.strictEqual(details.kunyomi, 'まな.ぶ');
    assert.strictEqual(details.hanviet, 'HỌC');
    assert.strictEqual(details.meaning, 'học tập, trường học');
    assert.strictEqual(details.strokes, 8);
    assert.strictEqual(details.radical, '子');
    assert.strictEqual(details.examples.length, 2);
    assert.strictEqual(details.examples[0].word, '学校');
    assert.ok(details.notes.includes('Mẹo nhớ'));
    assert.ok(!details.notes.includes('Chữ Hán JLPT N5'));
  });

  test('Trích xuất an toàn từ thẻ Kanji lưu theo dạng chuỗi reading và notes', () => {
    const legacyKanjiCard = {
      word: '語',
      reading: 'On: ゴ | Kun: かた.る',
      hanviet: 'ngữ',
      meaning: 'ngôn ngữ, từ ngữ',
      notes: 'Chữ Hán JLPT N5 • Số nét: 14 • Bộ thủ: 言'
    };

    const details = ctx.extractKanjiDetails(legacyKanjiCard);
    assert.strictEqual(details.character, '語');
    assert.strictEqual(details.onyomi, 'ゴ');
    assert.strictEqual(details.kunyomi, 'かた.る');
    assert.strictEqual(details.hanviet, 'NGỮ');
    assert.strictEqual(details.strokes, '14');
    assert.strictEqual(details.radical, '言');
  });

  test('Xử lý an toàn khi thiếu các trường không bắt buộc (không lỗi, không bịa đặt)', () => {
    const minimalKanjiCard = {
      word: '凹',
      hanviet: 'AO',
      meaning: 'lõm xuống'
    };

    const details = ctx.extractKanjiDetails(minimalKanjiCard);
    assert.strictEqual(details.character, '凹');
    assert.strictEqual(details.onyomi, '');
    assert.strictEqual(details.kunyomi, '');
    assert.strictEqual(details.hanviet, 'AO');
    assert.strictEqual(details.meaning, 'lõm xuống');
    assert.strictEqual(details.strokes, '');
    assert.strictEqual(details.radical, '');
    assert.strictEqual(details.examples.length, 0);
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 3. Logic hiển thị Mặt trước và Mặt sau thẻ Kanji ---');
  // --------------------------------------------------------------------------
  test('Mặt trước thẻ Kanji CHỈ hiển thị duy nhất Chữ Hán, ẩn đọc & nghĩa & TTS', () => {
    const kanjiCard = {
      cardType: 'kanji',
      character: '漢',
      word: '漢',
      onyomi: ['カン'],
      hanviet: 'HÁN',
      meaningVi: 'chữ Hán'
    };

    ctx.AppState.reviewQueue = [kanjiCard];
    ctx.AppState.reviewCurrentIndex = 0;
    ctx.renderCurrentReviewCard();

    const frontWord = getOrCreateElement('card-front-word');
    const frontReading = getOrCreateElement('card-front-reading');
    const frontAudio = getOrCreateElement('btn-card-audio-front');
    const vocabBack = getOrCreateElement('vocab-back-content');
    const kanjiBack = getOrCreateElement('kanji-back-content');

    assert.strictEqual(frontWord.innerText, '漢');
    assert.strictEqual(frontReading.style.display, 'none');
    assert.strictEqual(frontAudio.style.display, 'none');
    assert.strictEqual(vocabBack.style.display, 'none');
    assert.strictEqual(kanjiBack.style.display, 'flex');
  });

  test('Mặt trước thẻ từ vựng thường giữ nguyên phát âm & reading', () => {
    const vocabCard = {
      cardType: 'vocab',
      word: '貿易',
      reading: 'ぼうえき',
      meaning: 'thương mại quốc tế'
    };

    ctx.AppState.reviewQueue = [vocabCard];
    ctx.AppState.reviewCurrentIndex = 0;
    ctx.renderCurrentReviewCard();

    const frontWord = getOrCreateElement('card-front-word');
    const frontReading = getOrCreateElement('card-front-reading');
    const frontAudio = getOrCreateElement('btn-card-audio-front');
    const vocabBack = getOrCreateElement('vocab-back-content');
    const kanjiBack = getOrCreateElement('kanji-back-content');

    assert.strictEqual(frontWord.innerText, '貿易');
    assert.strictEqual(frontReading.style.display, 'block');
    assert.strictEqual(frontReading.innerText, 'ぼうえき');
    assert.strictEqual(frontAudio.style.display, 'inline-block');
    assert.strictEqual(vocabBack.style.display, 'flex');
    assert.strictEqual(kanjiBack.style.display, 'none');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 4. Ghi nhận phiên học thực tế (recordStudySession) ---');
  // --------------------------------------------------------------------------
  await testAsync('Không lưu phiên học rỗng (0 thẻ được đánh giá)', async () => {
    const emptySession = {
      id: 'sess_empty_1',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      itemsPresented: 20,
      itemsReviewed: 0,
      knownCount: 0,
      unknownCount: 0
    };

    const res = await ctx.recordStudySession(emptySession);
    assert.strictEqual(res.success, false);
    const sessions = await ctx.getStudySessions();
    assert.strictEqual(sessions.some(s => s.id === 'sess_empty_1'), false);
  });

  await testAsync('Lưu phiên học hoàn thành thực tế với đầy đủ thông số thời gian, độ chính xác', async () => {
    const validSession = {
      id: 'sess_completed_1',
      startTime: Date.now() - 90000,
      endTime: Date.now(),
      activityType: 'flashcard',
      category: 'kanji',
      level: 'N4',
      deckTitle: 'JLPT N4 - Chữ Hán',
      itemsPresented: 10,
      itemsReviewed: 10,
      knownCount: 8,
      unknownCount: 2,
      status: 'completed',
      itemIds: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10']
    };

    const res = await ctx.recordStudySession(validSession);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.session.accuracy, 80);
    assert.strictEqual(res.session.status, 'completed');
    assert.ok(res.session.durationSec >= 80);

    const saved = await ctx.getStudySessions();
    const found = saved.find(s => s.id === 'sess_completed_1');
    assert.ok(found);
    assert.strictEqual(found.itemsReviewed, 10);
    assert.strictEqual(found.knownCount, 8);
    assert.strictEqual(found.category, 'kanji');
    assert.strictEqual(found.level, 'N4');
  });

  await testAsync('Lưu phiên học dở dang (partial) khi người dùng thoát giữa chừng', async () => {
    const partialSession = {
      id: 'sess_partial_1',
      startTime: Date.now() - 45000,
      endTime: Date.now(),
      activityType: 'flashcard',
      category: 'vocab',
      level: 'N5',
      deckTitle: 'Từ vựng N5',
      itemsPresented: 20,
      itemsReviewed: 5,
      knownCount: 4,
      unknownCount: 1,
      status: 'partial',
      itemIds: ['v1', 'v2', 'v3', 'v4', 'v5']
    };

    const res = await ctx.recordStudySession(partialSession);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.session.status, 'partial');
    assert.strictEqual(res.session.itemsReviewed, 5);
    assert.strictEqual(res.session.accuracy, 80);
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 5. Thống kê tiến độ ôn tập thực tế (getReviewStats) ---');
  // --------------------------------------------------------------------------
  await testAsync('Chuỗi học tập streakDays tính chính xác theo ngày lịch thực tế', async () => {
    const stats = await ctx.getReviewStats();
    assert.ok(stats.streakDays >= 1);
  });

  await testAsync('Thống kê tính đúng tổng lượt đánh giá, reviewsToday, 7 days, 30 days', async () => {
    const stats = await ctx.getReviewStats();
    // 10 thẻ + 5 thẻ = 15 lượt đánh giá
    assert.strictEqual(stats.totalReviewActions, 15);
    assert.strictEqual(stats.reviewsToday, 15);
    assert.strictEqual(stats.reviews7Days, 15);
    assert.strictEqual(stats.reviews30Days, 15);
  });

  await testAsync('Biểu đồ 7 ngày có chính xác 7 cột, cột hôm nay ghi nhận đúng 15 lượt', async () => {
    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.dailyActivity7Days.length, 7);
    const todayCol = stats.dailyActivity7Days.find(d => d.isToday);
    assert.ok(todayCol);
    assert.strictEqual(todayCol.count, 15);
  });

  await testAsync('Tỷ lệ chính xác tổng thể tính chuẩn từ các phiên học thực tế', async () => {
    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.knownCount, 12);
    assert.strictEqual(stats.unknownCount, 3);
    assert.strictEqual(stats.accuracy, 80);
  });

  await testAsync('Phân loại theo chuyên mục (Category Breakdown) ghi nhận tách bạch Từ vựng và Chữ Hán', async () => {
    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.categoryBreakdown.kanji, 10);
    assert.strictEqual(stats.categoryBreakdown.vocab, 5);
    assert.strictEqual(stats.categoryBreakdown.grammar, 0);
  });

  await testAsync('Phân loại theo cấp độ JLPT (Level Breakdown) ghi nhận đúng N4 và N5', async () => {
    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.levelBreakdown.N4, 10);
    assert.strictEqual(stats.levelBreakdown.N5, 5);
  });

  await testAsync('Danh sách phiên học gần đây hiển thị đúng thứ tự mới nhất trước', async () => {
    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.recentSessions.length, 2);
    assert.strictEqual(stats.recentSessions[0].id, 'sess_partial_1');
    assert.strictEqual(stats.recentSessions[1].id, 'sess_completed_1');
  });

  // --------------------------------------------------------------------------
  console.log('\n--- 6. Trạng thái rỗng (Empty State) khi chưa học gì ---');
  // --------------------------------------------------------------------------
  await testAsync('Khi chưa có phiên học, streak = 0 và accuracy = null (không hiển thị 0% giả tạo)', async () => {
    const backupSessions = mockStorage.nihongo_study_sessions;
    const backupStats = mockStorage.jpex_review_stats;
    mockStorage.nihongo_study_sessions = [];
    mockStorage.jpex_review_stats = { totalReviews: 0, streakDays: 0, lastReviewDate: null, history: [] };

    const stats = await ctx.getReviewStats();
    assert.strictEqual(stats.streakDays, 0);
    assert.strictEqual(stats.totalReviewActions, 0);
    assert.strictEqual(stats.reviewsToday, 0);
    assert.strictEqual(stats.accuracy, null);
    assert.strictEqual(stats.recentSessions.length, 0);

    // Khôi phục lại
    mockStorage.nihongo_study_sessions = backupSessions;
    mockStorage.jpex_review_stats = backupStats;
  });

  console.log('\n========================================================');
  console.log(`🏁 KẾT QUẢ: ${passed} / ${total} KIỂM THỬ ĐẠT (${Math.round((passed / total) * 100)}% PASS)`);
  console.log('========================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
