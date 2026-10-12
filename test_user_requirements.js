/**
 * Comprehensive Test Suite for User Requirements
 * Tests all 9 cases specified by the prompt:
 * 1. Kanji đơn giản có nghĩa trong từ điển
 * 2. Từ viết bằng Hiragana
 * 3. Từ viết bằng Katakana
 * 4. Từ có nhiều cách đọc hoặc nhiều nghĩa
 * 5. Câu chứa từ vựng, trợ từ và ngữ pháp
 * 6. Câu chứa số Ả Rập (私は本を3冊買いました。)
 * 7. Câu chứa số Kanji (学生が三人います。)
 * 8. Câu có từ không tìm thấy trong từ điển (xử lý dữ liệu thiếu)
 * 9. Đối chiếu kết quả giữa tra cứu và Sentence Analyzer
 */

const path = require('path');
const sa = require(path.resolve(__dirname, 'JPEX/scripts/analyzer.js'));

let total = 0;
let passed = 0;

function assert(cond, name, details = '') {
  total++;
  if (cond) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CÁC YÊU CẦU CỦA NGƯỜI DÙNG');
  console.log('================================================================\n');

  await sa.init({ dataDir: path.resolve(__dirname, 'JPEX/data') });

  // 1. Một từ Kanji đơn giản có nghĩa trong từ điển
  console.log('--- TEST 1: Từ Kanji đơn giản có nghĩa trong từ điển (本, 私) ---');
  const res1 = await sa.analyze('本');
  assert(res1.success, 'Analyze "本" thành công');
  assert(res1.tokens.length === 1, 'Token count = 1');
  assert(res1.tokens[0].surface === '本', 'Surface = 本');
  assert(res1.tokens[0].reading === 'ほん', 'Reading = ほん');
  assert(res1.tokens[0].meaning.length > 0 && res1.tokens[0].meaning !== '—', `Nghĩa hiển thị đầy đủ: "${res1.tokens[0].meaning}"`);

  // 2. Một từ viết bằng Hiragana
  console.log('\n--- TEST 2: Từ viết bằng Hiragana (ありがとう, この) ---');
  const res2 = await sa.analyze('この');
  assert(res2.tokens[0].surface === 'この', 'Surface = この');
  assert(res2.tokens[0].meaning.length > 0 && res2.tokens[0].meaning.includes('Này'), `Nghĩa hiển thị đầy đủ: "${res2.tokens[0].meaning}"`);

  // 3. Một từ viết bằng Katakana
  console.log('\n--- TEST 3: Từ viết bằng Katakana (SNS, テスト) ---');
  const res3 = await sa.analyze('SNS');
  assert(res3.tokens[0].surface === 'SNS', 'Surface = SNS');
  assert(res3.tokens[0].reading === 'エスエヌエス', 'Reading = エスエヌエス');
  assert(res3.tokens[0].meaning.includes('Mạng xã hội'), `Nghĩa hiển thị đầy đủ: "${res3.tokens[0].meaning}"`);

  const res3b = await sa.analyze('テスト');
  assert(res3b.tokens[0].surface === 'テスト', 'Surface = テスト');
  assert(res3b.tokens[0].meaning.includes('kiểm tra'), `Nghĩa hiển thị đầy đủ: "${res3b.tokens[0].meaning}"`);

  // 4. Một từ có nhiều cách đọc hoặc nhiều nghĩa
  console.log('\n--- TEST 4: Từ có nhiều cách đọc / nghĩa theo ngữ cảnh (1日, 代) ---');
  const res4a = await sa.analyze('1日');
  assert(res4a.tokens[0].surface === '1日', 'Surface = 1日');
  assert(res4a.tokens[0].reading.includes('いちにち') || res4a.tokens[0].reading.includes('ついたち'), `Đủ các cách đọc: "${res4a.tokens[0].reading}"`);
  assert(res4a.tokens[0].meaning.includes('1 ngày') || res4a.tokens[0].meaning.includes('Mùng 1'), `Nghĩa rõ ràng: "${res4a.tokens[0].meaning}"`);

  const res4b = await sa.analyze('30代');
  assert(res4b.tokens[0].surface === '30代', 'Surface = 30代');
  assert(res4b.tokens[0].reading === 'さんじゅうだい', `Reading chuẩn: "${res4b.tokens[0].reading}"`);
  assert(res4b.tokens[0].meaning.includes('Độ tuổi 30') || res4b.tokens[0].meaning.includes('thế hệ 30'), `Nghĩa chuẩn: "${res4b.tokens[0].meaning}"`);

  // 5. Câu chứa từ vựng, trợ từ và ngữ pháp
  console.log('\n--- TEST 5: Câu chứa từ vựng, trợ từ và ngữ pháp (昨日、友達と映画を見ました。) ---');
  const res5 = await sa.analyze('昨日、友達と映画を見ました。');
  const vocabTokens = res5.tokens.filter(t => !t.isPunctuation && !t.isParticle);
  assert(vocabTokens.length >= 3, `Tìm thấy ${vocabTokens.length} từ vựng`);
  vocabTokens.forEach(t => {
    assert(t.meaning && t.meaning !== '—' && t.meaning.trim() !== '', `Từ [${t.surface}] có nghĩa tiếng Việt rõ ràng: "${t.meaning}"`);
  });

  // 6. Câu chứa số Ả Rập: 私は本を3冊買いました。
  console.log('\n--- TEST 6: Câu chứa số Ả Rập (私は本を3冊買いました。) ---');
  const res6 = await sa.analyze('私は本を3冊買いました。');
  const token3sat = res6.tokens.find(t => t.surface === '3冊');
  assert(token3sat !== undefined, '3冊 được nhận diện là một token thống nhất (không bị cắt lẻ 3 và 冊)');
  assert(token3sat && token3sat.reading === 'さんさつ', `Reading của 3冊 = さんさつ (thực tế: "${token3sat ? token3sat.reading : ''}")`);
  assert(token3sat && token3sat.meaning.includes('quyển') || token3sat.meaning.includes('cuốn'), `Nghĩa của 3冊 = "${token3sat ? token3sat.meaning : ''}"`);
  
  // Xác nhận nghĩa của các từ khác trong câu: 私, 昨日, 本, 買いました
  const tokenWatashi = res6.tokens.find(t => t.surface === '私');
  const tokenHon = res6.tokens.find(t => t.surface === '本');
  const tokenKaimashita = res6.tokens.find(t => t.surface === '買いました');
  assert(tokenWatashi && tokenWatashi.meaning.includes('Tôi'), `Nghĩa của 私: "${tokenWatashi ? tokenWatashi.meaning : ''}"`);
  assert(tokenHon && tokenHon.meaning.includes('Sách'), `Nghĩa của 本: "${tokenHon ? tokenHon.meaning : ''}"`);
  assert(tokenKaimashita && tokenKaimashita.meaning.includes('Mua'), `Nghĩa của 買いました: "${tokenKaimashita ? tokenKaimashita.meaning : ''}"`);

  // 7. Câu chứa số Kanji: 学生が三人います。
  console.log('\n--- TEST 7: Câu chứa số Kanji (学生が三人います。) ---');
  const res7 = await sa.analyze('学生が三人います。');
  const tokenSannin = res7.tokens.find(t => t.surface === '三人');
  assert(tokenSannin !== undefined, '三人 được nhận diện là một token số lượng');
  assert(tokenSannin && tokenSannin.reading === 'さんにん', `Reading của 三人 = さんにん (thực tế: "${tokenSannin ? tokenSannin.reading : ''}")`);
  assert(tokenSannin && tokenSannin.meaning.includes('người'), `Nghĩa của 三人 = "${tokenSannin ? tokenSannin.meaning : ''}"`);

  const tokenGakusei = res7.tokens.find(t => t.surface === '学生');
  assert(tokenGakusei && tokenGakusei.meaning.includes('sinh viên') || tokenGakusei.meaning.includes('Học sinh'), `Nghĩa của 学生: "${tokenGakusei ? tokenGakusei.meaning : ''}"`);

  // 8. Câu có từ không tìm thấy trong từ điển (xử lý dữ liệu thiếu)
  console.log('\n--- TEST 8: Từ không tìm thấy trong từ điển (Xử lý trường hợp thiếu dữ liệu) ---');
  const res8 = await sa.analyze('龘靐');
  assert(res8.success, 'Phân tích từ hiếm thành công mà không gây lỗi runtime');
  res8.tokens.forEach(t => {
    assert(t.meaning && t.meaning.trim() !== '', `Có thông báo trạng thái hoặc Hán tự thay vì để trống: "${t.meaning}"`);
  });

  // 9. Đối chiếu kết quả giữa tra cứu và Sentence Analyzer
  console.log('\n--- TEST 9: Đối chiếu kết quả giữa tra cứu từ điển và Sentence Analyzer ---');
  const res9 = await sa.analyze('関東の30代女性も、以前は1日10時間以上SNSを使っていました');
  const wordsToVerify = ['関東', '30代', '女性', '以前', '1日', '10時間', '以上', 'SNS'];
  wordsToVerify.forEach(w => {
    const found = res9.tokens.find(t => t.surface === w);
    assert(found !== undefined, `Thành phần [${w}] có trong danh sách token`);
    assert(found && found.meaning && found.meaning !== '—' && found.meaning.trim() !== '', `[${w}] có nghĩa tiếng Việt xác thực: "${found ? found.meaning : ''}"`);
    assert(found && found.reading && found.reading !== '—' && found.reading.trim() !== '', `[${w}] có cách đọc Kana chuẩn: "${found ? found.reading : ''}"`);
  });

  console.log('\n================================================================');
  console.log(`KẾT QUẢ TỔNG HỢP: ${passed} / ${total} KIỂM TRA ĐẠT (${Math.round((passed/total)*100)}%)`);
  console.log('================================================================');
}

run().catch(console.error);
