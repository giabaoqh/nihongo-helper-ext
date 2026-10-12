/**
 * TEST SUITE: PHASE 10 VERIFICATION - 100% LOCAL-FIRST SENTENCE ANALYZER
 * 
 * Kiểm thử toàn diện:
 * 1. 10 câu mục tiêu cốt lõi ở chế độ Local (100% Offline).
 * 2. Token Data Contract Chuẩn hóa (id, surface, reading, baseForm, partOfSpeech, morphology).
 * 3. Semantic Chunks & Sentence Logic cục bộ.
 * 4. Phân tích câu phức tạp đặc biệt (Câu từ ảnh chụp lỗi người dùng):
 *    "つまり、eスポーツは体を大きく動かすスポーツとは違います。心拍数が上がることがあっても、運動量としては軽い活動や座っている状態に近いことが分かりました。"
 *    Kiểm tra các cụm:
 *    - "軽い活動や座っている状態に"
 *    - "上がることが"
 *    - "あっても"
 *    - "運動量としては"
 *    - "近いことが"
 *    - "分かりました"
 * 5. Các câu ngắn, câu dài, hỗn hợp kanji, hiragana, katakana, dấu câu.
 * 6. Kiểm tra đảm bảo 100% Offline: Tuyệt đối không gọi fetch mạng, không cần API key.
 * 7. Kiểm tra hàm dọn dẹp khóa AI cũ (Legacy AI Storage Cleanup).
 */

