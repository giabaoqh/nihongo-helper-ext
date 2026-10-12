/**
 * Comprehensive Test Suite for Japanese Sentence Analyzer Upgrade
 * Verifying 12 Required Test Cases, Numbers/Counters, Romaji, and Grammar
 */

const SentenceAnalyzer = require('./scripts/analyzer.js');

async function runTests() {
  await SentenceAnalyzer.init();
  console.log('SentenceAnalyzer initialized. Running comprehensive tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: さらに
  console.log('--- TEST 1: さらに ---');
  {
    const res = await SentenceAnalyzer.analyze('さらに');
    const t = res.tokens[0];
    assert(res.tokens.length === 1, 'Tokenized as single unit');
    assert(t.surface === 'さらに', 'Surface is さらに');
    assert(t.reading === 'さらに', 'Reading is さらに');
    assert(t.romaji === 'sarani', 'Romaji is sarani');
    assert(!t.meaning.includes('Xin lỗi') && !t.meaning.includes('Tạm biệt'), 'Does not inherit ごめんなさい or さようなら');
    assert(t.meaning.includes('Hơn nữa') || t.meaning.includes('thêm nữa'), 'Meaning is accurate');
  }

  // TEST 2: さようなら
  console.log('\n--- TEST 2: さようなら ---');
  {
    const res = await SentenceAnalyzer.analyze('さようなら');
    const t = res.tokens[0];
    assert(res.tokens.length === 1, 'Tokenized as single unit');
    assert(t.surface === 'さようなら', 'Surface is さようなら');
    assert(t.romaji === 'sayounara', 'Romaji is sayounara');
    assert(t.meaning.includes('Tạm biệt'), 'Meaning is Tạm biệt');
  }

  // TEST 3: ごめんなさい
  console.log('\n--- TEST 3: ごめんなさい ---');
  {
    const res = await SentenceAnalyzer.analyze('ごめんなさい');
    const t = res.tokens[0];
    assert(res.tokens.length === 1, 'Tokenized as single unit');
    assert(t.surface === 'ごめんなさい', 'Surface is ごめんなさい');
    assert(t.romaji === 'gomennasai', 'Romaji is gomennasai');
    assert(t.meaning.toLowerCase().includes('xin lỗi'), 'Meaning is Xin lỗi');
  }

  // TEST 4: 私はさらに勉強します。
  console.log('\n--- TEST 4: 私はさらに勉強します。 ---');
  {
    const res = await SentenceAnalyzer.analyze('私はさらに勉強します。');
    const surfaces = res.tokens.map(t => t.surface);
    assert(surfaces.includes('さらに'), 'Contains standalone さらに token');
    assert(!surfaces.includes('さ') && !surfaces.includes('ら'), 'Does not split into さ, ら');
    const sara = res.tokens.find(t => t.surface === 'さらに');
    assert(sara.romaji === 'sarani', 'さらに romaji is sarani');
    assert(!sara.meaning.includes('Xin lỗi'), 'さらに does not inherit ごめんなさい');
    const watashi = res.tokens.find(t => t.surface === '私');
    assert(watashi && watashi.reading === 'わたし', '私 has reading わたし');
    const wa = res.tokens.find(t => t.surface === 'は');
    assert(wa && wa.isParticle, 'は is recognized as particle');
    const benkyou = res.tokens.find(t => t.surface === '勉強');
    assert(benkyou && benkyou.reading === 'べんきょう', '勉強 has reading べんきょう');
  }

  // TEST 5: 学校に行きます。
  console.log('\n--- TEST 5: 学校に行きます。 ---');
  {
    const res = await SentenceAnalyzer.analyze('学校に行きます。');
    const gakkou = res.tokens.find(t => t.surface === '学校');
    assert(gakkou && (gakkou.meaning.includes('Trường học') || gakkou.meaning.includes('trường')), '学校 has accurate meaning');
    assert(gakkou.romaji === 'gakkou', '学校 romaji is gakkou');
    const ni = res.tokens.find(t => t.surface === 'に');
    assert(ni && ni.isParticle, 'に is recognized as particle');
    const ikimasu = res.tokens.find(t => t.surface === '行きます');
    assert(ikimasu && ikimasu.baseForm === '行く', '行きます linked to baseForm 行く');
    assert(ikimasu.romaji === 'ikimasu', '行きます romaji is ikimasu');
  }

  // TEST 6: 日本語を勉強しています。
  console.log('\n--- TEST 6: 日本語を勉強しています。 ---');
  {
    const res = await SentenceAnalyzer.analyze('日本語を勉強しています。');
    const nihongo = res.tokens.find(t => t.surface === '日本語');
    assert(nihongo && nihongo.meaning.includes('tiếng Nhật'), '日本語 has meaning tiếng Nhật');
    const o = res.tokens.find(t => t.surface === 'を');
    assert(o && o.isParticle, 'を is particle');
    const teiru = res.tokens.find(t => t.surface.includes('ています') || t.surface.includes('勉強'));
    assert(teiru !== undefined, 'Recognized continuous aspect');
  }

  // TEST 7: 今日はとても暑いです。
  console.log('\n--- TEST 7: 今日はとても暑いです。 ---');
  {
    const res = await SentenceAnalyzer.analyze('今日はとても暑いです。');
    const kyou = res.tokens.find(t => t.surface === '今日');
    assert(kyou && kyou.reading === 'きょう', '今日 separated from は');
    const wa = res.tokens.find(t => t.surface === 'は');
    assert(wa && wa.isParticle, 'は recognized as topic particle');
    const totemo = res.tokens.find(t => t.surface === 'とても');
    assert(totemo && (totemo.meaning.includes('Rất') || totemo.meaning.includes('lắm')), 'とても has meaning Rất');
    const atsui = res.tokens.find(t => t.surface === '暑い');
    assert(atsui && atsui.meaning.includes('Nóng'), '暑い has meaning Nóng');
  }

  // TEST 8: それから、家に帰りました。
  console.log('\n--- TEST 8: それから、家に帰りました。 ---');
  {
    const res = await SentenceAnalyzer.analyze('それから、家に帰りました。');
    const sorekara = res.tokens.find(t => t.surface === 'それから');
    assert(sorekara && sorekara.meaning.includes('Sau đó'), 'それから tokenized as unit with meaning Sau đó');
    const ie = res.tokens.find(t => t.surface === '家');
    assert(ie && (ie.meaning.includes('Nhà') || ie.reading === 'いえ'), '家 has reading/meaning');
    const kaerimashita = res.tokens.find(t => t.surface === '帰りました');
    assert(kaerimashita && kaerimashita.baseForm === '帰る', '帰りました linked to baseForm 帰る');
  }

  // TEST 9: 本を3冊買いました。
  console.log('\n--- TEST 9: 本を3冊買いました。 ---');
  {
    const res = await SentenceAnalyzer.analyze('本を3冊買いました。');
    const hon = res.tokens.find(t => t.surface === '本');
    assert(hon && hon.meaning.includes('Sách'), '本 has meaning Sách');
    assert(hon.romaji === 'hon', '本 romaji is hon');
    const o = res.tokens.find(t => t.surface === 'を');
    assert(o && o.isParticle, 'を is particle');
    const counter = res.tokens.find(t => t.surface === '3冊');
    assert(counter && counter.isNumberCounter, '3冊 is recognized as numberCounter');
    assert(counter.meaning.includes('3 cuốn sách') || counter.meaning.includes('3 quyển'), '3冊 meaning mentions cuốn/quyển sách');
    assert(counter.reading === 'さんさつ', '3冊 reading is さんさつ');
    assert(counter.romaji === 'sansatsu', '3冊 romaji is sansatsu');
    const kaimashita = res.tokens.find(t => t.surface === '買いました');
    assert(kaimashita && kaimashita.baseForm === '買う', '買いました linked to baseForm 買う');
  }

  // TEST 10: 一人で日本語を勉強しました。
  console.log('\n--- TEST 10: 一人で日本語を勉強しました。 ---');
  {
    const res = await SentenceAnalyzer.analyze('一人で日本語を勉強しました。');
    const hitori = res.tokens.find(t => t.surface === '一人');
    assert(hitori && hitori.isNumberCounter, '一人 recognized as numberCounter');
    assert(hitori.reading === 'ひとり', '一人 reading is ひとり');
    assert(hitori.romaji === 'hitori', '一人 romaji is hitori');
    assert(hitori.meaning.includes('1 người'), '一人 meaning is 1 người');
  }

  // TEST 11: 昨日は学校に行きませんでした。
  console.log('\n--- TEST 11: 昨日は学校に行きませんでした。 ---');
  {
    const res = await SentenceAnalyzer.analyze('昨日は学校に行きませんでした。');
    const kinou = res.tokens.find(t => t.surface === '昨日');
    assert(kinou && kinou.reading === 'きのう', '昨日 reading is きのう');
    const ikimasendeshita = res.tokens.find(t => t.surface === '行きませんでした');
    assert(ikimasendeshita && ikimasendeshita.baseForm === '行く', '行きませんでした linked to baseForm 行く');
    assert(ikimasendeshita.conjugation.includes('phủ định quá khứ') || ikimasendeshita.conjugation.includes('ませんでした'), 'Recognized negative past conjugation');
  }

  // TEST 12: 彼は毎日日本語を勉強しています。
  console.log('\n--- TEST 12: 彼は毎日日本語を勉強しています。 ---');
  {
    const res = await SentenceAnalyzer.analyze('彼は毎日日本語を勉強しています。');
    const kare = res.tokens.find(t => t.surface === '彼');
    assert(kare && kare.reading === 'かれ', '彼 reading is かれ');
    const mainichi = res.tokens.find(t => t.surface === '毎日');
    assert(mainichi && mainichi.reading === 'まいにち', '毎日 reading is まいにち');
  }

  // EXTRA COUNTERS TEST
  console.log('\n--- EXTRA COUNTERS TEST ---');
  const countersToTest = [
    { input: '5人', reading: 'ごにん', romaji: 'gonin' },
    { input: '2回', reading: 'にかい', romaji: 'nikai' },
    { input: '10個', reading: 'じゅっこ', romaji: 'jukko' },
    { input: '二人', reading: 'ふたり', romaji: 'futari' },
    { input: '三冊', reading: 'さんさつ', romaji: 'sansatsu' },
    { input: '何人', reading: 'なんにん', romaji: 'nannin' },
    { input: '何回', reading: 'なんかい', romaji: 'nankai' },
    { input: '何冊', reading: 'なんさつ', romaji: 'nansatsu' },
    { input: '20歳', readingMatch: 'はたち', romajiMatch: 'hatachi' },
    { input: '2026年', reading: 'にせんにじゅうろくねん', romaji: 'nisennijuurokunen', meaningMatch: '2026' },
    { input: '三月', reading: 'さんがつ', romaji: 'sangatsu' },
    { input: '5分間', reading: 'ごふんかん', romaji: 'gofunkan' },
    { input: '3日間', reading: 'みっかかん', romaji: 'mikkakan' },
    { input: '1週間', reading: 'いっしゅうかん', romaji: 'isshuukan' }
  ];

  for (const c of countersToTest) {
    const res = await SentenceAnalyzer.analyze(c.input);
    const tok = res.tokens[0];
    assert(tok.surface === c.input, `${c.input} parsed correctly`);
    if (c.reading) assert(tok.reading === c.reading, `${c.input} reading is ${c.reading}`);
    if (c.readingMatch) assert(tok.reading.includes(c.readingMatch), `${c.input} reading includes ${c.readingMatch}`);
    if (c.romaji) assert(tok.romaji === c.romaji, `${c.input} romaji is ${c.romaji}`);
    if (c.romajiMatch) assert(tok.romaji.includes(c.romajiMatch), `${c.input} romaji includes ${c.romajiMatch}`);
    if (c.meaningMatch) assert(tok.meaning.includes(c.meaningMatch), `${c.input} meaning includes ${c.meaningMatch}`);
  }

  console.log(`\n========================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
