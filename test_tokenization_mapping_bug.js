/**
 * Unit Test Suite: Japanese Tokenization and Dictionary Mapping Integrity
 * Specifically tests:
 * 1.さらに
 * 2.さようなら
 * 3.ごめんなさい
 * 4.私はさらに勉強します。
 * 5.学校に行きます。
 * 6.日本語を勉強しています。
 * 7.今日はとても暑いです。
 * 8.それから、家に帰りました。
 * 9.本を3冊買いました。
 * 10. Prevention of cross-token contamination (single kana never inherits unrelated words)
 * 11. Preservation of unrecognized kana sequences without single-character shattering
 */

const path = require('path');
const analyzer = require(path.resolve(__dirname, 'JPEX/scripts/analyzer.js'));

let total = 0;
let passed = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: JAPANESE TOKENIZATION & DICTIONARY MAPPING BUG FIX');
  console.log('========================================================================\n');

  await analyzer.init();

  // Test 1: さらに
  console.log('--- TEST CASE 1: さらに ---');
  const res1 = await analyzer.analyze('さらに');
  assert(res1.tokens.length === 1, 'さらに is preserved as exactly 1 token (not split into さ, ら, に)');
  assert(res1.tokens[0].surface === 'さらに', 'Surface is "さらに"');
  assert(res1.tokens[0].reading === 'さらに', 'Reading is "さらに" (not ごめんなさい or other words)');
  assert(res1.tokens[0].meaning.includes('Hơn nữa') || res1.tokens[0].meaning.includes('thêm nữa'), 'Meaning contains "Hơn nữa, thêm nữa"');
  assert(res1.tokens[0].partOfSpeech === 'Phó từ', 'Part of speech is "Phó từ"');

  // Test 2: さようなら
  console.log('\n--- TEST CASE 2: さようなら ---');
  const res2 = await analyzer.analyze('さようなら');
  assert(res2.tokens.length === 1, 'さようなら is preserved as 1 complete token');
  assert(res2.tokens[0].surface === 'さようなら', 'Surface is "さようなら"');
  assert(res2.tokens[0].reading === 'さようなら', 'Reading is "さようなら"');
  assert(res2.tokens[0].meaning.includes('Tạm biệt'), 'Meaning is "Tạm biệt"');

  // Test 3: ごめんなさい
  console.log('\n--- TEST CASE 3: ごめんなさい ---');
  const res3 = await analyzer.analyze('ごめんなさい');
  assert(res3.tokens.length === 1, 'ごめんなさい is preserved as 1 complete token');
  assert(res3.tokens[0].surface === 'ごめんなさい', 'Surface is "ごめんなさい"');
  assert(res3.tokens[0].reading === 'ごめんなさい', 'Reading is "ごめんなさい"');
  assert(res3.tokens[0].meaning.includes('Xin thứ lỗi') || res3.tokens[0].meaning.includes('xin lỗi'), 'Meaning is "Xin thứ lỗi, xin lỗi"');

  // Test 4: 私はさらに勉強します。
  console.log('\n--- TEST CASE 4: 私はさらに勉強します。 ---');
  const res4 = await analyzer.analyze('私はさらに勉強します。');
  const surfaces4 = res4.tokens.map(t => t.surface);
  assert(surfaces4.join('') === '私はさらに勉強します。', 'Reconstructed text is intact');
  assert(surfaces4.includes('私'), 'Contains token "私"');
  assert(surfaces4.includes('は'), 'Contains token "は"');
  assert(surfaces4.includes('さらに'), 'Contains token "さらに" (not shattered into はさ or さ, ら, に)');
  assert(surfaces4.includes('勉強'), 'Contains token "勉強"');
  assert(surfaces4.includes('します'), 'Contains token "します"');
  const tokHa = res4.tokens.find(t => t.surface === 'は');
  assert(tokHa && tokHa.isParticle, '"は" is identified as particle');
  assert(tokHa && tokHa.reading === 'わ', '"は" has reading "わ"');
  const tokSarani = res4.tokens.find(t => t.surface === 'さらに');
  assert(tokSarani && tokSarani.reading === 'さらに', '"さらに" has reading "さらに"');
  assert(tokSarani && tokSarani.partOfSpeech === 'Phó từ', '"さらに" is "Phó từ"');

  // Test 5: 学校に行きます。
  console.log('\n--- TEST CASE 5: 学校に行きます。 ---');
  const res5 = await analyzer.analyze('学校に行きます。');
  const surfaces5 = res5.tokens.map(t => t.surface);
  assert(surfaces5.join('') === '学校に行きます。', 'Reconstructed text is intact');
  assert(surfaces5[0] === '学校' && res5.tokens[0].reading === 'がっこう', 'Token 1: 学校 (がっこう)');
  assert(surfaces5[1] === 'に' && res5.tokens[1].isParticle === true, 'Token 2: に is recognized as separate particle');
  assert(surfaces5[2] === '行きます' && res5.tokens[2].baseForm === '行く', 'Token 3: 行きます with base "行く"');

  // Test 6: 日本語を勉強しています。
  console.log('\n--- TEST CASE 6: 日本語を勉強しています。 ---');
  const res6 = await analyzer.analyze('日本語を勉強しています。');
  const surfaces6 = res6.tokens.map(t => t.surface);
  assert(surfaces6.join('') === '日本語を勉強しています。', 'Reconstructed text is intact');
  assert(surfaces6.includes('日本語') && res6.tokens.find(t => t.surface === '日本語').reading === 'にほんご', '日本語 (にほんご)');
  assert(surfaces6.includes('を') && res6.tokens.find(t => t.surface === 'を').isParticle === true, 'を is particle');
  assert(surfaces6.includes('勉強'), '勉強 is noun');
  assert(surfaces6.includes('して'), 'して is auxiliary verb (base: する)');
  assert(surfaces6.includes('います'), 'います is auxiliary verb (base: いる)');

  // Test 7: 今日はとても暑いです。
  console.log('\n--- TEST CASE 7: 今日はとても暑いです。 ---');
  const res7 = await analyzer.analyze('今日はとても暑いです。');
  const surfaces7 = res7.tokens.map(t => t.surface);
  assert(surfaces7.join('') === '今日はとても暑いです。', 'Reconstructed text is intact');
  assert(surfaces7[0] === '今日' && res7.tokens[0].reading === 'きょう', 'Token 1: 今日 (きょう, Noun "Hôm nay", NOT こんにちは)');
  assert(surfaces7[1] === 'は' && res7.tokens[1].isParticle === true && res7.tokens[1].reading === 'わ', 'Token 2: は is separate topic particle');
  assert(surfaces7[2] === 'とても' && res7.tokens[2].reading === 'とても', 'Token 3: とても (adverb, not broken into と, て, も)');
  assert(surfaces7[3] === '暑い' && res7.tokens[3].reading === 'あつい', 'Token 4: 暑い (adjective "あつい")');
  assert(surfaces7[4] === 'です', 'Token 5: です (copula)');

  // Test 8: それから、家に帰りました。
  console.log('\n--- TEST CASE 8: それから、家に帰りました。 ---');
  const res8 = await analyzer.analyze('それから、家に帰りました。');
  const surfaces8 = res8.tokens.map(t => t.surface);
  assert(surfaces8.join('') === 'それから、家に帰りました。', 'Reconstructed text is intact');
  assert(surfaces8[0] === 'それから', 'Token 1: それから (full conjunction word, NOT split into それ + から)');
  assert(res8.tokens[0].partOfSpeech === 'Liên từ', 'Token 1 POS is "Liên từ"');
  assert(res8.tokens[0].meaning.includes('Sau đó'), 'Token 1 meaning is "Sau đó, tiếp theo, rồi thì"');
  assert(surfaces8[1] === '、', 'Token 2: 、 (punctuation)');
  assert(surfaces8[2] === '家' && res8.tokens[2].reading === 'いえ', 'Token 3: 家 (いえ)');
  assert(surfaces8[3] === 'に' && res8.tokens[3].isParticle === true, 'Token 4: に is separate particle');
  assert(surfaces8[4] === '帰りました' && res8.tokens[4].baseForm === '帰る', 'Token 5: 帰りました (base: 帰る)');

  // Test 9: 本を3冊買いました。
  console.log('\n--- TEST CASE 9: 本を3冊買いました。 ---');
  const res9 = await analyzer.analyze('本を3冊買いました。');
  const surfaces9 = res9.tokens.map(t => t.surface);
  assert(surfaces9.join('') === '本を3冊買いました。', 'Reconstructed text is intact');
  assert(surfaces9[0] === '本' && res9.tokens[0].reading === 'ほん', 'Token 1: 本 (ほん)');
  assert(surfaces9[1] === 'を' && res9.tokens[1].isParticle === true, 'Token 2: を is separate particle');
  assert(surfaces9[2] === '3冊' && res9.tokens[2].isNumberCounter === true && res9.tokens[2].reading === 'さんさつ', 'Token 3: 3冊 (さんさつ, Number & Counter)');
  assert(surfaces9[3] === '買いました' && res9.tokens[3].baseForm === '買う', 'Token 4: 買いました (base: 買う)');

  // Test 10: Prevention of Cross-Token Contamination
  console.log('\n--- TEST CASE 10: NO CROSS-TOKEN CONTAMINATION ---');
  // Tokenize single characters that previously were cross-pollinated
  const singleTokens = analyzer.tokenize('さら');
  assert(singleTokens.every(t => t.meaning !== 'Xin lỗi' && t.meaning !== 'Tạm biệt'), 'Single kana never inherits unrelated meanings');
  assert(singleTokens.every(t => t.reading !== 'ごめんなさい' && t.reading !== 'さようなら'), 'Single kana never inherits unrelated readings');

  // Test 11: Unrecognized sequence preservation
  console.log('\n--- TEST CASE 11: UNRECOGNIZED SEQUENCE PRESERVATION ---');
  const unkRes = await analyzer.analyze('ほげほげを食べました。');
  const unkSurfaces = unkRes.tokens.map(t => t.surface);
  assert(unkSurfaces[0] === 'ほげほげ', 'Unknown kana word "ほげほげ" is preserved as 1 block instead of shattered into 4 characters');
  assert(unkSurfaces[1] === 'を', 'Following particle "を" is cleanly isolated');

  console.log('\n========================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passed} / ${total} KIỂM TRA ĐẠT (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================');
}

runTestSuite();
