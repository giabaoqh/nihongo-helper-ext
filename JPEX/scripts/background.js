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
let localKanjiReadings = null;
let localCompoundWords = null;
let isDataLoading = false;
let dataLoadPromise = null;

const TRANSLATION_CACHE = new Map();
const MAX_CACHE_SIZE = 500;

/**
 * Đảm bảo nạp sẵn dữ liệu Offline từ file JSON nội bộ trong Extension (Nạp song song siêu tốc)
 */
async function ensureLocalDataLoaded() {
  if (localKanjiMap && localKanjiDetails && localDictMap && localKanjiReadings && localCompoundWords ) return;
  if (isDataLoading && dataLoadPromise) return dataLoadPromise;

  isDataLoading = true;
  dataLoadPromise = (async () => {
    try {
      const [kv, kd, kr, dict, cw] = await Promise.all([
        !localKanjiMap ? fetch(chrome.runtime.getURL('data/kanji_hanviet.json')).then(r => r.json()).catch(() => ({})) : localKanjiMap,
        !localKanjiDetails ? fetch(chrome.runtime.getURL('data/kanji_details.json')).then(r => r.json()).catch(() => ({})) : localKanjiDetails,
        !localKanjiReadings ? fetch(chrome.runtime.getURL('data/kanji_readings.json')).then(r => r.json()).catch(() => ({})) : localKanjiReadings,
        !localDictList ? fetch(chrome.runtime.getURL('data/core_dict.json')).then(r => r.json()).catch(() => ([])) : localDictList,
        !localCompoundWords ? fetch(chrome.runtime.getURL('data/compound_words.json')).then(r => r.json()).catch(() => ({})) : localCompoundWords,
              ]);

      localKanjiMap = localKanjiMap || kv;
      localKanjiDetails = localKanjiDetails || kd;
      localKanjiReadings = localKanjiReadings || kr;
      localCompoundWords = localCompoundWords || cw;
      
      if (!localDictMap && Array.isArray(dict)) {
        localDictList = dict;
        localDictMap = new Map();
        localDictList.forEach(item => {
          if (item.kanji) localDictMap.set(item.kanji, item);
          if (item.kana && !localDictMap.has(item.kana)) localDictMap.set(item.kana, item);
        });
      }
    } catch (err) {
      console.error('[JP-Dict Background] Lỗi nạp Local Data:', err);
    } finally {
      isDataLoading = false;
    }
  })();

  return dataLoadPromise;
}

// Tự động nạp trước dữ liệu khi Service Worker khởi động
ensureLocalDataLoaded().catch(() => {});

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
// Lắng nghe yêu cầu từ content script hoặc popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openExtensionPopup') {
    handleOpenExtensionPopup(sendResponse);
    return true;
  }

  if (request.action === 'translate') {
    handleTranslation(request.text, request.targetLang)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Chụp ảnh màn hình tab hiện tại cho Manga/Screen OCR
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Không chụp được màn hình'
        });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true;
  }

  // Gửi ảnh cắt lên OCR API nhận diện chữ tiếng Nhật
  if (request.action === 'performOcr') {
    handleOcrRequest(request.base64Image)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Mở Popup / Dashboard Cài đặt của Extension tại góc trên bên phải
 */
function handleOpenExtensionPopup(sendResponse) {
  chrome.storage.local.set({ activePopupTab: 'settings-tab' }, () => {
    // 1. Thử gọi chrome.action.openPopup() (Manifest V3)
    if (chrome.action && typeof chrome.action.openPopup === 'function') {
      try {
        const popupPromise = chrome.action.openPopup();
        if (popupPromise && typeof popupPromise.then === 'function') {
          popupPromise
            .then(() => {
              if (sendResponse) sendResponse({ success: true, mode: 'action' });
            })
            .catch((err) => {
              console.warn('[JPEX] chrome.action.openPopup không được phép hoặc lỗi, chuyển sang mở cửa sổ popup:', err);
              openPopupWindow(sendResponse);
            });
          return;
        }
      } catch (e) {
        console.warn('[JPEX] chrome.action.openPopup exception:', e);
      }
    }
    // 2. Dự phòng: Mở cửa sổ popup góc trên bên phải
    openPopupWindow(sendResponse);
  });
}

function openPopupWindow(sendResponse) {
  const width = 420;
  const height = 620;
  if (chrome.windows && chrome.windows.getLastFocused) {
    chrome.windows.getLastFocused({ populate: false }, (win) => {
      const screenWidth = (win && win.width) ? win.width : 1280;
      const winLeft = (win && typeof win.left === 'number') ? win.left : 0;
      const winTop = (win && typeof win.top === 'number') ? win.top : 0;

      const left = Math.max(0, winLeft + screenWidth - width - 25);
      const top = Math.max(0, winTop + 75);

      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?tab=settings'),
        type: 'popup',
        width: width,
        height: height,
        left: left,
        top: top,
        focused: true
      }, (createdWin) => {
        if (chrome.runtime.lastError || !createdWin) {
          fallbackOpenTab(sendResponse);
        } else {
          if (sendResponse) sendResponse({ success: true, mode: 'window' });
        }
      });
    });
  } else {
    fallbackOpenTab(sendResponse);
  }
}

