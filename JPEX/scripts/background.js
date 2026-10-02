/**
 * JP Dictionary Chrome Extension - background.js
 * 
 * Service Worker chạy ngầm của extension:
 * 1. Chế độ Ưu tiên Ngoại tuyến (Offline-First): Tra cứu tức thì từ dữ liệu cục bộ.
 * 2. Đa dạng hóa kết quả: Trả về nhiều cách đọc và nhiều nghĩa (như Mazii/JDict).
 * 3. Hỗ trợ 3 nhóm dữ liệu chuẩn:
 *    - results: Danh sách các từ vựng / cách đọc (Tab Từ vựng)
 *    - kanjis: Chi tiết các chữ Hán tự kèm âm Hán Việt và nghĩa (Tab Hán tự)
 *    - translation: Bản dịch câu/đoạn văn bản (Tab Dịch)
 * 4. Tự động bóc tách âm Hán Việt ngoại tuyến kèm fallback Thi Viện thông minh.
 */

const POS_MAP = {
  'Noun': 'Danh từ',
  'Pronoun': 'Đại từ',
  'Adjective': 'Tính từ',
  'Adverb': 'Phó từ',
  'Preposition': 'Giới từ',
  'Conjunction': 'Liên từ',
  'Interjection': 'Thán từ',
  'Suru verb': 'Động từ nhóm 3 (~suru)',
  'Godan verb': 'Động từ nhóm 1 (Godan)',
  'Ichidan verb': 'Động từ nhóm 2 (Ichidan)',
  'Intransitive verb': 'Tự động từ',
  'Transitive verb': 'Tha động từ',
  'Wikipedia definition': 'Định nghĩa Wikipedia',
  'Adverbial noun': 'Danh phó từ'
};

// Bảng nghĩa tóm tắt thông dụng của các chữ Hán thường gặp
const KANJI_CORE_MEANING = {
  '歳': 'tuổi, năm tháng, mùa vụ',
  '年': 'năm, tuổi tác, thời gian',
  '日': 'ngày, mặt trời, ban ngày',
  '月': 'tháng, mặt trăng',
  '火': 'lửa, ánh lửa',
  '水': 'nước, sông suối',
  '木': 'cây cối, gỗ',
  '金': 'vàng, tiền bạc, kim loại',
  '土': 'đất đai, thổ nhưỡng',
  '人': 'người, nhân vật',
  '私': 'tôi, cá nhân, riêng tư',
  '何': 'cái gì, hà cớ',
  '学': 'học tập, trường học',
  '生': 'sinh ra, sống, học sinh',
  '先': 'trước, đi đầu, tiền bối',
  '校': 'trường học, hiệu đính',
  '会': 'gặp gỡ, tụ họp, hội đoàn',
  '社': 'công ty, xã hội, đền chùa',
  '員': 'thành viên, nhân viên',
  '行': 'đi, tiến hành, ngân hàng',
  '来': 'đến, tới, tương lai',
  '帰': 'trở về, quy cố hương',
  '食': 'ăn, thực phẩm, bữa ăn',
  '飲': 'uống, đồ uống',
  '見': 'nhìn, trông, xem xét',
  '聞': 'nghe, hỏi han, tin tức',
  '言': 'nói, lời nói, phát biểu',
  '話': 'nói chuyện, đàm thoại',
  '読': 'đọc sách, độc giả',
  '書': 'viết, sách vở, tài liệu',
  '買': 'mua sắm',
  '売': 'bán hàng, thương mại',
  '思': 'suy nghĩ, tâm tư',
  '考': 'suy xét, suy nghĩ khao khát',
  '知': 'biết, tri thức',
  '分': 'hiểu, phân chia, phút',
  '持': 'cầm, nắm, duy trì',
  '待': 'chờ đợi, đối đãi',
  '立': 'đứng, thành lập',
  '座': 'ngồi, chỗ ngồi',
  '歩': 'đi bộ, bước đi',
  '走': 'chạy, tẩu thoát',
  '車': 'xe cộ, ô tô',
  '電': 'điện lực, sấm sét',
  '語': 'ngôn ngữ, lời nói',
  '字': 'chữ viết, ký tự',
  '本': 'sách, gốc rễ, Nhật Bản',
  '友': 'bạn bè, bằng hữu',
  '時': 'thời gian, giờ giấc',
  '間': 'khoảng cách, khoảng thời gian',
  '大': 'to lớn, vĩ đại',
  '小': 'nhỏ bé, ít ỏi',
  '高': 'cao lớn, đắt đỏ',
  '安': 'rẻ, an toàn, yên tâm',
  '新': 'mới mẻ, tươi mới',
  '古': 'cũ kỹ, cổ xưa',
  '長': 'dài, trưởng thành',
  '短': 'ngắn ngủi, đoản mệnh',
  '多': 'nhiều, đa số',
  '少': 'ít, một chút, thiếu niên',
  '好': 'thích, tốt lành',
  '嫌': 'ghét, nghi kỵ',
  '強': 'mạnh mẽ, kiên cường',
  '弱': 'yếu đuối, nhu nhược',
  '重': 'nặng nề, quan trọng',
  '軽': 'nhẹ nhàng, khinh miệt',
  '広': 'rộng lớn, bao la',
  '早': 'sớm, nhanh chóng',
  '遅': 'chậm trễ, muộn màng',
  '明': 'sáng sủa, thông minh',
  '暗': 'tối tăm, ảm đạm',
  '近': 'gần gũi, tiếp cận',
  '遠': 'xa xôi, viễn cảnh',
  '道': 'con đường, đạo lý',
  '駅': 'nhà ga tàu',
  '店': 'cửa hàng, tiệm buôn',
  '家': 'ngôi nhà, gia đình',
  '族': 'bộ tộc, gia đình',
  '親': 'cha mẹ, thân thiết',
  '子': 'con cái, đứa trẻ',
  '父': 'bố, cha',
  '母': 'mẹ, má',
  '兄': 'anh trai',
  '弟': 'em trai',
  '姉': 'chị gái',
  '妹': 'em gái'
};

