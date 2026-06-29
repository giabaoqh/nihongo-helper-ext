/**
 * JP Dictionary Chrome Extension - storage.js
 * 
 * Tiện ích quản lý lưu trữ dữ liệu từ vựng bằng chrome.storage.local.
 * Được nạp trước content_script.js và popup.js để dùng chung các hàm lưu từ.
 * Hỗ trợ phân nhóm từ vựng theo Thư mục tùy chỉnh.
 */

const STORAGE_KEY = 'savedWords';
const FOLDERS_KEY = 'savedFolders';

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
 * @param {string} folderName Tên thư mục mới cần tạo
 * @returns {Promise<Array>} Danh sách các thư mục mới sau khi thêm
 */
async function createFolder(folderName) {
  const folders = await getSavedFolders();
  const cleanName = folderName.trim();
  
  if (!cleanName || folders.includes(cleanName)) {
    return folders; // Tránh tạo trùng hoặc tên rỗng
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
 * Cập nhật thư mục cho một từ vựng cụ thể
 * @param {string} kanji Từ Kanji chính cần chuyển thư mục
 * @param {string} folderName Tên thư mục đích
 * @returns {Promise<Array>} Danh sách từ vựng mới sau khi cập nhật
 */
async function updateWordFolder(kanji, folderName) {
  const words = await getSavedWords();
  const updatedWords = words.map(w => {
    if (w.kanji === kanji) {
      w.folder = folderName;
    }
    return w;
  });
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: updatedWords }, () => {
      console.log(`[JP-Dict Storage] Đã chuyển từ "${kanji}" sang thư mục "${folderName}"`);
      resolve(updatedWords);
    });
  });
}

/**
 * Lưu một từ vựng mới vào bộ nhớ
 * @param {Object} wordObj Đối tượng từ vựng cần lưu
 * @param {string} folderName Thư mục muốn lưu vào (Mặc định là "Mặc định")
 * @returns {Promise<Array>} Danh sách từ vựng mới sau khi thêm
 */
async function saveWord(wordObj, folderName = "Mặc định") {
  const words = await getSavedWords();
  
  // Tránh lưu trùng lặp từ khóa chính
  const existsIndex = words.findIndex(w => w.kanji === wordObj.kanji);
  if (existsIndex !== -1) {
    // Nếu từ đã tồn tại, ta chỉ cập nhật thư mục của nó
    return updateWordFolder(wordObj.kanji, folderName);
  }
  
  // Thêm nhãn thời gian và gán thư mục
  wordObj.addedAt = Date.now();
  wordObj.folder = folderName;
  
  words.unshift(wordObj); // Thêm từ vào đầu mảng
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: words }, () => {
      console.log(`[JP-Dict Storage] Đã lưu từ "${wordObj.kanji}" vào thư mục "${folderName}"`);
      resolve(words);
    });
  });
}

/**
 * Xóa một từ vựng khỏi danh sách lưu trữ
 * @param {string} kanji Từ Kanji chính cần xóa
 * @returns {Promise<Array>} Danh sách từ vựng mới sau khi xóa
 */
async function deleteWord(kanji) {
  const words = await getSavedWords();
  const filteredWords = words.filter(w => w.kanji !== kanji);
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filteredWords }, () => {
      console.log('[JP-Dict Storage] Đã xóa từ thành công:', kanji);
      resolve(filteredWords);
    });
  });
}

/**
 * Kiểm tra xem một từ đã được lưu trước đó chưa
 * @param {string} kanji Từ Kanji chính cần kiểm tra
 * @returns {Promise<boolean>}
 */
async function isWordSaved(kanji) {
  const words = await getSavedWords();
  return words.some(w => w.kanji === kanji);
}

/**
 * Đổi tên thư mục lưu trữ
 * @param {string} oldName Tên cũ của thư mục
 * @param {string} newName Tên mới muốn đổi sang
 */
async function renameFolder(oldName, newName) {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();
  
  if (!cleanNew || cleanOld === cleanNew || cleanNew === "Mặc định") {
    return;
  }
  
  // 1. Cập nhật danh sách thư mục
  const folders = await getSavedFolders();
  const updatedFolders = folders.map(f => f === cleanOld ? cleanNew : f);
  
  // 2. Cập nhật thuộc tính folder của tất cả từ thuộc thư mục cũ
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
 * Xóa một thư mục lưu trữ (di chuyển từ vựng trong đó về thư mục "Mặc định")
 * @param {string} folderName Tên thư mục cần xóa
 */
async function deleteFolder(folderName) {
  const cleanName = folderName.trim();
  if (cleanName === "Mặc định") return; // Không cho phép xóa thư mục mặc định
  
  // 1. Loại bỏ thư mục khỏi danh sách
  const folders = await getSavedFolders();
  const filteredFolders = folders.filter(f => f !== cleanName);
  
  // 2. Di chuyển từ vựng cũ về thư mục "Mặc định"
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
      console.log(`[JP-Dict Storage] Đã xóa thư mục "${cleanName}". Các từ được đưa về thư mục "Mặc định".`);
      resolve();
    });
  });
}
