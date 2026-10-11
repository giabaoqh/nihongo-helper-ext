/**
 * JP Dictionary Chrome Extension - storage.js
 * 
 * Tiện ích quản lý lưu trữ dữ liệu từ vựng bằng chrome.storage.local.
 * Được nạp trước content_script.js, popup.js, analyzer_ui.js và workspace.js để dùng chung.
 * Hỗ trợ:
 * 1. Lưu từ vựng & phân nhóm theo Thư mục tùy chỉnh (legacy savedWords & savedFolders).
 * 2. Quản lý Bộ thẻ Flashcard đa năng (Decks & Cards).
 * 3. Thuật toán Lặp lại ngắt quãng (Spaced Repetition System - SRS).
 * 4. Tự động đồng bộ 100% giữa danh sách từ đã lưu và bộ thẻ Flashcard (Zero Data Loss).
 */

const STORAGE_KEY = 'savedWords';
const FOLDERS_KEY = 'savedFolders';
const DECKS_KEY = 'jpex_decks';
const CARDS_KEY = 'jpex_cards';
const REVIEW_STATS_KEY = 'jpex_review_stats';
const SETTINGS_KEY = 'jpDictAppSettings';
const LAST_SAVED_FOLDER_KEY = 'jpex_last_saved_folder';

/**
 * Lấy thư mục / bộ thẻ gần nhất người dùng đã chọn
 */
function getLastSavedFolder() {
  return new Promise((resolve) => {
    chrome.storage.local.get([LAST_SAVED_FOLDER_KEY], (res) => {
      resolve(res[LAST_SAVED_FOLDER_KEY] || "Mặc định");
    });
  });
}

/**
 * Lưu thư mục / bộ thẻ gần nhất người dùng đã chọn
 */
function setLastSavedFolder(folderName) {
  const clean = (folderName || "Mặc định").trim();
  return new Promise((resolve) => {
    chrome.storage.local.set({ [LAST_SAVED_FOLDER_KEY]: clean }, () => {
      resolve(clean);
    });
  });
}

/**
 * Sinh định danh duy nhất (Unique ID)
 */
function generateId(prefix = 'item') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

/**
 * Phát tín hiệu thay đổi dữ liệu thời gian thực (Real-time Broadcast)
 * Đảm bảo mọi tab, popup, content script và cửa sổ Workspace tự động đồng bộ tức thì
 */
function broadcastDataChange(changeType, detail = {}) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        _lastSyncSignal: {
          type: changeType,
          detail: detail,
          timestamp: Date.now()
        }
      });
    }
  } catch (err) {
    console.warn('[Storage] Lỗi broadcastDataChange:', err);
  }
}

/**
 * Tự động đồng bộ tên các bộ thẻ (jpex_decks) với danh sách thư mục (savedFolders)
 */
async function syncDeckFolders() {
  try {
    const decks = await getDecks();
    const folders = await getSavedFolders();
    let changed = false;

    decks.forEach(d => {
      if (d && d.name && !folders.includes(d.name)) {
        folders.push(d.name);
        changed = true;
      }
    });

    if (changed) {
      await new Promise(r => chrome.storage.local.set({ [FOLDERS_KEY]: folders }, r));
    }
    return folders;
  } catch (e) {
    return ["Mặc định"];
  }
}


// ========================================================
// 1. QUẢN LÝ TỪ ĐÃ LƯU & THƯ MỤC CƠ BẢN (LEGACY COMPATIBLE)
// ========================================================

/**
 * Lấy danh sách toàn bộ từ đã lưu
 * @returns {Promise<Array>} Mảng các đối tượng từ vựng đã lưu
 */
function getSavedWords() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

/**
 * Lấy danh sách toàn bộ thư mục lưu từ vựng
 * @returns {Promise<Array>} Mảng tên các thư mục (Mặc định chứa "Mặc định")
 */
function getSavedFolders() {
  return new Promise((resolve) => {
    chrome.storage.local.get([FOLDERS_KEY], (result) => {
      const folders = result[FOLDERS_KEY] || ["Mặc định"];
      resolve(folders);
    });
  });
}

/**
 * Tạo một thư mục lưu từ vựng mới
 */
async function createFolder(folderName) {
  const folders = await getSavedFolders();
  const cleanName = folderName.trim();
  
  if (!cleanName || folders.includes(cleanName)) {
    return folders;
  }
  
  folders.push(cleanName);
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [FOLDERS_KEY]: folders }, () => {
      console.log('[JP-Dict Storage] Đã tạo thư mục mới:', cleanName);
      resolve(folders);
    });
  });
}

/**
 * Cập nhật thư mục cho một từ vựng cụ thể (đồng thời di chuyển thẻ Flashcard sang deck tương ứng)
 * Đảm bảo: Chuyển thẻ sạch sẽ, loại bỏ bản sao thừa ở deck cũ (đặc biệt là deck_default)
 */
async function updateWordFolder(kanji, folderName, oldFolderName = null) {
  const words = await getSavedWords();
  const cleanName = (folderName || "Mặc định").trim();
  const wordKey = (kanji || '').trim();
  if (!wordKey) return await getSavedWords();
  
  let targetWord = null;
  const updatedWords = words.map(w => {
    if (w.kanji === wordKey || w.word === wordKey) {
      if (!oldFolderName && w.folder) {
        oldFolderName = w.folder;
      }
      w.folder = cleanName;
      targetWord = w;
    }
    return w;
  });
  
  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: updatedWords }, () => {
      console.log(`[JP-Dict Storage] Đã chuyển từ "${wordKey}" sang thư mục "${cleanName}"`);
      resolve(updatedWords);
    });
  });

  // Đồng thời cập nhật hoặc tạo thẻ Flashcard trong deck tương ứng
  let targetDeck = null;
  try {
    const decks = await getDecks();
    targetDeck = decks.find(d => d.name === cleanName || d.id === cleanName);
    if (!targetDeck) {
      targetDeck = {
        id: cleanName === 'Mặc định' ? 'deck_default' : generateId('deck'),
        name: cleanName,
        description: `Bộ thẻ ${cleanName}`,
        color: '#0284c7',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      decks.push(targetDeck);
      await saveAllDecks(decks);
    }

    let cards = await getAllCards();
    const cardInTarget = cards.find(c => c.deckId === targetDeck.id && (c.word === wordKey || c.kanji === wordKey));

    if (cardInTarget) {
      // Đã có thẻ trong targetDeck: Giữ thẻ này, xóa bất kỳ bản sao nào của từ này ở deck cũ (nhất là deck_default)
      cardInTarget.updatedAt = Date.now();
      cards = cards.filter(c => {
        if (c.id === cardInTarget.id) return true;
        if (c.word === wordKey || c.kanji === wordKey) {
          // Xóa bản sao ở deck khác
          return false;
        }
        return true;
      });
    } else {
      // Chưa có thẻ trong targetDeck: tìm thẻ ở deck cũ để chuyển sang targetDeck
      const cardToMove = cards.find(c => (c.word === wordKey || c.kanji === wordKey));
      if (cardToMove) {
        cardToMove.deckId = targetDeck.id;
        cardToMove.updatedAt = Date.now();
        // Xóa bất kỳ thẻ thừa khác của từ này
        cards = cards.filter(c => {
          if (c.id === cardToMove.id) return true;
          if (c.word === wordKey || c.kanji === wordKey) {
            return false;
          }
          return true;
        });
      } else if (targetWord) {
        // Chưa có thẻ nào: tạo mới trong targetDeck
        cards.unshift({
          id: generateId('card'),
          deckId: targetDeck.id,
          word: wordKey,
          reading: targetWord.reading || '',
          hanviet: targetWord.hanviet || '',
          meaning: targetWord.meaningVi || targetWord.meaning || 'Từ vựng tiếng Nhật',
          meaningVi: targetWord.meaningVi || targetWord.meaning || 'Từ vựng tiếng Nhật',
          pos: targetWord.pos || 'Từ vựng',
          example: targetWord.example || '',
          exampleMeaning: targetWord.exampleMeaning || '',
          notes: targetWord.notes || '',
          isStarred: !!targetWord.isStarred,
          createdAt: targetWord.addedAt || Date.now(),
          updatedAt: Date.now(),
          srs: {
            interval: 0,
            repetition: 0,
            easeFactor: 2.5,
            dueDate: Date.now(),
            state: 'new',
            lastReviewed: null
          }
        });
      }
    }
    await saveAllCards(cards);
  } catch (e) {
    console.warn('[Storage] Lỗi đồng bộ Flashcard khi chuyển thư mục:', e);
  }

  await setLastSavedFolder(cleanName);
  await syncDeckFolders();

  broadcastDataChange('word_folder_updated', { word: wordKey, folder: cleanName, deckId: targetDeck ? targetDeck.id : null });
  return updatedWords;
}