function fallbackOpenTab(sendResponse) {
  if (chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?tab=settings') }, () => {
      if (sendResponse) sendResponse({ success: true, mode: 'tab' });
    });
  } else {
    if (sendResponse) sendResponse({ success: false });
  }
}

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
/**
 * Xử lý yêu cầu dịch thuật và tra cứu đa nguồn siêu tốc
 */
async function handleTranslation(text, explicitTargetLang) {
  try {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return { success: false, error: 'Văn bản trống' };
    }

    const targetLang = 'vi';
    const meaningEn = '';
    const enMeaning = '';
    const cacheKey = `${cleanText}_vi`;

    // 1. Kiểm tra Cache bộ nhớ trước tiên (Trả kết quả trong 0ms)
    if (TRANSLATION_CACHE.has(cacheKey)) {
      return TRANSLATION_CACHE.get(cacheKey);
    }

    // 2. Bảo đảm dữ liệu ngoại tuyến đã sẵn sàng
    await ensureLocalDataLoaded();

    // Khởi chạy song song Google Translate Tiếng Việt & Jisho
    const translateViPromise = fetchWithTimeout(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=${encodeURIComponent(cleanText)}`,
      { timeout: 1800 }
    )
      .then(r => r.json())
      .then(json => (json && json[0]) ? json[0].map(x => x[0]).join('') : '')
      .catch(() => '');

    const candidates = getWordCandidates(cleanText);

    // Cuộc gọi Jisho với header trình duyệt và timeout 1500ms
    const jishoPromise = fetchWithTimeout(
      `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(cleanText)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 1500
      }
    )
      .then(r => r.json())
      .catch(() => null);

    const [meaningVi, jishoData] = await Promise.all([
      translateViPromise,
      jishoPromise
    ]);

    // 4. XÂY DỰNG DANH SÁCH KẾT QUẢ TỪ VỰNG (Tab 1: Từ vựng)
    const vocabResults = [];

    // Ưu tiên 1: Tra cứu từ dữ liệu cục bộ core_dict
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

    // Ưu tiên 2: Bổ sung cách đọc từ compound_words nếu có
    if (localCompoundWords && localCompoundWords[cleanText] && !vocabResults.some(r => r.kanji === cleanText)) {
      const hvClean = (getLocalHanViet(cleanText) || '').toUpperCase();
      const defMeaning = meaningVi || (hvClean ? ('Hán Việt: ' + hvClean) : 'Từ vựng tiếng Nhật');
      vocabResults.push({
        kanji: cleanText,
        reading: localCompoundWords[cleanText],
        hanviet: hvClean,
        meaningVi: defMeaning,
        meaning: defMeaning,
        jlpt: '',
        pos: 'Từ vựng'
      });
    }

    // Ưu tiên 3: Bổ sung các kết quả từ Jisho API
    if (jishoData && jishoData.data && jishoData.data.length > 0) {
      const topEntries = jishoData.data.slice(0, 4);
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

      // Dịch nhanh các nghĩa tiếng Anh sang tiếng Việt (timeout ngắn 1000ms để không làm chậm)
      if (sensesToTranslate.length > 0) {
        try {
          const joinedEng = sensesToTranslate.map(s => s.enDef).join('\n');
          const batchTrans = await fetchWithTimeout(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(joinedEng)}`,
            { timeout: 1000 }
          ).then(r => r.json()).catch(() => null);

          if (batchTrans && batchTrans[0]) {
            const fullVi = batchTrans[0].map(x => x[0]).join('');
            const splitVi = fullVi.split('\n').map(m => m.trim());
            sensesToTranslate.forEach((s, i) => {
              if (splitVi[i]) s.meaningVi = splitVi[i];
            });
          }
        } catch (e) {}

        sensesToTranslate.forEach(jItem => {
          const isDupe = vocabResults.some(r => r.kanji === jItem.kanji && r.reading === jItem.reading);
          if (!isDupe && vocabResults.length < 8) {
            const viMeaning = jItem.meaningVi || meaningVi || '';
            let displayMeaning = viMeaning;

            vocabResults.push({
              kanji: jItem.kanji,
              reading: jItem.reading,
              hanviet: jItem.hanviet,
              meaningVi: viMeaning,
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
      const hv = getLocalHanViet(cleanText);
      const viMeaning = meaningVi || '';
      let displayMeaning = viMeaning;

      vocabResults.push({
        kanji: cleanText,
        reading: (localCompoundWords && localCompoundWords[cleanText]) || cleanText,
        hanviet: (hv || '').toUpperCase(),
        meaningVi: viMeaning,
        meaning: displayMeaning || 'Không tìm thấy kết quả',
        jlpt: '',
        pos: 'Từ vựng'
      });
    }

    // 5. XÂY DỰNG DANH SÁCH HÁN TỰ (Tab 2: Hán tự)
    const kanjiChars = cleanText.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || [];
    const targetKanjiList = kanjiChars.length > 0
      ? [...new Set(kanjiChars)]
      : (vocabResults[0] && vocabResults[0].kanji ? [...new Set(vocabResults[0].kanji.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g) || [])] : []);

    const kanjiDetails = [];
    // Xử lý song song cho các chữ Kanji
    await Promise.all(targetKanjiList.map(async (char) => {
      const detail = (localKanjiDetails && localKanjiDetails[char]) ? localKanjiDetails[char] : null;
      let hv = detail && detail.hanviet ? detail.hanviet : ((localKanjiMap && localKanjiMap[char]) ? localKanjiMap[char].toUpperCase() : '');

      if (!hv || hv === 'CHƯA RÕ') {
        hv = (getLocalHanViet(char) || '').toUpperCase();
      }

      let def = (detail && detail.meaning && detail.meaning !== 'Chữ Hán tiếng Nhật')
        ? detail.meaning
        : (KANJI_CORE_MEANING[char] || '');

      if (!def) {
        def = 'Chữ Hán trong tiếng Nhật.';
      }

      let readingStr = '';
      if (localKanjiReadings && localKanjiReadings[char] && localKanjiReadings[char].r) {
        readingStr = localKanjiReadings[char].r;
      } else if (detail && (detail.reading || detail.kana)) {
        readingStr = detail.reading || detail.kana;
      } else if (vocabResults) {
        const matchedVocab = vocabResults.find(v => v.kanji === char || (v.kanji && v.kanji.includes(char)));
        if (matchedVocab && matchedVocab.reading) readingStr = matchedVocab.reading;
      }

      kanjiDetails.push({
        char: char,
        reading: readingStr || '',
        hanviet: hv || 'CHƯA RÕ',
        meaning: def,
        strokes: detail && detail.strokes ? detail.strokes : '',
        radical: detail && detail.radical ? detail.radical : ''
      });
    }));

    // Sắp xếp Kanji theo đúng thứ tự xuất hiện ban đầu
    kanjiDetails.sort((a, b) => targetKanjiList.indexOf(a.char) - targetKanjiList.indexOf(b.char));

    // 6. XÂY DỰNG TAB DỊCH (Tab 3: Dịch)
    const translationData = {
      sourceText: cleanText,
      translatedVi: meaningVi || (vocabResults[0] ? vocabResults[0].meaningVi : ''),
      translatedText: meaningVi || (vocabResults[0] ? vocabResults[0].meaningVi : ''),
      targetLang: 'vi'
    };

    const primary = vocabResults[0] || {};

    const responseObj = {
      success: true,
      data: {
        query: cleanText,
        targetLang: targetLang,
        results: vocabResults,
        kanjis: kanjiDetails,
        translation: translationData,
        kanji: primary.kanji || cleanText,
        reading: primary.reading || '',
        hanviet: primary.hanviet || '',
        meaningVi: primary.meaningVi || meaningVi || '',
        meaning: primary.meaningVi || meaningVi || ''
      }
    };

    // 7. Lưu vào bộ nhớ đệm (LRU Cache)
    if (TRANSLATION_CACHE.size >= MAX_CACHE_SIZE) {
      const firstKey = TRANSLATION_CACHE.keys().next().value;
      TRANSLATION_CACHE.delete(firstKey);
    }
    TRANSLATION_CACHE.set(cacheKey, responseObj);

    return responseObj;
  } catch (error) {
    console.error('[JP-Dict Background] Lỗi xử lý dịch thuật:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Lấy câu ví dụ mẫu từ Tatoeba / Google
 */
async function getExampleSentences(query) {
  if (!query) return [];
  try {
    const url = "https://tatoeba.org/en/api_v0/search?from=jpn&query=" + encodeURIComponent(query) + "&trans_filter=limit&trans_to=vie&to=vie";
    const res = await fetchWithTimeout(url, { timeout: 3500 });
    const data = await res.json();
    const examples = [];
    if (data.results && data.results.length > 0) {
      for (const r of data.results.slice(0, 3)) {
        let viTrans = '';
        if (r.translations && r.translations[0] && r.translations[0].length > 0) {
          viTrans = r.translations[0][0].text;
        }
        examples.push({
          japanese: r.text,
          vietnamese: viTrans || 'Câu ví dụ tiếng Nhật'
        });
      }
    }

    if (examples.length === 0) {
      const jpText = query + "を使います。";
      let viTrans = '';
      try {
        const gRes = await fetchWithTimeout("https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=" + encodeURIComponent(jpText), { timeout: 1500 }).then(r => r.json());
        if (gRes && gRes[0]) viTrans = gRes[0].map(x => x[0]).join('');
      } catch(e) {}
      examples.push({
        japanese: jpText,
        vietnamese: viTrans || ("Sử dụng " + query)
      });
    }
    return examples;
  } catch (err) {
    return [];
  }
}

/**
 * Nhận diện chữ tiếng Nhật từ ảnh chụp (Manga / Screen OCR)
 */
async function handleOcrRequest(base64Image) {
  if (!base64Image) {
    return { success: false, error: 'Dữ liệu ảnh trống' };
  }
  try {
    const formData = new FormData();
    formData.append('apikey', 'helloworld');
    formData.append('language', 'jpn');
    formData.append('OCREngine', '2');
    formData.append('isOverlayRequired', 'false');
    formData.append('base64Image', base64Image);

    const res = await fetchWithTimeout('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      timeout: 12000
    });
    const data = await res.json();
    if (data && data.ParsedResults && data.ParsedResults[0] && data.ParsedResults[0].ParsedText) {
      let text = data.ParsedResults[0].ParsedText;
      text = text.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim();
      return { success: true, text: text };
    }
    const errMsg = (data && data.ErrorMessage && data.ErrorMessage[0]) ? data.ErrorMessage[0] : 'Không tìm thấy chữ trong vùng chọn';
    return { success: false, error: errMsg };
  } catch (err) {
    return { success: false, error: 'Lỗi kết nối OCR: ' + err.message };
  }
}
