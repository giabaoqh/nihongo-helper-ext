/**
 * Comprehensive Automated Test Suite for Japanese Sentence Analyzer
 * Tests all required cases:
 * 1. Benchmark Sentence 1: 昨日、友達と映画を見ました。
 * 2. Benchmark Sentence 2: 日本語を勉強しています。
 * 3. Benchmark Sentence 3: 本を読んでから寝ました。
 * 4. Benchmark Sentence 4: 学校に行かなければなりません。
 * 5. Benchmark Sentence 5: この問題は思ったより難しかったです。
 * 6. Benchmark Sentence 6: テストを実行して、エラーを修正しました。
 * 7. Rare Kanji not in common dictionary: 龘靐
 * 8. Only punctuation and spaces: 。。。 、、、 ！？
 * 9. Overly long sentence (>500 chars)
 * 10. Empty / whitespace string
 * 11. Token order and surface reconstruction integrity (no dropped/duplicated characters)
 */

const path = require('path');
const analyzer = require(path.resolve(__dirname, 'JPEX/scripts/analyzer.js'));

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: JAPANESE SENTENCE ANALYZER');
  console.log('====================================================\n');

  await analyzer.init();

  // Test 1: Benchmark 1
  console.log('Test Suite 1: Benchmark 1 (昨日、友達と映画を見ました。)');
  const res1 = await analyzer.analyze('昨日、友達と映画を見ました。');
  assert(res1.success === true, 'Analyze returns success: true');
  assert(res1.tokens.length === 8, 'Token count matches expected (8 tokens)');
  assert(res1.tokens[0].surface === '昨日' && res1.tokens[0].reading === 'きのう', 'Token 0: 昨日 (きのう)');
  assert(res1.tokens[1].surface === '、' && res1.tokens[1].isPunctuation === true, 'Token 1: 、 (Dấu câu)');
  assert(res1.tokens[2].surface === '友達' && res1.tokens[2].reading === 'ともだち', 'Token 2: 友達 (ともだち)');
  assert(res1.tokens[3].surface === 'と' && res1.tokens[3].isParticle === true, 'Token 3: と (Trợ từ)');
  assert(res1.tokens[4].surface === '映画' && res1.tokens[4].reading === 'えいが', 'Token 4: 映画 (えいが)');
  assert(res1.tokens[5].surface === 'を' && res1.tokens[5].isParticle === true, 'Token 5: を (Trợ từ)');
  assert(res1.tokens[6].surface === '見ました' && res1.tokens[6].baseForm === '見る' && res1.tokens[6].reading === 'みました', 'Token 6: 見ました (base: 見る, reading: みました)');
  assert(res1.tokens[7].surface === '。' && res1.tokens[7].isPunctuation === true, 'Token 7: 。 (Dấu câu)');
  assert(res1.tokens.map(t => t.surface).join('') === '昨日、友達と映画を見ました。', 'Reconstructed text matches exactly');

  // Test 2: Benchmark 2
  console.log('\nTest Suite 2: Benchmark 2 (日本語を勉強しています。)');
  const res2 = await analyzer.analyze('日本語を勉強しています。');
  assert(res2.success === true, 'Analyze returns success: true');
  assert(res2.tokens[0].surface === '日本語' && res2.tokens[0].reading === 'にほんご', 'Token 0: 日本語 (にほんご)');
  assert(res2.tokens[1].surface === 'を', 'Token 1: を');
  assert(res2.tokens[2].surface === '勉強' && res2.tokens[2].reading === 'べんきょう', 'Token 2: 勉強 (べんきょう)');
  assert(res2.tokens[3].surface === 'して' && res2.tokens[3].baseForm === 'する', 'Token 3: して (base: する)');
  assert(res2.tokens[4].surface === 'います' && res2.tokens[4].baseForm === 'いる', 'Token 4: います (base: いる)');
  assert(res2.tokens[5].surface === '。', 'Token 5: 。');
  assert(res2.tokens.map(t => t.surface).join('') === '日本語を勉強しています。', 'Reconstructed text matches exactly');

  // Test 3: Benchmark 3
  console.log('\nTest Suite 3: Benchmark 3 (本を読んでから寝ました。)');
  const res3 = await analyzer.analyze('本を読んでから寝ました。');
  assert(res3.success === true, 'Analyze returns success: true');
  assert(res3.tokens[0].surface === '本' && res3.tokens[0].reading === 'ほん', 'Token 0: 本 (ほん)');
  assert(res3.tokens[1].surface === 'を', 'Token 1: を');
  assert(res3.tokens[2].surface === '読んで' && res3.tokens[2].baseForm === '読む' && res3.tokens[2].reading === 'よんで', 'Token 2: 読んで (base: 読む, reading: よんで)');
  assert(res3.tokens[3].surface === 'から', 'Token 3: から');
  assert(res3.tokens[4].surface === '寝ました' && res3.tokens[4].baseForm === '寝る' && res3.tokens[4].reading === 'ねました', 'Token 4: 寝ました (base: 寝る, reading: ねました)');
  assert(res3.tokens[5].surface === '。', 'Token 5: 。');
  assert(res3.tokens.map(t => t.surface).join('') === '本を読んでから寝ました。', 'Reconstructed text matches exactly');

  // Test 4: Benchmark 4
  console.log('\nTest Suite 4: Benchmark 4 (学校に行かなければなりません。)');
  const res4 = await analyzer.analyze('学校に行かなければなりません。');
  assert(res4.success === true, 'Analyze returns success: true');
  assert(res4.tokens[0].surface === '学校' && res4.tokens[0].reading === 'がっこう', 'Token 0: 学校 (がっこう)');
  assert(res4.tokens[1].surface === 'に', 'Token 1: に');
  assert(res4.tokens[2].surface === '行かなければ' && res4.tokens[2].baseForm === '行く' && res4.tokens[2].reading === 'いかなければ', 'Token 2: 行かなければ (base: 行く, reading: いかなければ)');
  assert(res4.tokens[3].surface === 'なりません' && res4.tokens[3].baseForm === 'なる', 'Token 3: なりません (base: なる)');
  assert(res4.tokens[4].surface === '。', 'Token 4: 。');
  assert(res4.tokens.map(t => t.surface).join('') === '学校に行かなければなりません。', 'Reconstructed text matches exactly');

  // Test 5: Benchmark 5
  console.log('\nTest Suite 5: Benchmark 5 (この問題は思ったより難しかったです。)');
  const res5 = await analyzer.analyze('この問題は思ったより難しかったです。');
  assert(res5.success === true, 'Analyze returns success: true');
  assert(res5.tokens[0].surface === 'この' && res5.tokens[0].isDemonstrative === true, 'Token 0: この (Chỉ thị từ)');
  assert(res5.tokens[1].surface === '問題' && res5.tokens[1].reading === 'もんだい', 'Token 1: 問題 (もんだい)');
  assert(res5.tokens[2].surface === 'は' && res5.tokens[2].reading === 'わ', 'Token 2: は (reading: わ)');
  assert(res5.tokens[3].surface === '思った' && res5.tokens[3].baseForm === '思う' && res5.tokens[3].reading === 'おもった', 'Token 3: 思った (base: 思う, reading: おもった)');
  assert(res5.tokens[4].surface === 'より' && res5.tokens[4].isParticle === true, 'Token 4: より (Trợ từ)');
  assert(res5.tokens[5].surface === '難しかった' && res5.tokens[5].baseForm === '難しい' && res5.tokens[5].reading === 'むずかしかった', 'Token 5: 難しかった (base: 難しい, reading: むずかしかった)');
  assert(res5.tokens[6].surface === 'です', 'Token 6: です');
  assert(res5.tokens[7].surface === '。', 'Token 7: 。');
  assert(res5.tokens.map(t => t.surface).join('') === 'この問題は思ったより難しかったです。', 'Reconstructed text matches exactly');

  // Test 6: Benchmark 6
  console.log('\nTest Suite 6: Benchmark 6 (テストを実行して、エラーを修正しました。)');
  const res6 = await analyzer.analyze('テストを実行して、エラーを修正しました。');
  assert(res6.success === true, 'Analyze returns success: true');
  assert(res6.tokens[0].surface === 'テスト' && res6.tokens[0].isKatakana === true, 'Token 0: テスト (Katakana)');
  assert(res6.tokens[1].surface === 'を', 'Token 1: を');
  assert(res6.tokens[2].surface === '実行' && res6.tokens[2].reading === 'じっこう', 'Token 2: 実行 (じっこう)');
  assert(res6.tokens[3].surface === 'して' && res6.tokens[3].baseForm === 'する', 'Token 3: して (base: する)');
  assert(res6.tokens[4].surface === '、', 'Token 4: 、');
  assert(res6.tokens[5].surface === 'エラー' && res6.tokens[5].isKatakana === true, 'Token 5: エラー (Katakana)');
  assert(res6.tokens[6].surface === 'を', 'Token 6: を');
  assert(res6.tokens[7].surface === '修正' && res6.tokens[7].reading === 'しゅうせい', 'Token 7: 修正 (しゅうせい)');
  assert(res6.tokens[8].surface === 'しました' && res6.tokens[8].baseForm === 'する', 'Token 8: しました (base: する)');
  assert(res6.tokens[9].surface === '。', 'Token 9: 。');
  assert(res6.tokens.map(t => t.surface).join('') === 'テストを実行して、エラーを修正しました。', 'Reconstructed text matches exactly');

  // Test 7: Rare Kanji
  console.log('\nTest Suite 7: Rare / Unknown Kanji (龘靐)');
  const res7 = await analyzer.analyze('龘靐');
  assert(res7.success === true, 'Handles rare Kanji gracefully');
  assert(res7.tokens.length === 2, 'Parsed 2 Kanji characters without crashing');
  assert(res7.tokens.map(t => t.surface).join('') === '龘靐', 'Reconstructed text matches rare characters');

  // Test 8: Punctuation and spaces only
  console.log('\nTest Suite 8: Only Punctuation and Spaces (。。。 、、、 ！？)');
  const res8 = await analyzer.analyze('。。。 、、、 ！？');
  assert(res8.success === true, 'Handles punctuation only input');
  assert(res8.tokens.every(t => t.isPunctuation), 'All tokens classified as punctuation');
  assert(res8.tokens.map(t => t.surface).join('') === '。。。 、、、 ！？', 'All punctuation preserved in exact order');

  // Test 9: Overly long sentence (>500 chars)
  console.log('\nTest Suite 9: Overly long sentence boundary test');
  const longSentence = 'あ'.repeat(501);
  const res9 = await analyzer.analyze(longSentence);
  assert(res9.success === false && res9.error.includes('500'), 'Properly rejects sentences exceeding 500 characters');

  // Test 10: Empty or whitespace input
  console.log('\nTest Suite 10: Empty input test');
  const res10 = await analyzer.analyze('   ');
  assert(res10.success === false, 'Rejects empty input gracefully');

  // Test 11: Furigana generation check
  console.log('\nTest Suite 11: Furigana Ruby tag check');
  const rubyTest = await analyzer.analyze('日本語');
  assert(rubyTest.furiganaHtml.includes('<ruby class="ruby-token">日本語<rt>にほんご</rt></ruby>'), 'Generates valid HTML ruby tags');

  console.log('\n====================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} / ${totalTests} KIỂM TRA ĐẠT (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