/**
 * Thêm một từ vựng vào hàng đợi ôn tập Flashcard (và đồng bộ danh sách Từ đã lưu)
 * Hỗ trợ Unified Vocab Schema: { word, reading, hanviet, meaning, example, exampleMeaning }
 * Chống trùng lặp trong cùng một deck, giữ nguyên độc lập giữa các deck khác nhau.
 */
async function addWordToReview(wordData, targetDeckIdOrName = 'deck_default') {
  if (!wordData) throw new Error('Dữ liệu từ vựng không hợp lệ');
  const wordKey = (wordData.word || wordData.kanji || '').trim();
  if (!wordKey) throw new Error('Từ vựng không được để trống');

  const now = Date.now();

  // Chuẩn hóa định danh deck nếu người dùng truyền object deck
  const deckIdentifier = (typeof targetDeckIdOrName === 'object' && targetDeckIdOrName !== null)
    ? (targetDeckIdOrName.id || targetDeckIdOrName.name || 'deck_default')
    : (targetDeckIdOrName || 'deck_default');

  // 1. Tìm hoặc tạo targetDeck
  const decks = await getDecks();
  let targetDeck = decks.find(d => d.id === deckIdentifier || d.name === deckIdentifier);
  if (!targetDeck) {
    if (deckIdentifier && deckIdentifier !== 'deck_default') {
      targetDeck = {
        id: generateId('deck'),
        name: deckIdentifier,
        description: `Bộ thẻ ${deckIdentifier}`,
        color: '#0284c7',
        createdAt: now,
        updatedAt: now
      };
      decks.push(targetDeck);
      await saveAllDecks(decks);
    } else {
      targetDeck = decks[0] || { id: 'deck_default', name: 'Mặc định' };
    }
  }

  // 2. Chuẩn hóa dữ liệu theo Unified Vocab Schema
  const reading = (wordData.reading || wordData.kana || '').trim();
  const hanviet = (wordData.hanviet || '').trim();
  const meaning = (wordData.meaning || wordData.meaningVi || '').trim() || 'Từ vựng tiếng Nhật';
  const example = (wordData.example || '').trim();
  const exampleMeaning = (wordData.exampleMeaning || wordData.exampleTranslation || '').trim();
  const pos = (wordData.pos || wordData.partOfSpeech || 'Từ vựng').trim();
  const notes = (wordData.notes || '').trim();
  const isStarred = typeof wordData.isStarred === 'boolean' ? wordData.isStarred : false;

  const defaultSrs = {
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    dueDate: now, // Sẵn sàng ôn tập ngay lập tức
    state: 'new',
    lastReviewed: null
  };

  // 3. Xử lý Thẻ Flashcard (chống trùng lặp trong cùng deck)
  const allCards = await getAllCards();
  const cardInDeckIndex = allCards.findIndex(c => c.deckId === targetDeck.id && (c.word === wordKey || c.kanji === wordKey));

  let finalCard;
  let isCardDuplicate = false;

  if (cardInDeckIndex !== -1) {
    // Đã có trong deck này: Cập nhật thông tin chi tiết, BẢO TOÀN tiến độ SRS
    const existing = allCards[cardInDeckIndex];
    existing.reading = reading || existing.reading;
    existing.hanviet = hanviet || existing.hanviet;
    existing.meaning = meaning || existing.meaning;
    existing.meaningVi = meaning || existing.meaningVi;
    if (example) existing.example = example;
    if (exampleMeaning) existing.exampleMeaning = exampleMeaning;
    if (notes) existing.notes = notes;
    if (isStarred) existing.isStarred = true;
    existing.updatedAt = now;
    if (!existing.srs) existing.srs = defaultSrs;
    finalCard = existing;
    isCardDuplicate = true;
  } else {
    // Tạo thẻ mới trong deck này
    finalCard = {
      id: wordData.id || generateId('card'),
      deckId: targetDeck.id,
      word: wordKey,
      reading: reading,
      hanviet: hanviet,
      meaning: meaning,
      meaningVi: meaning,
      pos: pos,
      example: example,
      exampleMeaning: exampleMeaning,
      notes: notes,
      isStarred: isStarred,
      createdAt: now,
      updatedAt: now,
      srs: wordData.srs ? { ...defaultSrs, ...wordData.srs } : defaultSrs
    };
    allCards.unshift(finalCard);
  }

  await saveAllCards(allCards);

  // 4. Đồng bộ vào danh sách Từ đã lưu (savedWords)
  const savedWords = await getSavedWords();
  const existingWordIdx = savedWords.findIndex(w => (w.kanji === wordKey || w.word === wordKey));

  if (existingWordIdx !== -1) {
    const existingW = savedWords[existingWordIdx];
    existingW.folder = targetDeck.name;
    existingW.reading = reading || existingW.reading;
    existingW.hanviet = hanviet || existingW.hanviet;
    existingW.meaning = meaning || existingW.meaning;
    existingW.meaningVi = meaning || existingW.meaningVi;
    if (isStarred) existingW.isStarred = true;
  } else {
    savedWords.unshift({
      id: generateId('word'),
      kanji: wordKey,
      word: wordKey,
      reading: reading,
      hanviet: hanviet,
      meaning: meaning,
      meaningVi: meaning,
      folder: targetDeck.name,
      addedAt: now,
      isStarred: isStarred
    });
  }

  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: savedWords }, () => resolve());
  });

  // 5. Đồng bộ thư mục & ghi nhớ thư mục vừa lưu
  await syncDeckFolders();
  await setLastSavedFolder(targetDeck.name);

  // 6. Broadcast Real-time
  broadcastDataChange('card_added_to_review', { word: wordKey, deckId: targetDeck.id, deckName: targetDeck.name });

  return {
    success: true,
    card: finalCard,
    deck: targetDeck,
    isDuplicate: isCardDuplicate
  };
}