// Bộ nhớ đệm dữ liệu cục bộ (In-Memory Cache)
let localKanjiMap = null;
let localKanjiDetails = null;
let localDictList = null;
let localDictMap = null;

/**
 * Đảm bảo nạp sẵn dữ liệu Offline từ file JSON nội bộ trong Extension
 */
async function ensureLocalDataLoaded() {
  if (localKanjiMap && localKanjiDetails && localDictMap) return;

  try {
    if (!localKanjiMap) {
      const kvRes = await fetch(chrome.runtime.getURL('data/kanji_hanviet.json'));
      localKanjiMap = await kvRes.json();
      console.log(`[JP-Dict Background] Đã nạp thành công Bảng Hán Việt offline (${Object.keys(localKanjiMap).length} Hán tự).`);
    }

    if (!localKanjiDetails) {
      const kdRes = await fetch(chrome.runtime.getURL('data/kanji_details.json'));
      localKanjiDetails = await kdRes.json();
      console.log(`[JP-Dict Background] Đã nạp thành công Bảng Giải nghĩa Hán tự offline (${Object.keys(localKanjiDetails).length} mục).`);
    }

    if (!localDictMap) {
      const dictRes = await fetch(chrome.runtime.getURL('data/core_dict.json'));
      localDictList = await dictRes.json();
      localDictMap = new Map();
      localDictList.forEach(item => {
        if (item.kanji) localDictMap.set(item.kanji, item);
        if (item.kana && !localDictMap.has(item.kana)) localDictMap.set(item.kana, item);
      });
      console.log(`[JP-Dict Background] Đã nạp ${localDictList.length} từ vựng cốt lõi vào bộ nhớ đệm.`);
    }
  } catch (err) {
    console.error('[JP-Dict Background] Lỗi nạp Local Data:', err);
  }
}

/**
 * Tra cứu âm Hán Việt ngoại tuyến từ từ điển Kanji nội bộ
 * @param {string} text Đoạn chữ chứa Kanji
 * @returns {string} Âm Hán Việt
 */
function getLocalHanViet(text) {
  if (!localKanjiMap || !text) return '';
  const kanjiChars = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
  if (!kanjiChars) return '';
  return kanjiChars
    .map(c => localKanjiMap[c] || '')
    .filter(Boolean)
    .join(', ');
}

/**
 * Lấy âm Hán Việt chuẩn xác, nếu gặp chữ hiếm ngoài bảng local sẽ tự động fallback gọi Thi Viện
 */
