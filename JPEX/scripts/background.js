/**
 * JP Dictionary Chrome Extension - background.js
 * 
 * Service Worker chạy ngầm của extension.
 * Thực hiện các cuộc gọi API từ phía sau (background) để tránh lỗi CORS.
 * Tải thêm các siêu dữ liệu khác từ Jisho: JLPT level, độ phổ biến, từ loại.
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request.text)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Giữ kênh giao tiếp mở
  }
});

/**
 * Hàm fetch tùy chỉnh hỗ trợ cấu hình thời gian hết hạn (Timeout)
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4000 } = options; // Mặc định hết hạn sau 4 giây
  
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
 * Hàm gọi API tổng hợp để lấy dữ liệu từ Jisho, Google Translate và Hán Việt Thi Viện
 */
async function handleTranslation(text) {
  try {
    // 1. Gọi Jisho API lấy thông tin từ vựng tiếng Nhật
    const jishoPromise = fetchWithTimeout(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(text)}`, { timeout: 4000 })
      .then(r => r.json())
      .catch((err) => {
        console.error('Lỗi Jisho API (Timeout/Network):', err);
        return null;
      });

    // 2. Dịch từ tiếng Nhật sang tiếng Việt bằng Google Translate
    const translatePromise = fetchWithTimeout(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=vi&dt=t&q=${encodeURIComponent(text)}`, { timeout: 4000 })
      .then(r => r.json())
      .then(json => {
        if (json && json[0] && json[0][0] && json[0][0][0]) {
          return json[0][0][0]; // Trả về câu dịch nghĩa tiếng Việt
        }
        return '';
      })
      .catch((err) => {
        console.error('Lỗi Translate API (Timeout/Network):', err);
        return '';
      });

    // 3. Tra cứu âm Hán Việt từ Thi Viện
    const thivienPromise = fetchWithTimeout("https://hvdic.thivien.net/transcript-query.json.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
      },
      body: `mode=trans&lang=1&input=${encodeURIComponent(text)}`,
      timeout: 4000
    })
      .then(r => r.json())
      .then(json => {
        if (json && json.result) {
          return json.result
            .map(item => {
              if (item.o && item.o.length > 0) {
                const p = item.o[0];
                return p.charAt(0).toUpperCase() + p.slice(1);
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');
        }
        return '';
      })
      .catch((err) => {
        console.error('Lỗi ThiVien API (Timeout/Network):', err);
        return '';
      });

    // Chạy song song cả 3 cuộc gọi API
    const [jishoData, meaningVi, hanviet] = await Promise.all([
      jishoPromise,
      translatePromise,
      thivienPromise
    ]);

    // Định dạng cấu trúc dữ liệu trả về cho content_script
    let kanji = text;
    let reading = '';
    let jlpt = '';
    let isCommon = false;
    let partOfSpeech = '';

    if (jishoData && jishoData.data && jishoData.data.length > 0) {
      const entry = jishoData.data[0];
      
      // Lấy Kanji và Cách đọc
      if (entry.japanese && entry.japanese.length > 0) {
        kanji = entry.japanese[0].word || entry.slug || text;
        reading = entry.japanese[0].reading || '';
      }

      // Lấy cấp độ JLPT (định dạng từ jlpt-n5 thành N5)
      if (entry.jlpt && entry.jlpt.length > 0) {
        jlpt = entry.jlpt
          .map(level => level.replace('jlpt-n', 'N').toUpperCase())
          .join(', ');
      }

      // Lấy độ phổ biến
      isCommon = entry.is_common || false;

      // Lấy và dịch Từ loại (Part of speech)
      if (entry.senses && entry.senses.length > 0) {
        const rawPos = entry.senses[0].parts_of_speech || [];
        partOfSpeech = rawPos
          .map(pos => POS_MAP[pos] || pos) // dịch từ loại sang tiếng Việt
          .filter(Boolean)
          .join(', ');
      }
    }

    // 4. Nếu là câu dài, thực hiện phân tách và dịch nghĩa từng từ
    const breakdownWords = [];
    if (jishoData && jishoData.data && jishoData.data.length > 0) {
      const seenKanji = new Set();
      for (const entry of jishoData.data) {
        if (breakdownWords.length >= 6) break; // Lấy tối đa 6 từ

        const wordKanji = entry.japanese && entry.japanese[0] ? (entry.japanese[0].word || entry.slug) : '';
        const wordReading = entry.japanese && entry.japanese[0] ? (entry.japanese[0].reading || '') : '';

        if (!wordKanji) continue;
        if (seenKanji.has(wordKanji)) continue;

        // Kiểm tra xem từ có nằm trong câu gốc hay không (bằng chữ Kanji hoặc cách đọc Kana)
        const isInSentence = text.includes(wordKanji) || (wordReading && text.includes(wordReading));
        
        // Chỉ phân tách nếu từ này là một phần con thực sự của câu (không phải chính câu đó)
        if (isInSentence && wordKanji !== text) {
          seenKanji.add(wordKanji);
          
          // Lấy tối đa 3 nghĩa tiếng Anh đầu tiên từ Jisho để dịch đầy đủ nghĩa hơn
          const rawSenses = entry.senses && entry.senses[0] && entry.senses[0].english_definitions
            ? entry.senses[0].english_definitions.slice(0, 3).join(', ')
            : '';

          breakdownWords.push({
            kanji: wordKanji,
            reading: wordReading,
            englishSenses: rawSenses || wordKanji, // Dự phòng về Kanji nếu không có nghĩa tiếng Anh
            meaningVi: ''
          });
        }
      }
    }

    // Thực hiện cuộc gọi dịch hợp nhất cho tất cả các từ con từ Anh -> Việt để giữ trọn vẹn nhiều nét nghĩa nhất
    if (breakdownWords.length > 0) {
      const wordsJoined = breakdownWords.map(w => w.englishSenses).join('; ');
      try {
        const wordsTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(wordsJoined)}`;
        const transRes = await fetchWithTimeout(wordsTranslateUrl, { timeout: 3000 }).then(r => r.json());
        
        if (transRes && transRes[0]) {
          const fullTrans = transRes[0].map(x => x[0]).join('');
          const splitMeanings = fullTrans.split(';').map(m => m.trim());
          
          breakdownWords.forEach((w, idx) => {
            w.meaningVi = splitMeanings[idx] || 'Chưa rõ nghĩa';
          });
        }
      } catch (err) {
        console.error('[JP-Dict Background] Lỗi dịch phân tách từ:', err);
        breakdownWords.forEach(w => w.meaningVi = 'Chưa rõ nghĩa');
      }
    }

    // 4.5. Nếu tra từ đơn lẻ, bóc tách và dịch nghĩa tất cả các lớp nghĩa khác từ Jisho để gom về một chỗ
    let meaningViCombined = meaningVi;
    const isSingleWord = !/[\s。、．,.\n]/.test(text.trim()) && text.trim().length < 8;
    if (isSingleWord && jishoData && jishoData.data && jishoData.data.length > 0) {
      const entry = jishoData.data[0];
      const sensesList = [];
      if (entry.senses) {
        entry.senses.forEach(sense => {
          if (sense.english_definitions) {
            sensesList.push(sense.english_definitions.join(', '));
          }
        });
      }

      if (sensesList.length > 0) {
        // Lấy tối đa 4 lớp nghĩa chính để dịch
        const sensesToTranslate = sensesList.slice(0, 4);
        const joinedSenses = sensesToTranslate.join('; ');
        
        try {
          const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(joinedSenses)}`;
          const transRes = await fetchWithTimeout(transUrl, { timeout: 3000 }).then(r => r.json());
          
          if (transRes && transRes[0]) {
            const fullTrans = transRes[0].map(x => x[0]).join('');
            const splitSensesVi = fullTrans.split(';').map(m => m.trim()).filter(Boolean);
            
            if (splitSensesVi.length > 0) {
              const formattedSenses = splitSensesVi.map((sense, idx) => `• ${sense}`).join('\n');
              meaningViCombined = `${meaningVi}\n\nCác nghĩa khác:\n${formattedSenses}`;
            }
          }
        } catch (err) {
          console.error('[JP-Dict Background] Lỗi dịch chi tiết các lớp nghĩa chính:', err);
        }
      }
    }

    return {
      success: true,
      data: {
        kanji: kanji,
        hanviet: hanviet || 'Không có',
        reading: reading || 'Đang cập nhật...',
        meaning: meaningViCombined || 'Không tìm thấy nghĩa',
        jlpt: jlpt,
        isCommon: isCommon,
        partOfSpeech: partOfSpeech,
        words: breakdownWords // Đính kèm danh sách phân tách
      }
    };

  } catch (error) {
    console.error('Lỗi tổng hợp dịch thuật:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