/**
 * Lưu một từ vựng mới vào bộ nhớ (Đồng thời tự động tạo Flashcard trong Deck tương ứng)
 */
async function saveWord(wordObj, folderName = "Mặc định") {
  const wordKey = (wordObj.kanji || wordObj.word || '').trim();
  if (!wordKey) return await getSavedWords();

  const cleanFolder = (folderName || "Mặc định").trim();
  await addWordToReview(wordObj, cleanFolder);
  return await getSavedWords();
}

/**
 * Xóa một từ vựng khỏi danh sách lưu trữ (Không tự ý xóa khỏi Flashcard deck để bảo toàn độc lập)
 */
async function deleteWord(kanji) {
  const words = await getSavedWords();
  const filteredWords = words.filter(w => w.kanji !== kanji && w.word !== kanji && w.id !== kanji);
  
  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filteredWords }, () => {
      console.log('[JP-Dict Storage] Đã xóa từ thành công khỏi danh sách lưu:', kanji);
      resolve(filteredWords);
    });
  });

  broadcastDataChange('word_deleted', { word: kanji });
  return filteredWords;
}

/**
 * Kiểm tra xem một từ đã được lưu trước đó chưa (tra cứu cả savedWords và jpex_cards)
 */
async function isWordSaved(kanji) {
  const words = await getSavedWords();
  const cards = await getAllCards();
  const inWords = words.some(w => (w.kanji === kanji || w.word === kanji));
  const inCards = cards.some(c => (c.word === kanji || c.kanji === kanji));
  return inWords || inCards;
}

/**
 * Đổi tên thư mục lưu trữ
 */
async function renameFolder(oldName, newName) {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();
  
  if (!cleanNew || cleanOld === cleanNew || cleanNew === "Mặc định") {
    return;
  }
  
  const folders = await getSavedFolders();
  const updatedFolders = folders.map(f => f === cleanOld ? cleanNew : f);
  
  const words = await getSavedWords();
  const updatedWords = words.map(w => {
    if (w.folder === cleanOld) {
      w.folder = cleanNew;
    }
    return w;
  });
  
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [FOLDERS_KEY]: updatedFolders,
      [STORAGE_KEY]: updatedWords
    }, () => {
      console.log(`[JP-Dict Storage] Đã đổi tên thư mục từ "${cleanOld}" thành "${cleanNew}"`);
      resolve();
    });
  });
}

/**
 * Xóa một thư mục lưu trữ (di chuyển từ vựng về "Mặc định")
 */
async function deleteFolder(folderName) {
  const cleanName = folderName.trim();
  if (cleanName === "Mặc định") return;
  
  const folders = await getSavedFolders();
  const filteredFolders = folders.filter(f => f !== cleanName);
  
  const words = await getSavedWords();
  const updatedWords = words.map(w => {
    if (w.folder === cleanName) {
      w.folder = "Mặc định";
    }
    return w;
  });
  
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [FOLDERS_KEY]: filteredFolders,
      [STORAGE_KEY]: updatedWords
    }, () => {
      console.log(`[JP-Dict Storage] Đã xóa thư mục "${cleanName}"`);
      resolve();
    });
  });
}

// ========================================================
// 2. CÀI ĐẶT ỨNG DỤNG (SETTINGS)
// ========================================================

function getAppSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([SETTINGS_KEY], (result) => {
      const defaults = {
        autoTranslateOnSelect: false,
        targetLang: 'vi',
        hoverLookupEnabled: true,
        hoverKey: 'Shift',
        furiganaEnabled: false,
        furiganaHotkey: 'Alt+F',
        theme: 'auto'
      };
      resolve({ ...defaults, ...(result[SETTINGS_KEY] || {}) });
    });
  });
}

async function updateAppSettings(partialSettings) {
  const current = await getAppSettings();
  const updated = { ...current, ...partialSettings };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SETTINGS_KEY]: updated }, () => {
      console.log('[JP-Dict Storage] Đã lưu cài đặt:', updated);
      resolve(updated);
    });
  });
}

// ========================================================
// 3. ADVANCED FLASHCARD & DECK MANAGEMENT SYSTEM
// ========================================================

/**
 * Lấy toàn bộ danh sách bộ thẻ (Decks)
 */
async function getDecks() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DECKS_KEY], async (res) => {
      let decks = res[DECKS_KEY];
      if (!Array.isArray(decks) || decks.length === 0) {
        const folders = await getSavedFolders();
        decks = folders.map((f, idx) => ({
          id: f === 'Mặc định' ? 'deck_default' : `deck_${idx}_${Date.now()}`,
          name: f,
          description: f === 'Mặc định' ? 'Bộ thẻ từ vựng chung được lưu từ extension' : `Bộ thẻ chủ đề ${f}`,
          color: f === 'Mặc định' ? '#0284c7' : '#7c3aed',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }));
        await saveAllDecks(decks);
      }
      resolve(decks);
    });
  });
}

function saveAllDecks(decks) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [DECKS_KEY]: decks }, () => resolve(decks));
  });
}

async function saveDeck(deckData) {
  const decks = await getDecks();
  const index = decks.findIndex(d => d.id === deckData.id);
  const now = Date.now();
  let savedDeck;

  if (index !== -1) {
    decks[index] = { ...decks[index], ...deckData, updatedAt: now };
    savedDeck = decks[index];
  } else {
    savedDeck = {
      id: deckData.id || generateId('deck'),
      name: (deckData.name || 'Bộ thẻ mới').trim(),
      description: (deckData.description || '').trim(),
      color: deckData.color || '#0284c7',
      createdAt: now,
      updatedAt: now
    };
    decks.push(savedDeck);
  }

  await saveAllDecks(decks);
  return savedDeck;
}

async function deleteDeck(deckId) {
  if (deckId === 'deck_default') return false;
  let decks = await getDecks();
  decks = decks.filter(d => d.id !== deckId);
  await saveAllDecks(decks);

  let cards = await getAllCards();
  cards = cards.filter(c => c.deckId !== deckId);
  await saveAllCards(cards);
  return true;
}