async function getHanVietWithFallback(text) {
  const localHv = getLocalHanViet(text);
  const kanjiChars = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || [];
  
  const isComplete = kanjiChars.length > 0 && kanjiChars.every(c => localKanjiMap && localKanjiMap[c]);
  if (isComplete) {
    return localHv;
  }

  try {
    const thivienRes = await fetchWithTimeout("https://hvdic.thivien.net/transcript-query.json.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `mode=trans&lang=1&input=${encodeURIComponent(text)}`,
      timeout: 2500
    }).then(r => r.json());

    if (thivienRes && thivienRes.result) {
      const remoteHv = thivienRes.result
        .map(item => (item.o && item.o.length > 0) ? (item.o[0].charAt(0).toUpperCase() + item.o[0].slice(1)) : '')
        .filter(Boolean)
        .join(', ');
      if (remoteHv) return remoteHv;
    }
  } catch (e) {
    // Dự phòng dùng localHv
  }

  return localHv;
}

// Danh sách trợ từ tiếng Nhật thường dính vào đuôi từ
const PARTICLES = ['の', 'に', 'を', 'は', 'が', 'で', 'へ', 'と', 'も', 'から', 'まで', 'より', 'ね', 'よ', 'か', 'だ', 'です'];

const GODAN_I_TO_U = {
  'い': 'う', 'き': 'く', 'ぎ': 'ぐ', 'し': 'す',
  'ち': 'つ', 'に': 'ぬ', 'び': 'ぶ', 'み': 'む', 'り': 'る'
};

const GODAN_A_TO_U = {
  'わ': 'う', 'か': 'く', 'が': 'ぐ', 'さ': 'す',
  'た': 'つ', 'な': 'ぬ', 'ば': 'ぶ', 'ま': 'む', 'ら': 'る'
};

/**
 * Tự động phân tích và sinh danh sách các thể nguyên mẫu (Deconjugation & Tách trợ từ)
 * Giúp tra cứu chính xác ngay cả khi người dùng bôi đen từ đã chia hoặc kèm trợ từ (vd: 活動の, 近くに, 食べました)
 */
function getWordCandidates(text) {
  const candidates = new Set();
  const clean = (text || '').trim();
  if (!clean) return [];

  // 1. Tách trợ từ đuôi
  for (const p of PARTICLES) {
    if (clean.endsWith(p) && clean.length > p.length) {
      const stem = clean.slice(0, -p.length);
      if (stem) {
        candidates.add(stem);
        if (stem.endsWith('く') && stem.length > 1) {
          candidates.add(stem.slice(0, -1) + 'い'); // Vd: 近くに -> 近く -> 近い
        }
      }
    }
  }

  // 2. Chia thể động từ & tính từ
  // Masu forms
  for (const suf of ['ませんでした', 'ました', 'ません', 'ます']) {
    if (clean.endsWith(suf)) {
      const base = clean.slice(0, -suf.length);
      if (base) {
        candidates.add(base + 'る'); // Động từ nhóm 2
        candidates.add(base);
        const lastChar = base.slice(-1);
        if (GODAN_I_TO_U[lastChar]) {
          candidates.add(base.slice(0, -1) + GODAN_I_TO_U[lastChar]); // Động từ nhóm 1
        }
      }
    }
  }

  // Nai forms
  for (const suf of ['なかった', 'ない']) {
    if (clean.endsWith(suf)) {
      const base = clean.slice(0, -suf.length);
      if (base) {
        candidates.add(base + 'る');
        const lastChar = base.slice(-1);
        if (GODAN_A_TO_U[lastChar]) {
          candidates.add(base.slice(0, -1) + GODAN_A_TO_U[lastChar]);
        }
      }
    }
  }

  // Te / Ta forms
  if (clean.endsWith('ている') || clean.endsWith('ていた')) {
    const base = clean.slice(0, -3);
    candidates.add(base + 'る');
  }
  if (clean.endsWith('って') || clean.endsWith('った')) {
    const base = clean.slice(0, -2);
    candidates.add(base + 'う');
    candidates.add(base + 'つ');
    candidates.add(base + 'る');
    if (base === '行') candidates.add('行く');
  }
  if (clean.endsWith('んで') || clean.endsWith('んだ')) {
    const base = clean.slice(0, -2);
    candidates.add(base + 'む');
    candidates.add(base + 'ぶ');
    candidates.add(base + 'ぬ');
  }
  if (clean.endsWith('いて') || clean.endsWith('いた')) {
    const base = clean.slice(0, -2);
    candidates.add(base + 'く');
  }
  if (clean.endsWith('して') || clean.endsWith('した')) {
    const base = clean.slice(0, -2);
    candidates.add(base + 'す');
    candidates.add(base + 'る');
  }

  // Adjective forms (〜くない, 〜かった, 〜く, 〜な)
  for (const suf of ['くない', 'かった', 'く', 'ければ']) {
    if (clean.endsWith(suf)) {
      const base = clean.slice(0, -suf.length);
      candidates.add(base + 'い');
      candidates.add(base);
    }
  }
  if (clean.endsWith('な') && clean.length > 2) {
    candidates.add(clean.slice(0, -1));
  }

  return Array.from(candidates);
}