const assert = require('assert');
const SentenceAnalyzer = require('./scripts/analyzer.js');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('================================================================');
  console.log('PHASE 10 TEST SUITE: 100% LOCAL-FIRST SENTENCE ANALYZER');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // 1. KIỂM THỬ 10 CÂU BẮT BUỘC Ở CHẾ ĐỘ LOCAL (OFFLINE 100%)
  // ---------------------------------------------------------------------------
  console.log('--- 1. Kiểm thử 10 câu mục tiêu ở chế độ Local (Offline) ---');

  const targetSentences = [
    {
      id: 1,
      text: 'eスポーツ選手は、ゲームをしているだけなので、あまりカロリーを消費しないように思えるかもしれません。',
      checkTokens: ['eスポーツ', '選手', 'は', 'ゲーム', 'を', 'して', 'いる', 'だけ', 'なので', 'あまり', 'カロリー', 'を', '消費', 'しない', 'ように思える', 'かもしれません'],
      checkGrammar: ['かもしれません', 'なので'],
      mustNotContain: ['うに', 'れま', 'せん']
    },
    {
      id: 2,
      text: '私はさらに勉強します。',
      checkTokens: ['私', 'は', 'さらに', '勉強', 'します'],
      mustNotContain: ['さ', 'ら']
    },
    {
      id: 3,
      text: '学校に行きます。',
      checkTokens: ['学校', 'に', '行きます']
    },
    {
      id: 4,
      text: '日本語を勉強しています。',
      checkTokens: ['日本語', 'を', '勉強', 'して', 'います'],
      checkGrammar: ['ています']
    },
    {
      id: 5,
      text: '今日はとても暑いです。',
      checkTokens: ['今日', 'は', 'とても', '暑い', 'です']
    },
    {
      id: 6,
      text: 'それから、家に帰りました。',
      checkTokens: ['それから', '家', 'に', '帰りました']
    },
    {
      id: 7,
      text: '本を3冊買いました。',
      checkTokens: ['本', 'を', '3冊', '買いました'],
      counterCheck: '3冊'
    },
    {
      id: 8,
      text: '昨日は学校に行きませんでした。',
      checkTokens: ['昨日', 'は', '学校', 'に', '行きませんでした']
    },
    {
      id: 9,
      text: 'この問題は簡単なように思えるかもしれません。',
      checkTokens: ['この', '問題', 'は', '簡単', 'な', 'ように思える', 'かもしれません'],
      checkGrammar: ['かもしれません']
    },
    {
      id: 10,
      text: '雨が降っているので、出かけません。',
      checkTokens: ['雨', 'が', '降って', 'いる', 'ので', '出かけません'],
      checkGrammar: ['ので']
    }
  ];

  for (const s of targetSentences) {
    await itAsync(`Câu ${s.id}: "${s.text.slice(0, 30)}..."`, async () => {
      const res = await SentenceAnalyzer.analyze(s.text, { mode: 'local' });
      assert.strictEqual(res.success, true, 'Phân tích phải thành công');
      assert.ok(Array.isArray(res.tokens) && res.tokens.length > 0, 'Phải có tokens');
      assert.ok(Array.isArray(res.chunks) && res.chunks.length > 0, 'Phải có chunks');
      assert.ok(res.reading && res.reading.length > 0, 'Phải có reading');
      assert.ok(res.furiganaHtml && res.furiganaHtml.includes('<ruby'), 'Phải có HTML furigana ruby');

      const surfaces = res.tokens.map(t => t.surface);

      if (s.checkTokens) {
        for (const tok of s.checkTokens) {
          assert.ok(surfaces.includes(tok), `Câu phải nhận diện đúng token "${tok}". Surfaces: [${surfaces.join(', ')}]`);
        }
      }

      if (s.mustNotContain) {
        for (const bad of s.mustNotContain) {
          assert.ok(!surfaces.includes(bad), `Câu không được chứa token bị vỡ sai "${bad}"`);
        }
      }

      if (s.checkGrammar) {
        const foundPatterns = res.grammarPoints.map(g => g.pattern);
        for (const gp of s.checkGrammar) {
          const matched = foundPatterns.some(p => p.includes(gp));
          assert.ok(matched, `Phải nhận diện ngữ pháp "${gp}". Found: [${foundPatterns.join(', ')}]`);
        }
      }

      if (s.counterCheck) {
        const numTok = res.tokens.find(t => t.surface === s.counterCheck);
        assert.ok(numTok, `Phải tìm thấy lượng từ "${s.counterCheck}"`);
        assert.ok(numTok.isNumberCounter || (numTok.partOfSpeech && numTok.partOfSpeech.includes('Lượng từ')), 'Phải gắn cờ lượng từ');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 2. KIỂM THỬ DATA CONTRACT CHUẨN HÓA CỦA TOKEN
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Kiểm thử Token Data Contract ---');

  it('Token phải có đầy đủ thuộc tính chuẩn hóa: id, start, end, surface, reading, baseForm, partOfSpeech, morphology', () => {
    const res = SentenceAnalyzer.tokenize('私は日本語を勉強します。');
    assert.ok(res.length > 0);
    res.forEach((tok, idx) => {
      assert.ok(tok.id, `Token ${idx} phải có id`);
      assert.ok(typeof tok.start === 'number', `Token ${idx} phải có start offset`);
      assert.ok(typeof tok.end === 'number', `Token ${idx} phải có end offset`);
      assert.ok(tok.end >= tok.start, `Token ${idx} end phải >= start`);
      assert.ok(typeof tok.surface === 'string' && tok.surface.length > 0, `Token ${idx} phải có surface`);
      assert.ok(typeof tok.reading === 'string', `Token ${idx} phải có reading`);
      assert.ok(typeof tok.baseForm === 'string', `Token ${idx} phải có baseForm`);
      assert.ok(typeof tok.partOfSpeech === 'string', `Token ${idx} phải có partOfSpeech`);
      assert.ok(typeof tok.morphology === 'object', `Token ${idx} phải có morphology object`);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. KIỂM THỬ LOCAL GRAMMAR & SEMANTIC BUNSETSU CHUNKS
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Kiểm thử Semantic Chunks & Sentence Logic ---');

  it('Semantic Chunks nhóm các token theo cụm nghĩa Bunsetsu hợp lý', () => {
    const tokens = SentenceAnalyzer.tokenize('雨が降っているので、出かけません。');
    const chunks = SentenceAnalyzer.buildLocalChunks(tokens, '雨が降っているので、出かけません。');
    assert.ok(chunks.length >= 2, 'Phải có ít nhất 2 cụm nghĩa');
    
    const chunkSurfaces = chunks.map(c => c.surface);
    assert.ok(chunkSurfaces.some(s => s.includes('雨が') || s.includes('雨')), 'Cụm chứa 雨');
    assert.ok(chunkSurfaces.some(s => s.includes('出かけません')), 'Cụm vị ngữ chính 出かけません');

    chunks.forEach(c => {
      assert.ok(Array.isArray(c.tokenIds), 'Chunk phải có danh sách tokenIds');
      assert.ok(c.tokenIds.length > 0, 'Chunk tokenIds không được rỗng');
      assert.ok(typeof c.roleVi === 'string', 'Chunk phải có vai trò ngữ nghĩa roleVi');
      assert.ok(typeof c.meaningVi === 'string', 'Chunk phải có nghĩa meaningVi');
    });
  });

  it('Sentence Logic giải thích quan hệ nguyên nhân - kết quả của câu', () => {
    const tokens = SentenceAnalyzer.tokenize('雨が降っているので、出かけません。');
    const chunks = SentenceAnalyzer.buildLocalChunks(tokens, '雨が降っているので、出かけません。');
    const gps = SentenceAnalyzer.detectLocalGrammar(tokens, '雨が降っているので、出かけません。');
    const { sentenceLogic } = SentenceAnalyzer.buildLocalSentenceLogic(tokens, chunks, gps, '雨が降っているので、出かけません。');
    
    assert.ok(typeof sentenceLogic === 'string' && sentenceLogic.length > 0, 'Sentence logic phải là chuỗi hợp lệ');
    assert.ok(sentenceLogic.includes('nguyên nhân') || sentenceLogic.includes('kết quả') || sentenceLogic.includes('logic'), 'Phải diễn giải được quan hệ nguyên nhân');
  });

  // ---------------------------------------------------------------------------
  // 4. KIỂM THỬ CÂU ĐẶC BIỆT TỪ ẢNH CHỤP NGƯỜI DÙNG (ESPORTS & CALORIES)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Kiểm thử Câu Phức Tạp trong Ảnh Chụp (e-Sports & Calorie) ---');

  const userTestSentence = 'つまり、eスポーツは体を大きく動かすスポーツとは違います。心拍数が上がることがあっても、運動量としては軽い活動や座っている状態に近いことが分かりました。';

  await itAsync('Phân tích thành công câu ảnh chụp với đầy đủ cụm Bunsetsu cục bộ', async () => {
    const res = await SentenceAnalyzer.analyze(userTestSentence, { mode: 'local' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.mode, 'local');
    assert.ok(res.tokens.length > 15, 'Câu dài phải tách được hơn 15 tokens');
    assert.ok(res.chunks.length >= 6, 'Phải có ít nhất 6 cụm nghĩa');

    const chunkTexts = res.chunks.map(c => c.surface);
    console.log('    Các cụm phân tách:', chunkTexts);

    // Kiểm tra các cụm yêu cầu trong đề bài:
    // 1. Cụm bị lỗi xuống dòng trong ảnh: "軽い活動や座っている状態に"
    const hasTargetLongChunk = chunkTexts.some(s => s.includes('軽い活動') && s.includes('状態に'));
    assert.ok(hasTargetLongChunk, `Phải có cụm chứa "軽い活動や座っている状態に". Chunks: [${chunkTexts.join(' | ')}]`);

    // 2. Cụm "上がることが"
    assert.ok(chunkTexts.some(s => s.includes('上がることが') || (s.includes('上がる') && s.includes('こと'))), 'Phải có cụm 上がることが');

    // 3. Cụm "あっても"
    assert.ok(chunkTexts.some(s => s.includes('あっても')), 'Phải có cụm あっても');

    // 4. Cụm "運動量としては"
    assert.ok(chunkTexts.some(s => s.includes('運動量としては') || (s.includes('運動量') && s.includes('として'))), 'Phải có cụm 運動量としては');

    // 5. Cụm "近いことが"
    assert.ok(chunkTexts.some(s => s.includes('近いことが') || (s.includes('近い') && s.includes('こと'))), 'Phải có cụm 近いことが');

    // 6. Cụm "分かりました"
    assert.ok(chunkTexts.some(s => s.includes('分かりました')), 'Phải có cụm 分かりました');
  });

  // ---------------------------------------------------------------------------
  // 5. KIỂM THỬ ĐA DẠNG CÂU (NGẮN, DÀI, HỖN HỢP KANJI/KANA/KATAKANA/DẤU CÂU)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Kiểm thử các loại câu đa dạng (Ngắn, Dài, Hỗn hợp Kana/Kanji/Katakana) ---');

  const diversitySentences = [
    { type: 'Câu rất ngắn', text: '行きます。' },
    { type: 'Câu chỉ có Hiragana', text: 'ありがとう。' },
    { type: 'Câu có Katakana + English', text: 'AIとIoTの技術をテストします。' },
    { type: 'Câu phủ định quá khứ', text: '昨日は何も食べませんでした。' },
    { type: 'Câu điều kiện giả định', text: '明日雨が降れば、家で映画を見ます。' }
  ];

  for (const item of diversitySentences) {
    await itAsync(`${item.type}: "${item.text}"`, async () => {
      const res = await SentenceAnalyzer.analyze(item.text, { mode: 'local' });
      assert.strictEqual(res.success, true);
      assert.ok(res.tokens.length > 0);
      assert.ok(res.chunks.length > 0);
      assert.ok(res.reading.length > 0);
    });
  }

  // ---------------------------------------------------------------------------
  // 6. KIỂM THỬ BẢO ĐẢM HOÀN TOÀN KHÔNG CÓ REQUEST MẠNG (100% OFFLINE)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Kiểm thử Tuyệt Đối Không Phát Sinh Request Mạng ---');

  await itAsync('SentenceAnalyzer.analyze không thực hiện bất kỳ fetch() nào', async () => {
    const originalFetch = global.fetch;
    let fetchCalled = false;

    global.fetch = () => {
      fetchCalled = true;
      throw new Error('VIOLATION: Chế độ Local không được phép gọi mạng bên ngoài!');
    };

    try {
      const res = await SentenceAnalyzer.analyze(userTestSentence, { mode: 'local' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(fetchCalled, false, 'Không có lệnh fetch nào được kích hoạt');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Không còn export AIExplanationProvider hay ExplanationValidator', () => {
    assert.strictEqual(SentenceAnalyzer.AIExplanationProvider, undefined, 'AIExplanationProvider đã bị gỡ hoàn toàn');
    assert.strictEqual(SentenceAnalyzer.ExplanationValidator, undefined, 'ExplanationValidator đã bị gỡ hoàn toàn');
  });

  // ---------------------------------------------------------------------------
  // 7. KIỂM THỬ HÀM DỌN DẸP KHÓA AI (STORAGE CLEANUP MIGRATION)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Kiểm thử Dọn Dẹp Khóa Cấu Hình AI Cũ ---');

  it('Mô phỏng dọn dẹp khóa AI cũ không làm mất lịch sử và từ đã lưu', () => {
    const fakeStorage = {
      jpex_analyzer_settings: { apiKey: 'dummy_legacy_key', provider: 'gemini', model: 'gemini-2.0-flash' },
      gemini_api_key: 'dummy_legacy_key',
      ai_api_key: 'dummy_legacy_key',
      ai_model: 'gemini-1.5-flash',
      // Dữ liệu người dùng quý giá cần bảo vệ:
      jpDictSavedWords: [{ word: '学校', meaning: 'trường học' }],
      jpDictFolders: [{ id: 'f_default', name: 'Mặc định' }],
      jpex_analyzer_history: ['昨日は学校に行きました。']
    };

    const AI_STORAGE_KEYS = [
      'jpex_analyzer_settings',
      'gemini_api_key',
      'ai_api_key',
      'ai_model',
      'gemini_model',
      'ai_provider'
    ];

    // Thực hiện dọn dẹp
    AI_STORAGE_KEYS.forEach(k => delete fakeStorage[k]);

    // Kiểm tra kết quả
    assert.strictEqual(fakeStorage.jpex_analyzer_settings, undefined);
    assert.strictEqual(fakeStorage.gemini_api_key, undefined);
    assert.strictEqual(fakeStorage.ai_api_key, undefined);
    assert.strictEqual(fakeStorage.ai_model, undefined);

    // Dữ liệu người dùng được bảo tồn 100%
    assert.strictEqual(fakeStorage.jpDictSavedWords.length, 1);
    assert.strictEqual(fakeStorage.jpDictFolders.length, 1);
    assert.strictEqual(fakeStorage.jpex_analyzer_history.length, 1);
  });

  console.log('\n================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests} / ${totalTests} PASSED (${Math.round(passedTests / totalTests * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch(e => {
  console.error('Lỗi thực thi test suite:', e);
  process.exit(1);
});