async function duplicateDeck(deckId) {
  const decks = await getDecks();
  const sourceDeck = decks.find(d => d.id === deckId);
  if (!sourceDeck) return null;

  const newDeckId = generateId('deck');
  const duplicatedDeck = {
    ...sourceDeck,
    id: newDeckId,
    name: `${sourceDeck.name} (Bản sao)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  decks.push(duplicatedDeck);
  await saveAllDecks(decks);

  const allCards = await getAllCards();
  const sourceCards = allCards.filter(c => c.deckId === deckId);
  const newCards = sourceCards.map(c => ({
    ...c,
    id: generateId('card'),
    deckId: newDeckId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    srs: {
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      dueDate: Date.now(),
      state: 'new',
      lastReviewed: null
    }
  }));

  allCards.push(...newCards);
  await saveAllCards(allCards);
  return duplicatedDeck;
}

// ========================================================
// 4. FLASHCARD CARDS & SPACED REPETITION (SRS)
// ========================================================

async function getAllCards() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CARDS_KEY], (res) => {
      resolve(res[CARDS_KEY] || []);
    });
  });
}

function saveAllCards(cards) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CARDS_KEY]: cards }, () => resolve(cards));
  });
}

async function getCardsByDeck(deckId) {
  const cards = await getAllCards();
  if (!deckId || deckId === '__all__') return cards;
  return cards.filter(c => c.deckId === deckId);
}

async function saveCard(cardData) {
  const cards = await getAllCards();
  const wordKey = (cardData.word || cardData.kanji || '').trim();
  const targetDeckId = cardData.deckId || 'deck_default';
  const now = Date.now();

  const defaultSrs = {
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    dueDate: now,
    state: 'new',
    lastReviewed: null
  };

  const idMatchIndex = cardData.id ? cards.findIndex(c => c.id === cardData.id) : -1;
  const wordInDeckIndex = (idMatchIndex === -1 && wordKey) 
    ? cards.findIndex(c => c.deckId === targetDeckId && (c.word === wordKey || c.kanji === wordKey))
    : -1;

  let savedCard;
  if (idMatchIndex !== -1) {
    cards[idMatchIndex] = {
      ...cards[idMatchIndex],
      ...cardData,
      word: wordKey || cards[idMatchIndex].word,
      deckId: targetDeckId,
      updatedAt: now,
      srs: { ...(cards[idMatchIndex].srs || defaultSrs), ...(cardData.srs || {}) }
    };
    savedCard = cards[idMatchIndex];
  } else if (wordInDeckIndex !== -1) {
    const existing = cards[wordInDeckIndex];
    cards[wordInDeckIndex] = {
      ...existing,
      ...cardData,
      id: existing.id,
      word: wordKey,
      deckId: targetDeckId,
      updatedAt: now,
      srs: existing.srs || defaultSrs
    };
    savedCard = cards[wordInDeckIndex];
  } else {
    savedCard = {
      id: cardData.id || generateId('card'),
      deckId: targetDeckId,
      word: wordKey,
      reading: (cardData.reading || '').trim(),
      hanviet: (cardData.hanviet || '').trim(),
      meaning: (cardData.meaning || cardData.meaningVi || '').trim(),
      meaningVi: (cardData.meaningVi || cardData.meaning || '').trim(),
      pos: cardData.pos || 'Từ vựng',
      example: cardData.example || '',
      exampleMeaning: cardData.exampleMeaning || '',
      notes: cardData.notes || '',
      isStarred: !!cardData.isStarred,
      createdAt: now,
      updatedAt: now,
      srs: cardData.srs ? { ...defaultSrs, ...cardData.srs } : defaultSrs
    };
    cards.unshift(savedCard);
  }

  await saveAllCards(cards);

  // Đồng bộ sửa đổi sang savedWords nếu từ này có trong savedWords (giữ dữ liệu nhất quán)
  try {
    const savedWords = await getSavedWords();
    const targetW = savedWords.find(w => (w.kanji === wordKey || w.word === wordKey));
    if (targetW) {
      if (cardData.reading) targetW.reading = cardData.reading.trim();
      if (cardData.hanviet) targetW.hanviet = cardData.hanviet.trim();
      if (cardData.meaning || cardData.meaningVi) {
        targetW.meaning = (cardData.meaning || cardData.meaningVi).trim();
        targetW.meaningVi = (cardData.meaning || cardData.meaningVi).trim();
      }
      await new Promise(r => chrome.storage.local.set({ [STORAGE_KEY]: savedWords }, r));
    }
  } catch (e) {}

  broadcastDataChange('card_saved', { card: savedCard });
  return cards;
}

async function deleteCard(cardId) {
  let cards = await getAllCards();
  const toDelete = cards.find(c => c.id === cardId);
  cards = cards.filter(c => c.id !== cardId);
  await saveAllCards(cards);
  broadcastDataChange('card_deleted', { cardId, card: toDelete });
  return true;
}

/**
 * Đánh dấu sao / Bỏ đánh dấu sao cho thẻ và tự động đồng bộ trạng thái sao với danh sách Từ đã lưu
 */
async function toggleStarCard(cardId) {
  const cards = await getAllCards();
  const card = cards.find(c => c.id === cardId);
  if (!card) return false;
  card.isStarred = !card.isStarred;
  card.updatedAt = Date.now();
  await saveAllCards(cards);

  // Đồng bộ với danh sách từ đã lưu (savedWords)
  try {
    const savedWords = await getSavedWords();
    const wordKey = card.word;
    const targetWord = savedWords.find(w => (w.kanji === wordKey || w.word === wordKey));

    if (card.isStarred && !targetWord) {
      // Nếu gắn sao và chưa có trong savedWords: thêm vào Từ đã lưu
      await saveWord({
        kanji: wordKey,
        word: wordKey,
        reading: card.reading || '',
        hanviet: card.hanviet || '',
        meaning: card.meaning || '',
        meaningVi: card.meaning || '',
        folder: 'Mặc định',
        isStarred: true
      }, 'Mặc định');
    } else if (!card.isStarred && targetWord) {
      // Nếu bỏ sao: gỡ khỏi danh sách từ đã lưu
      await deleteWord(wordKey);
    }
  } catch (e) {
    console.warn('[Storage] Lỗi đồng bộ sao với savedWords:', e);
  }

  broadcastDataChange('card_starred', { cardId, isStarred: card.isStarred });
  return card.isStarred;
}

/**
 * Đánh giá mức độ ghi nhớ theo thuật toán Spaced Repetition (SRS)
 * Rating:
 * 1 = Chưa thuộc (Again)
 * 2 = Khó nhớ (Hard)
 * 3 = Đã nhớ (Good)
 * 4 = Dễ nhớ (Easy)
 */
async function rateCardSrs(cardId, rating) {
  const cards = await getAllCards();
  const card = cards.find(c => c.id === cardId);
  if (!card) return null;

  const now = Date.now();
  let srs = card.srs || {
    interval: 0,
    repetition: 0,
    easeFactor: 2.5,
    dueDate: now,
    state: 'new',
    lastReviewed: null
  };

  let newInterval = srs.interval || 0;
  let newRepetition = srs.repetition || 0;
  let newEaseFactor = srs.easeFactor || 2.5;
  let newState = 'learning';

  switch (rating) {
    case 1: // Again (Chưa thuộc)
      newRepetition = 0;
      newInterval = 0;
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
      newState = 'learning';
      break;
    case 2: // Hard (Khó nhớ)
      newRepetition = Math.max(1, newRepetition);
      newInterval = newInterval === 0 ? 1 : Math.round(newInterval * 1.2);
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.15);
      newState = 'learning';
      break;
    case 3: // Good (Đã nhớ)
      newRepetition += 1;
      if (newRepetition === 1) {
        newInterval = 1;
      } else if (newRepetition === 2) {
        newInterval = 3;
      } else {
        newInterval = Math.round(newInterval * newEaseFactor);
      }
      newState = newInterval >= 21 ? 'mastered' : 'review';
      break;
    case 4: // Easy (Dễ nhớ)
      newRepetition += 1;
      newEaseFactor += 0.15;
      if (newRepetition === 1) {
        newInterval = 4;
      } else {
        newInterval = Math.round(newInterval * newEaseFactor * 1.3);
      }
      newState = newInterval >= 21 ? 'mastered' : 'review';
      break;
  }

  const dueOffsetMs = newInterval === 0 ? (10 * 60 * 1000) : (newInterval * 24 * 60 * 60 * 1000);
  const newDueDate = now + dueOffsetMs;

  card.srs = {
    interval: newInterval,
    repetition: newRepetition,
    easeFactor: parseFloat(newEaseFactor.toFixed(2)),
    dueDate: newDueDate,
    state: newState,
    lastReviewed: now
  };
  card.updatedAt = now;

  await saveAllCards(cards);
  await recordReviewHistory(cardId, rating);
  return card;
}

async function recordReviewHistory(cardId, rating) {
  return new Promise((resolve) => {
    chrome.storage.local.get([REVIEW_STATS_KEY], (res) => {
      const stats = res[REVIEW_STATS_KEY] || {
        totalReviews: 0,
        streakDays: 1,
        lastReviewDate: null,
        history: []
      };

      const todayStr = new Date().toISOString().slice(0, 10);
      if (stats.lastReviewDate) {
        const lastDateStr = new Date(stats.lastReviewDate).toISOString().slice(0, 10);
        if (todayStr !== lastDateStr) {
          const diffDays = Math.round((new Date(todayStr) - new Date(lastDateStr)) / (86400000));
          if (diffDays === 1) {
            stats.streakDays += 1;
          } else if (diffDays > 1) {
            stats.streakDays = 1;
          }
        }
      }

      stats.totalReviews += 1;
      stats.lastReviewDate = Date.now();
      stats.history.unshift({
        cardId: cardId,
        rating: rating,
        timestamp: Date.now()
      });

      if (stats.history.length > 500) {
        stats.history = stats.history.slice(0, 500);
      }

      chrome.storage.local.set({ [REVIEW_STATS_KEY]: stats }, () => resolve(stats));
    });
  });
}

async function getDueCards(deckId) {
  const cards = await getCardsByDeck(deckId);
  const now = Date.now();
  return cards.filter(c => !c.srs || !c.srs.dueDate || c.srs.dueDate <= now);
}

/**
 * Đồng bộ hóa dữ liệu từ vựng cũ (savedWords) sang hệ thống Flashcards
 */
async function syncSavedWordsWithCards() {
  const savedWords = await getSavedWords();
  const decks = await getDecks();
  const allCards = await getAllCards();
  let updated = false;

  const folderToDeckMap = {};
  decks.forEach(d => {
    folderToDeckMap[d.name] = d.id;
  });

  savedWords.forEach(w => {
    const wordKey = w.kanji || w.word;
    const exists = allCards.some(c => c.word === wordKey);
    if (!exists) {
      let targetDeckId = folderToDeckMap[w.folder] || 'deck_default';
      allCards.unshift({
        id: generateId('card'),
        deckId: targetDeckId,
        word: wordKey,
        reading: w.reading || '',
        hanviet: w.hanviet || '',
        meaning: w.meaningVi || w.meaning || 'Từ vựng tiếng Nhật',
        meaningVi: w.meaningVi || w.meaning || 'Từ vựng tiếng Nhật',
        pos: w.pos || 'Từ vựng',
        example: '',
        exampleMeaning: '',
        notes: '',
        isStarred: false,
        createdAt: w.addedAt || Date.now(),
        updatedAt: Date.now(),
        srs: {
          interval: 0,
          repetition: 0,
          easeFactor: 2.5,
          dueDate: Date.now(),
          state: 'new',
          lastReviewed: null
        }
      });
      updated = true;
    }
  });

  if (updated) {
    await saveAllCards(allCards);
    console.log('[JP-Dict Storage] Đã đồng bộ toàn bộ từ đã lưu sang Flashcard Cards.');
  }
}

// ========================================================
// 5. IMPORT & EXPORT FLASHCARD DECKS (UNIFIED JSON & CSV)
// ========================================================

/**
 * Xuất dữ liệu bộ thẻ sang JSON theo định dạng chuẩn thống nhất (Unified JSON Schema v1)
 * Định dạng chuẩn cấu trúc lồng nhau (decks có chứa cards) theo yêu cầu hệ thống:
 * {
 *   version: 1,
 *   app: "JP Dictionary & Flashcards",
 *   exportedAt: "...",
 *   type: "full_backup" | "single_deck",
 *   decks: [
 *     { id, name, description, color, cards: [ { word, reading, hanviet, meaning, example, exampleMeaning, srs } ] }
 *   ]
 * }
 * Đồng thời duy trì mảng phẳng 'cards' ở cấp gốc để bảo đảm 100% tương thích ngược với các phiên bản cũ.
 *
 * @param {string} deckId ID bộ thẻ hoặc '__all__' nếu xuất toàn bộ
 * @returns {Promise<string>} Chuỗi JSON chuẩn hóa
 */
async function exportDecksToJson(deckId = '__all__') {
  const decks = await getDecks();
  const cards = await getAllCards();

  let exportDecks = decks;
  let exportCards = cards;

  if (deckId !== '__all__') {
    exportDecks = decks.filter(d => d.id === deckId);
    exportCards = cards.filter(c => c.deckId === deckId);
  }

  // Định dạng chuẩn thống nhất (Unified v1): Mỗi bộ thẻ có thuộc tính .cards lồng bên trong
  const structuredDecks = exportDecks.map(d => {
    const deckCards = exportCards.filter(c => c.deckId === d.id);
    return {
      id: d.id,
      name: d.name,
      description: d.description || '',
      color: d.color || '#0284c7',
      createdAt: d.createdAt || Date.now(),
      updatedAt: d.updatedAt || Date.now(),
      cards: deckCards.map(c => ({
        id: c.id,
        word: c.word || c.kanji || '',
        reading: c.reading || c.kana || '',
        hanviet: c.hanviet || '',
        meaning: c.meaning || c.meaningVi || '',
        pos: c.pos || 'Từ vựng',
        example: c.example || '',
        exampleMeaning: c.exampleMeaning || '',
        notes: c.notes || '',
        isStarred: !!c.isStarred,
        createdAt: c.createdAt || Date.now(),
        updatedAt: c.updatedAt || Date.now(),
        srs: c.srs || {
          interval: 0,
          repetition: 0,
          easeFactor: 2.5,
          dueDate: Date.now(),
          state: 'new',
          lastReviewed: null
        }
      }))
    };
  });

  const exportPayload = {
    version: 1,
    app: 'JP Dictionary & Flashcards',
    exportedAt: new Date().toISOString(),
    type: deckId === '__all__' ? 'full_backup' : 'single_deck',
    decks: structuredDecks,
    // Duy trì mảng cards cấp gốc cho tương thích ngược
    cards: exportCards
  };

  // Nếu xuất 1 bộ thẻ cụ thể, đính kèm thêm thuộc tính deck cấp gốc
  if (deckId !== '__all__' && structuredDecks.length === 1) {
    exportPayload.deck = structuredDecks[0];
  }

  return JSON.stringify(exportPayload, null, 2);
}

// Alias cho exportAllDecksAndCardsJson
const exportAllDecksAndCardsJson = exportDecksToJson;

/**
 * Xuất danh sách từ vựng theo chuẩn 6 trường cho AI Prompt
 */
async function exportDeckWordsStandardJson(deckId = '__all__') {
  const cards = await getAllCards();
  let targetCards = cards;
  if (deckId !== '__all__') {
    targetCards = cards.filter(c => c.deckId === deckId);
  }

  const standardList = targetCards.map(c => ({
    word: c.word || c.kanji || '',
    reading: c.reading || '',
    hanviet: c.hanviet || '',
    meaning: c.meaning || c.meaningVi || '',
    example: c.example || '',
    exampleMeaning: c.exampleMeaning || ''
  }));

  return JSON.stringify(standardList, null, 2);
}

/**
 * Xuất từ đã lưu sang định dạng CSV (hỗ trợ Excel với UTF-8 BOM)
 */
async function exportSavedWordsToCsv(folderFilter = '__all__') {
  const words = await getSavedWords();
  let filtered = words;
  if (folderFilter !== '__all__') {
    filtered = words.filter(w => (w.folder || 'Mặc định') === folderFilter);
  }

  if (filtered.length === 0) {
    return null;
  }

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = ['word', 'reading', 'hanviet', 'meaning', 'folder', 'example', 'exampleMeaning'];
  const rows = [headers.join(',')];

  filtered.forEach(w => {
    const row = [
      escapeCsv(w.kanji || w.word || ''),
      escapeCsv(w.reading || w.kana || ''),
      escapeCsv(w.hanviet || ''),
      escapeCsv(w.meaning || w.meaningVi || ''),
      escapeCsv(w.folder || 'Mặc định'),
      escapeCsv(w.example || ''),
      escapeCsv(w.exampleMeaning || '')
    ];
    rows.push(row.join(','));
  });

  // Ký tự UTF-8 BOM (\uFEFF) giúp Excel trên Windows đọc tiếng Việt chính xác 100%
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Phân tích và nhận diện cấu trúc file JSON trước khi nhập
 * Hỗ trợ nhận diện tự động:
 * 1. Bản sao lưu đầy đủ Unified v1: { decks: [ { id, name, cards: [...] } ] }
 * 2. Một bộ thẻ đơn lẻ: { id, name, cards: [...] } hoặc { deck: { ... } }
 * 3. Bản sao lưu phẳng Legacy/v4: { decks: [...], cards: [...] }
 * 4. Mảng nhiều bộ thẻ: [ { name, cards: [...] }, ... ]
 * 5. Mảng từ vựng chuẩn AI 6 trường: [ { word, reading, hanviet, meaning, ... }, ... ]
 * 6. Mảng/Đối tượng từ đã lưu legacy: { savedWords: [...] }
 *
 * @param {string} jsonString
 * @returns {object} Kết quả phân tích { valid, error, type, typeLabel, decksCount, cardsCount, deckNames, normalizedDecks }
 */
function analyzeImportJson(jsonString) {
  if (!jsonString || !jsonString.trim()) {
    return { valid: false, error: 'File rỗng hoặc không có dữ liệu JSON.' };
  }

  let cleanStr = jsonString.trim();
  // Bỏ qua markdown code fence nếu người dùng copy từ AI
  if (cleanStr.startsWith('```')) {
    cleanStr = cleanStr.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let data;
  try {
    data = JSON.parse(cleanStr);
  } catch (err) {
    return {
      valid: false,
      error: `Cú pháp JSON không hợp lệ: ${err.message}. Vui lòng kiểm tra lại dấu phẩy hoặc ngoặc kép.`
    };
  }

  const normalizeCard = (c, defaultDeckId = 'deck_default') => {
    const word = (c.word || c.kanji || '').trim();
    if (!word) return null;
    return {
      id: c.id || generateId('card'),
      deckId: c.deckId || defaultDeckId,
      word: word,
      reading: (c.reading || c.kana || '').trim(),
      hanviet: (c.hanviet || '').trim(),
      meaning: (c.meaning || c.meaningVi || 'Chưa rõ nghĩa').trim(),
      meaningVi: (c.meaningVi || c.meaning || 'Chưa rõ nghĩa').trim(),
      pos: c.pos || 'Từ vựng',
      example: (c.example || '').trim(),
      exampleMeaning: (c.exampleMeaning || '').trim(),
      notes: c.notes || '',
      isStarred: !!c.isStarred,
      createdAt: c.createdAt || Date.now(),
      updatedAt: c.updatedAt || Date.now(),
      srs: c.srs || {
        interval: 0,
        repetition: 0,
        easeFactor: 2.5,
        dueDate: Date.now(),
        state: 'new',
        lastReviewed: null
      }
    };
  };

  const normalizedDecks = [];

  // TRƯỜNG HỢP 1: Object chứa data.decks (Unified v1 hoặc Flat backup)
  if (typeof data === 'object' && data !== null && Array.isArray(data.decks)) {
    const rootCards = Array.isArray(data.cards) ? data.cards : [];

    data.decks.forEach(d => {
      const deckId = d.id || generateId('deck');
      const deckName = (d.name || 'Bộ thẻ mới').trim();
      const deckDesc = (d.description || '').trim();
      const deckColor = d.color || '#0284c7';

      // Lấy cards: hoặc lồng bên trong d.cards, hoặc từ mảng phẳng rootCards theo deckId
      let rawCards = [];
      if (Array.isArray(d.cards) && d.cards.length > 0) {
        rawCards = d.cards;
      } else if (rootCards.length > 0) {
        rawCards = rootCards.filter(c => c.deckId === d.id || c.deckId === deckId);
      }

      const validCards = rawCards.map(c => normalizeCard(c, deckId)).filter(Boolean);

      normalizedDecks.push({
        id: deckId,
        name: deckName,
        description: deckDesc,
        color: deckColor,
        createdAt: d.createdAt || Date.now(),
        updatedAt: d.updatedAt || Date.now(),
        cards: validCards
      });
    });

    // Nếu còn cards ở root mà chưa gán vào deck nào
    if (rootCards.length > 0) {
      const assignedIds = new Set(data.decks.map(d => d.id));
      const unassigned = rootCards.filter(c => !c.deckId || !assignedIds.has(c.deckId));
      if (unassigned.length > 0) {
        let defDeck = normalizedDecks.find(d => d.id === 'deck_default');
        if (!defDeck) {
          defDeck = {
            id: 'deck_default',
            name: 'Mặc định',
            description: 'Bộ thẻ từ vựng chung',
            color: '#0284c7',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            cards: []
          };
          normalizedDecks.unshift(defDeck);
        }
        unassigned.forEach(c => {
          const norm = normalizeCard(c, defDeck.id);
          if (norm) defDeck.cards.push(norm);
        });
      }
    }

    const totalCards = normalizedDecks.reduce((sum, d) => sum + d.cards.length, 0);
    return {
      valid: true,
      type: normalizedDecks.length > 1 ? 'full_backup' : 'single_deck',
      typeLabel: normalizedDecks.length > 1 ? 'Bản sao lưu toàn bộ hệ thống' : 'Một bộ thẻ hoàn chỉnh',
      decksCount: normalizedDecks.length,
      cardsCount: totalCards,
      deckNames: normalizedDecks.map(d => d.name),
      normalizedDecks
    };
  }

  // TRƯỜNG HỢP 2: Object là một bộ thẻ đơn lẻ có deck hoặc { id, name, cards: [...] }
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const singleDeckObj = data.deck || (data.name && Array.isArray(data.cards) ? data : null);
    if (singleDeckObj && (singleDeckObj.name || Array.isArray(singleDeckObj.cards))) {
      const deckId = singleDeckObj.id || generateId('deck');
      const deckName = (singleDeckObj.name || 'Bộ thẻ mới').trim();
      const rawCards = Array.isArray(singleDeckObj.cards) ? singleDeckObj.cards : [];
      const validCards = rawCards.map(c => normalizeCard(c, deckId)).filter(Boolean);

      normalizedDecks.push({
        id: deckId,
        name: deckName,
        description: singleDeckObj.description || '',
        color: singleDeckObj.color || '#0284c7',
        createdAt: singleDeckObj.createdAt || Date.now(),
        updatedAt: singleDeckObj.updatedAt || Date.now(),
        cards: validCards
      });

      return {
        valid: true,
        type: 'single_deck',
        typeLabel: `Một bộ thẻ (${deckName})`,
        decksCount: 1,
        cardsCount: validCards.length,
        deckNames: [deckName],
        normalizedDecks
      };
    }

    // Trường hợp legacy savedWords: { savedWords: [...] }
    if (Array.isArray(data.savedWords)) {
      const validCards = data.savedWords.map(c => normalizeCard(c, 'deck_default')).filter(Boolean);
      normalizedDecks.push({
        id: 'deck_default',
        name: 'Mặc định',
        description: 'Từ vựng đã lưu',
        color: '#0284c7',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        cards: validCards
      });
      return {
        valid: true,
        type: 'legacy_saved_words',
        typeLabel: 'Dữ liệu từ vựng đã lưu (Legacy)',
        decksCount: 1,
        cardsCount: validCards.length,
        deckNames: ['Mặc định'],
        normalizedDecks
      };
    }
  }

  // TRƯỜNG HỢP 3: Mảng (Array)
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { valid: false, error: 'Mảng JSON rỗng (không có dữ liệu thẻ nào).' };
    }

    // Kiểm tra xem đây là mảng các Bộ thẻ [ { name, cards: [...] }, ... ]
    const isArrayOfDecks = data.every(item => typeof item === 'object' && item !== null && (item.name || Array.isArray(item.cards)));
    if (isArrayOfDecks && data.some(item => Array.isArray(item.cards))) {
      data.forEach(item => {
        const deckId = item.id || generateId('deck');
        const deckName = (item.name || 'Bộ thẻ mới').trim();
        const rawCards = Array.isArray(item.cards) ? item.cards : [];
        const validCards = rawCards.map(c => normalizeCard(c, deckId)).filter(Boolean);

        normalizedDecks.push({
          id: deckId,
          name: deckName,
          description: item.description || '',
          color: item.color || '#0284c7',
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
          cards: validCards
        });
      });

      const totalCards = normalizedDecks.reduce((sum, d) => sum + d.cards.length, 0);
      return {
        valid: true,
        type: 'full_backup',
        typeLabel: 'Danh sách nhiều bộ thẻ',
        decksCount: normalizedDecks.length,
        cardsCount: totalCards,
        deckNames: normalizedDecks.map(d => d.name),
        normalizedDecks
      };
    }

    // Mảng các thẻ từ vựng chuẩn (6 trường AI hoặc từ vựng độc lập)
    const validCards = data.map(item => normalizeCard(item, 'deck_default')).filter(Boolean);
    if (validCards.length === 0) {
      return {
        valid: false,
        error: 'Các phần tử trong mảng không chứa trường từ vựng hợp lệ ("word" hoặc "kanji").'
      };
    }

    normalizedDecks.push({
      id: 'deck_default',
      name: 'Mặc định',
      description: 'Từ vựng nhập từ JSON',
      color: '#0284c7',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cards: validCards
    });

    return {
      valid: true,
      type: 'cards_array',
      typeLabel: `Mảng danh sách từ vựng (${validCards.length} từ)`,
      decksCount: 1,
      cardsCount: validCards.length,
      deckNames: ['Mặc định'],
      normalizedDecks
    };
  }

  return {
    valid: false,
    error: 'Định dạng JSON không được nhận diện. Cần mảng từ vựng [...] hoặc object sao lưu { version, decks, cards }.'
  };
}