// Lắng nghe yêu cầu dịch từ content script hoặc popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request.text, request.targetLang)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Giữ kênh giao tiếp bất đồng bộ mở
  }
});

/**
 * Hàm fetch tùy chỉnh hỗ trợ timeout
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 3500 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Lấy ngôn ngữ dịch ưu tiên từ cấu hình đã lưu
 */
async function getPreferredTargetLang() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['jpDictAppSettings'], (result) => {
      const settings = result.jpDictAppSettings || {};
      resolve(settings.targetLang || 'both');
    });
  });
}

/**
 * Hàm xử lý tra cứu từ vựng đa dạng - Trả về đầy đủ 3 Tab: Từ vựng, Hán tự, Dịch
 * Hỗ trợ đa ngôn ngữ: 'vi' (Tiếng Việt), 'en' (Tiếng Anh), 'both' (Song ngữ Việt-Anh)
 */
async function handleTranslation(text, explicitTargetLang) {
  try {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return { success: false, error: 'Văn bản trống' };
    }

    const targetLang = explicitTargetLang || (await getPreferredTargetLang());

    // 1. Luôn bảo đảm dữ liệu Offline đã sẵn sàng
    await ensureLocalDataLoaded();

    // 2. Chạy cuộc gọi Google Translate để lấy bản dịch song ngữ Việt & Anh cho toàn bộ câu/từ
    const translateViPromise = fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=${encodeURIComponent(cleanText)}`, { timeout: 3500 })
      .then(r => r.json())
      .then(json => (json && json[0]) ? json[0].map(x => x[0]).join('') : '')
      .catch(() => '');

    const translateEnPromise = fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(cleanText)}`, { timeout: 3500 })
      .then(r => r.json())
      .then(json => (json && json[0]) ? json[0].map(x => x[0]).join('') : '')
      .catch(() => '');

    // 3. Phân tích các dạng nguyên mẫu & bỏ trợ từ
    const candidates = getWordCandidates(cleanText);

    // Chạy cuộc gọi Jisho API lấy danh sách nhiều kết quả từ vựng & các cách đọc khác nhau
    const jishoPromise = (async () => {
      let res = await fetchWithTimeout(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(cleanText)}`, { timeout: 3500 })
        .then(r => r.json())
        .catch(() => null);

      // Nếu từ gốc không có kết quả từ Jisho, thử tra cứu các dạng nguyên mẫu đã bóc tách
      if ((!res || !res.data || res.data.length === 0) && candidates.length > 0) {
        for (const candidate of candidates.slice(0, 2)) {
          const candRes = await fetchWithTimeout(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(candidate)}`, { timeout: 2500 })
            .then(r => r.json())
            .catch(() => null);
          if (candRes && candRes.data && candRes.data.length > 0) {
            return candRes;
          }
        }
      }
      return res;
    })();

    // Chờ các dịch vụ hoàn thành
    const [meaningVi, meaningEn, jishoData] = await Promise.all([
      translateViPromise,
      translateEnPromise,
      jishoPromise
    ]);

    // 4. XÂY DỰNG DANH SÁCH KẾT QUẢ TỪ VỰNG (Tab 1: Từ vựng)
    const vocabResults = [];

    // Ưu tiên gom các kết quả trùng khớp từ Local Dictionary trước
    if (localDictList) {
      const searchTerms = [cleanText, ...candidates];
      localDictList.forEach(item => {
        if (vocabResults.length >= 6) return;
        const matchExact = searchTerms.includes(item.kanji) || searchTerms.includes(item.kana);
        const matchSub = item.kanji && item.kanji.includes(cleanText) && cleanText.length >= 1;
        if (matchExact || matchSub) {
          const isDupe = vocabResults.some(r => r.kanji === item.kanji && r.reading === item.kana);
          if (!isDupe) {
            vocabResults.push({
              kanji: item.kanji,
              reading: item.kana,
              hanviet: (item.hanviet || getLocalHanViet(item.kanji)).toUpperCase(),
              meaningVi: item.meaning,
              meaningEn: '',
              meaning: item.meaning,
              jlpt: item.jlpt || '',
              pos: item.partOfSpeech || 'Từ vựng'
            });
          }
        }
      });
    }

    // Bổ sung các kết quả đa dạng từ Jisho API (như ảnh mẫu: 年、歳 とし / 歳、才 さい ...)
    if (jishoData && jishoData.data && jishoData.data.length > 0) {
      const topEntries = jishoData.data.slice(0, 5); // Lấy tối đa 5 kết quả
      const sensesToTranslate = [];

      topEntries.forEach((entry) => {
        const wordsList = [];
        if (entry.japanese) {
          entry.japanese.forEach(j => {
            if (j.word && !wordsList.includes(j.word)) wordsList.push(j.word);
          });
        }
        if (wordsList.length === 0 && entry.slug) wordsList.push(entry.slug);

        const kanjiStr = wordsList.length > 0 ? wordsList.join('、 ') : cleanText;
        const readingStr = entry.japanese && entry.japanese[0] ? (entry.japanese[0].reading || '') : '';
        const hanvietStr = (getLocalHanViet(kanjiStr) || '').toUpperCase();

        let enDef = '';
        if (entry.senses && entry.senses[0] && entry.senses[0].english_definitions) {
          enDef = entry.senses[0].english_definitions.slice(0, 3).join(', ');
        }

        let posStr = '';
        if (entry.senses && entry.senses[0] && entry.senses[0].parts_of_speech) {
          posStr = entry.senses[0].parts_of_speech.map(p => POS_MAP[p] || p).join(', ');
        }

        sensesToTranslate.push({
          kanji: kanjiStr,
          reading: readingStr,
          hanviet: hanvietStr,
          enDef: enDef || kanjiStr,
          meaningVi: '',
          meaningEn: enDef || kanjiStr,
          pos: posStr,
          jlpt: entry.jlpt ? entry.jlpt.map(l => l.replace('jlpt-n', 'N').toUpperCase()).join(', ') : ''
        });
      });

      // Dịch nghĩa tiếng Anh sang tiếng Việt theo từng dòng (\n) để giữ cấu trúc chính xác
      if (sensesToTranslate.length > 0) {
        try {
          const joinedEng = sensesToTranslate.map(s => s.enDef).join('\n');
          const batchTrans = await fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(joinedEng)}`, { timeout: 3500 })
            .then(r => r.json());
          
          if (batchTrans && batchTrans[0]) {
            const fullVi = batchTrans[0].map(x => x[0]).join('');
            const splitVi = fullVi.split('\n').map(m => m.trim());
            sensesToTranslate.forEach((s, i) => {
              if (splitVi[i]) s.meaningVi = splitVi[i];
            });
          }
        } catch (e) {
          // Bỏ qua lỗi dịch phụ
        }

        // Đưa vào danh sách kết quả (loại trùng lặp theo cặp Kanji + Reading)
        sensesToTranslate.forEach(jItem => {
          const isDupe = vocabResults.some(r => r.kanji === jItem.kanji && r.reading === jItem.reading);
          if (!isDupe && vocabResults.length < 8) {
            const viMeaning = jItem.meaningVi || meaningVi || '';
            const enMeaning = jItem.meaningEn || '';

            // Định dạng nghĩa theo thiết lập ngôn ngữ targetLang
            let displayMeaning = viMeaning;
            if (targetLang === 'en') {
              displayMeaning = enMeaning || viMeaning;
            } else if (targetLang === 'both') {
              displayMeaning = viMeaning ? (enMeaning ? `${viMeaning} (${enMeaning})` : viMeaning) : enMeaning;
            }

            vocabResults.push({
              kanji: jItem.kanji,
              reading: jItem.reading,
              hanviet: jItem.hanviet,
              meaningVi: viMeaning,
              meaningEn: enMeaning,
              meaning: displayMeaning || 'Chưa rõ nghĩa',
              jlpt: jItem.jlpt,
              pos: jItem.pos
            });
          }
        });
      }
    }

    // Nếu vẫn chưa có kết quả nào, tạo 1 kết quả cơ bản từ Google Translate
    if (vocabResults.length === 0) {
      const hv = await getHanVietWithFallback(cleanText);
      const viMeaning = meaningVi || '';
      const enMeaning = meaningEn || '';
      let displayMeaning = viMeaning;
      if (targetLang === 'en') {
        displayMeaning = enMeaning || viMeaning;
      } else if (targetLang === 'both') {
        displayMeaning = viMeaning ? (enMeaning ? `${viMeaning} (${enMeaning})` : viMeaning) : enMeaning;
      }

      vocabResults.push({
        kanji: cleanText,
        reading: cleanText,
        hanviet: (hv || '').toUpperCase(),
        meaningVi: viMeaning,
        meaningEn: enMeaning,
        meaning: displayMeaning || 'Không tìm thấy kết quả',
        jlpt: '',
        pos: 'Từ vựng'
      });
    }

    // 5. XÂY DỰNG DANH SÁCH HÁN TỰ (Tab 2: Hán tự)
    const kanjiChars = cleanText.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || [];
    // Nếu trong cleanText không có Kanji nhưng kết quả từ vựng có Kanji, lấy Kanji từ kết quả đầu tiên
    const targetKanjiList = kanjiChars.length > 0 
      ? [...new Set(kanjiChars)]
      : (vocabResults[0] && vocabResults[0].kanji ? [...new Set(vocabResults[0].kanji.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || [])] : []);

    const kanjiDetails = [];
    for (const char of targetKanjiList) {
      const detail = (localKanjiDetails && localKanjiDetails[char]) ? localKanjiDetails[char] : null;
      let hv = detail && detail.hanviet ? detail.hanviet : ((localKanjiMap && localKanjiMap[char]) ? localKanjiMap[char].toUpperCase() : '');
      
      if (!hv || hv === 'CHƯA RÕ') {
        hv = (await getHanVietWithFallback(char) || '').toUpperCase();
      }

      let def = (detail && detail.meaning && detail.meaning !== 'Chữ Hán tiếng Nhật') 
        ? detail.meaning 
        : (KANJI_CORE_MEANING[char] || '');
      
      if (!def) {
        def = 'Chữ Hán trong tiếng Nhật.';
      }

      kanjiDetails.push({
        char: char,
        hanviet: hv || 'CHƯA RÕ',
        meaning: def,
        strokes: detail && detail.strokes ? detail.strokes : '',
        radical: detail && detail.radical ? detail.radical : ''
      });
    }

    // 6. XÂY DỰNG TAB DỊCH (Tab 3: Dịch)
    const translationData = {
      sourceText: cleanText,
      translatedVi: meaningVi || (vocabResults[0] ? vocabResults[0].meaningVi : ''),
      translatedEn: meaningEn || (vocabResults[0] ? vocabResults[0].meaningEn : ''),
      translatedText: targetLang === 'en' ? (meaningEn || meaningVi) : (meaningVi || meaningEn),
      targetLang: targetLang
    };

    // Chuẩn bị kết quả tương thích ngược cho các thành phần cũ
    const primary = vocabResults[0] || {};

    return {
      success: true,
      data: {
        query: cleanText,
        targetLang: targetLang,
        results: vocabResults,       // Danh sách nhiều cách đọc & nhiều nghĩa (Tab Từ vựng)
        kanjis: kanjiDetails,         // Danh sách các chữ Hán tự (Tab Hán tự)
        translation: translationData, // Bản dịch nhanh (Tab Dịch)
        // Các trường tương thích ngược:
        kanji: primary.kanji || cleanText,
        reading: primary.reading || '',
        hanviet: primary.hanviet || '',
        meaningVi: primary.meaningVi || meaningVi || '',
        meaningEn: primary.meaningEn || meaningEn || '',
        meaning: primary.meaning || meaningVi || meaningEn || '',
        jlpt: primary.jlpt || '',
        isCommon: true,
        partOfSpeech: primary.pos || 'Từ vựng'
      }
    };

  } catch (error) {
    console.error('[JP-Dict Background] Lỗi xử lý tra cứu:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
