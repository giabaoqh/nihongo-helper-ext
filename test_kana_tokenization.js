const path = require('path');
const analyzer = require(path.resolve(__dirname, 'JPEX/scripts/analyzer.js'));

async function run() {
  await analyzer.init();
  const testCases = [
    'さらに',
    'さようなら',
    'ごめんなさい',
    '私はさらに勉強します。',
    '学校に行きます。',
    '日本語を勉強しています。',
    '今日はとても暑いです。',
    'それから、家に帰りました。',
    '本を3冊買いました。'
  ];

  for (const s of testCases) {
    console.log('\n========================================');
    console.log('INPUT:', s);
    const res = await analyzer.analyze(s);
    res.tokens.forEach((t, idx) => {
      console.log(`  [#${idx + 1}] surface: "${t.surface}", reading: "${t.reading}", base: "${t.baseForm}", pos: "${t.partOfSpeech}", role: "${t.grammarRole}", meaning: "${t.meaning}"`);
    });
  }
}

run();