/**
 * Nhập dữ liệu bộ thẻ từ JSON với khả năng phục hồi dữ liệu hoàn chỉnh
 * Bảo đảm:
 * 1. File JSON xuất bởi chính extension luôn nhập lại thành công 100% (Round-trip an toàn).
 * 2. Phục hồi đầy đủ bộ thẻ, từ vựng, cách đọc, Hán Việt, nghĩa, ví dụ, ghi chú và tiến độ SRS.
 * 3. Hỗ trợ nhập bổ sung, tạo mới hoặc gộp thẻ trùng lặp an toàn mà không làm mất dữ liệu hiện có.
 *
 * @param {string} jsonString Chuỗi JSON
 * @param {string|null} targetDeckId ID bộ thẻ đích (áp dụng khi nhập mảng từ vựng thuần)
 * @param {string|null} newDeckName Tên bộ thẻ mới (nếu chọn tạo mới)
 * @returns {Promise<object>} Kết quả nhập dữ liệu
 */
async function importDecksFromJson(jsonString, targetDeckId = null, newDeckName = null) {
  try {
    const analysis = analyzeImportJson(jsonString);
    if (!analysis.valid) {
      throw new Error(analysis.error);
    }

    const currentDecks = await getDecks();
    const currentCards = await getAllCards();

    let importedDecksCount = 0;
    let updatedDecksCount = 0;
    let importedCardsCount = 0;
    let updatedCardsCount = 0;

    // XỬ LÝ TRƯỜNG HỢP MẢNG TỪ VỰNG THUẦN (cards_array)
    // Người dùng có thể chỉ định bộ thẻ đích hoặc tạo bộ thẻ mới
    if (analysis.type === 'cards_array') {
      const cardsList = analysis.normalizedDecks[0].cards;
      let activeDeckId = targetDeckId;

      if (newDeckName && newDeckName.trim()) {
        const cleanName = newDeckName.trim();
        let existingDeck = currentDecks.find(d => d.name.toLowerCase() === cleanName.toLowerCase());
        if (existingDeck) {
          activeDeckId = existingDeck.id;
        } else {
          activeDeckId = generateId('deck');
          currentDecks.push({
            id: activeDeckId,
            name: cleanName,
            description: `Nhập từ file JSON (${cardsList.length} từ)`,
            color: '#0d9488',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          importedDecksCount++;
        }
      } else if (!activeDeckId || activeDeckId === '__default__') {
        activeDeckId = 'deck_default';
      }

      // Đảm bảo deck đích tồn tại trong currentDecks
      const targetDeckExists = currentDecks.some(d => d.id === activeDeckId);
      if (!targetDeckExists) {
        activeDeckId = 'deck_default';
      }

      cardsList.forEach(c => {
        const existingCard = currentCards.find(cc => cc.deckId === activeDeckId && cc.word.toLowerCase() === c.word.toLowerCase());
        if (existingCard) {
          // Cập nhật thông tin bổ sung nếu thẻ cũ còn thiếu
          if (!existingCard.reading && c.reading) existingCard.reading = c.reading;
          if (!existingCard.hanviet && c.hanviet) existingCard.hanviet = c.hanviet;
          if (!existingCard.meaning && c.meaning) existingCard.meaning = c.meaning;
          if (!existingCard.example && c.example) existingCard.example = c.example;
          if (!existingCard.exampleMeaning && c.exampleMeaning) existingCard.exampleMeaning = c.exampleMeaning;
          existingCard.updatedAt = Date.now();
          updatedCardsCount++;
        } else {
          currentCards.unshift({
            ...c,
            id: generateId('card'),
            deckId: activeDeckId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          importedCardsCount++;
        }
      });
    }

    // XỬ LÝ TRƯỜNG HỢP DỮ LIỆU CÓ CẤU TRÚC BỘ THẺ (Full backup, Single deck, Unified v1)
    else {
      analysis.normalizedDecks.forEach(importDeck => {
        // Tìm xem bộ thẻ này đã có trong hệ thống chưa (theo ID hoặc theo Tên)
        let matchedDeck = currentDecks.find(d => d.id === importDeck.id || d.name.toLowerCase() === importDeck.name.toLowerCase());
        let activeDeckId;

        if (matchedDeck) {
          activeDeckId = matchedDeck.id;
          if (!matchedDeck.description && importDeck.description) {
            matchedDeck.description = importDeck.description;
          }
          matchedDeck.updatedAt = Date.now();
          updatedDecksCount++;
        } else {
          activeDeckId = importDeck.id || generateId('deck');
          currentDecks.push({
            id: activeDeckId,
            name: importDeck.name,
            description: importDeck.description || '',
            color: importDeck.color || '#0284c7',
            createdAt: importDeck.createdAt || Date.now(),
            updatedAt: Date.now()
          });
          importedDecksCount++;
        }

        // Nhập các thẻ thuộc bộ thẻ này
        importDeck.cards.forEach(c => {
          const existingCard = currentCards.find(cc => cc.deckId === activeDeckId && cc.word.toLowerCase() === c.word.toLowerCase());
          if (existingCard) {
            // Cập nhật các trường còn thiếu hoặc ghi đè nếu thẻ nhập có nội dung phong phú hơn
            if (!existingCard.reading && c.reading) existingCard.reading = c.reading;
            if (!existingCard.hanviet && c.hanviet) existingCard.hanviet = c.hanviet;
            if ((!existingCard.meaning || existingCard.meaning === 'Chưa rõ nghĩa') && c.meaning) existingCard.meaning = c.meaning;
            if (!existingCard.example && c.example) existingCard.example = c.example;
            if (!existingCard.exampleMeaning && c.exampleMeaning) existingCard.exampleMeaning = c.exampleMeaning;
            if (c.srs && c.srs.repetition > (existingCard.srs ? existingCard.srs.repetition : 0)) {
              existingCard.srs = c.srs;
            }
            existingCard.updatedAt = Date.now();
            updatedCardsCount++;
          } else {
            currentCards.unshift({
              ...c,
              id: generateId('card'),
              deckId: activeDeckId,
              createdAt: c.createdAt || Date.now(),
              updatedAt: Date.now()
            });
            importedCardsCount++;
          }
        });
      });
    }

    await saveAllDecks(currentDecks);
    await saveAllCards(currentCards);
    await syncDeckFolders();

    // Đồng bộ thẻ đã nhập sang mục Từ đã lưu (savedWords)
    try {
      const savedWords = await getSavedWords();
      const deckMap = {};
      currentDecks.forEach(d => { deckMap[d.id] = d.name; });

      let wordsUpdated = false;
      currentCards.forEach(c => {
        const wordKey = c.word || c.kanji;
        if (!wordKey) return;
        const exists = savedWords.find(w => (w.kanji === wordKey || w.word === wordKey));
        const folderName = deckMap[c.deckId] || 'Mặc định';
        if (!exists) {
          savedWords.unshift({
            id: generateId('word'),
            kanji: wordKey,
            word: wordKey,
            reading: c.reading || '',
            hanviet: c.hanviet || '',
            meaning: c.meaning || c.meaningVi || 'Từ vựng tiếng Nhật',
            meaningVi: c.meaningVi || c.meaning || 'Từ vựng tiếng Nhật',
            folder: folderName,
            addedAt: c.createdAt || Date.now(),
            isStarred: !!c.isStarred
          });
          wordsUpdated = true;
        }
      });

      if (wordsUpdated) {
        await new Promise(r => chrome.storage.local.set({ [STORAGE_KEY]: savedWords }, r));
      }
    } catch (e) {
      console.warn('[Storage] Lỗi đồng bộ savedWords sau khi import JSON:', e);
    }

    broadcastDataChange('json_imported', {
      totalProcessed: importedCardsCount + updatedCardsCount
    });

    return {
      success: true,
      type: analysis.type,
      typeLabel: analysis.typeLabel,
      importedDecksCount,
      updatedDecksCount,
      importedCardsCount,
      updatedCardsCount,
      totalCardsProcessed: importedCardsCount + updatedCardsCount,
      deckNames: analysis.deckNames
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

// Alias cho importDecksAndCardsJson
const importDecksAndCardsJson = importDecksFromJson;

/**
 * Dọn dẹp an toàn các thẻ bị lưu nhầm vào "Mặc định" do lỗi logic cũ
 * Chỉ xử lý khi thỏa mãn ĐỒNG THỜI các điều kiện:
 * 1. Thẻ nằm trong 'deck_default'.
 * 2. Từ này đã có thẻ trong một bộ thẻ khác (custom deck).
 * 3. Bản ghi trong savedWords của từ này ghi rõ folder thuộc bộ thẻ khác (KHÔNG PHẢI "Mặc định").
 */
async function cleanupDuplicateDefaultCards() {
  try {
    const savedWords = await getSavedWords();
    const cards = await getAllCards();
    const decks = await getDecks();

    const nonDefaultWordsMap = new Map();
    savedWords.forEach(w => {
      const k = (w.kanji || w.word || '').trim();
      const f = (w.folder || '').trim();
      if (k && f && f !== 'Mặc định') {
        nonDefaultWordsMap.set(k, f);
      }
    });

    let removedCount = 0;
    const cleanedCards = cards.filter(c => {
      const wordKey = (c.word || c.kanji || '').trim();
      if (c.deckId === 'deck_default' && nonDefaultWordsMap.has(wordKey)) {
        const designatedFolder = nonDefaultWordsMap.get(wordKey);
        const designatedDeck = decks.find(d => d.name === designatedFolder);
        if (designatedDeck && designatedDeck.id !== 'deck_default') {
          const hasInDesignated = cards.some(other => 
            other.id !== c.id && 
            other.deckId === designatedDeck.id && 
            (other.word === wordKey || other.kanji === wordKey)
          );
          if (hasInDesignated) {
            removedCount++;
            return false; // Loại bỏ bản sao lưu nhầm vào deck_default
          }
        }
      }
      return true;
    });

    if (removedCount > 0) {
      await saveAllCards(cleanedCards);
      console.log(`[JPEX Storage] Đã dọn dẹp ${removedCount} bản sao lưu nhầm vào bộ thẻ Mặc định.`);
      broadcastDataChange('default_duplicates_cleaned', { count: removedCount });
    }
    return removedCount;
  } catch (err) {
    console.warn('[JPEX Storage] Lỗi cleanupDuplicateDefaultCards:', err);
    return 0;
  }
}

// Tự động kiểm tra và đồng bộ khi nạp storage.js
syncSavedWordsWithCards().then(() => cleanupDuplicateDefaultCards()).catch(() => {});
