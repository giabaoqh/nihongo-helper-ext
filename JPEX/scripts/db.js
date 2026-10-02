/**
 * JP Dictionary Chrome Extension - db.js
 * 
 * Lớp JPEXDatabase quản lý cơ sở dữ liệu IndexedDB của bộ từ điển offline.
 * Đảm bảo:
 * 1. Không bị giới hạn bộ nhớ 5MB (khác với chrome.storage).
 * 2. Đánh chỉ mục (Index) trên Kanji, Kana và Romaji để tìm kiếm siêu tốc.
 * 3. Hỗ trợ cơ chế cập nhật Delta và Lazy Loading (chia gói nhỏ) để không gây treo UI.
 */

class JPEXDatabase {
  constructor() {
    this.dbName = 'JPEX_DictionaryDB';
    this.dbVersion = 3; // Nâng cấp lên phiên bản 3 để cập nhật schema sạch sẽ cho tính năng AI Tutor
    this.db = null;
  }

  /**
   * Mở kết nối tới cơ sở dữ liệu IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('[JP-Dict DB] Mở cơ sở dữ liệu thất bại:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[JP-Dict DB] Kết nối cơ sở dữ liệu thành công.');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[JP-Dict DB] Phát hiện nâng cấp schema sang phiên bản mới...');

        // Xóa các bảng cũ nếu đã tồn tại để tránh xung đột cấu trúc cũ thiếu trường/chỉ mục
        if (db.objectStoreNames.contains('dictionary')) {
          db.deleteObjectStore('dictionary');
        }
        if (db.objectStoreNames.contains('metadata')) {
          db.deleteObjectStore('metadata');
        }

        // 1. Tạo lại Object Store cho bảng từ điển
        const dictStore = db.createObjectStore('dictionary', { keyPath: 'id', autoIncrement: true });
        
        // Tạo các chỉ mục phục vụ cho việc tìm kiếm đa tiêu chí
        dictStore.createIndex('kanji', 'kanji', { unique: false });
        dictStore.createIndex('kana', 'kana', { unique: false });
        dictStore.createIndex('romaji', 'romaji', { unique: false });
        console.log('[JP-Dict DB] Đã tạo store "dictionary" kèm chỉ mục.');

        // 2. Tạo lại Object Store lưu metadata
        db.createObjectStore('metadata', { keyPath: 'key' });
        console.log('[JP-Dict DB] Đã tạo store "metadata".');
      };
    });
  }

  /**
   * Lấy phiên bản dữ liệu từ điển hiện tại trong Metadata Store
   * @returns {Promise<number>} Phiên bản dữ liệu hiện có (mặc định 0 nếu trống)
   */
  getDatabaseVersion() {
    return new Promise((resolve) => {
      if (!this.db) return resolve(0);

      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('data_version');

      request.onsuccess = () => {
        resolve(request.result ? request.result.value : 0);
      };
      request.onerror = () => {
        resolve(0);
      };
    });
  }

  /**
   * Nhập dữ liệu theo đợt (chỉ dùng cho lazy loading) trong một Transaction
   * @param {Array} items Danh sách từ vựng cần lưu
   */
  insertBatch(items) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dictionary'], 'readwrite');
      const store = transaction.objectStore('dictionary');

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);

      items.forEach(item => {
        // Chuẩn hóa romaji/kana về dạng viết thường để việc tìm kiếm nhanh hơn
        if (item.romaji) item.romaji = item.romaji.toLowerCase();
        if (item.kana) item.kana = item.kana.toLowerCase();
        store.put(item);
      });
    });
  }

  /**
   * Hàm Lazy Loading (Tải lười) chia nhỏ mảng dữ liệu khổng lồ thành nhiều gói
   * chèn vào IndexedDB có giãn cách thời gian để tránh làm đơ/treo UI luồng chính.
   * @param {Array} allItems Toàn bộ từ vựng
   * @param {number} newVersion Phiên bản dữ liệu mới cần set
   */
  async initializeDictionary(allItems, newVersion) {
    console.log(`[JP-Dict DB] Bắt đầu quá trình nạp dữ liệu từ điển (phiên bản ${newVersion})...`);
    const chunkSize = 200; // Chèn mỗi lần 200 từ
    
    for (let i = 0; i < allItems.length; i += chunkSize) {
      const chunk = allItems.slice(i, i + chunkSize);
      await this.insertBatch(chunk);
      // Dừng nhẹ 10ms để nhường CPU cho các luồng xử lý UI khác
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const percent = Math.min(100, Math.round(((i + chunk.length) / allItems.length) * 100));
      console.log(`[JP-Dict DB] Tiến trình nạp dữ liệu: ${percent}%`);
    }

    // Cập nhật phiên bản dữ liệu vào bảng metadata
    const transaction = this.db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    await new Promise((resolve) => {
      const req = store.put({ key: 'data_version', value: newVersion });
      req.onsuccess = () => resolve();
    });

    console.log('[JP-Dict DB] Hoàn tất nạp dữ liệu từ điển.');
  }

  /**
   * Áp dụng bản cập nhật Delta (chỉ tải phần thay đổi)
   * Giúp tiết kiệm tối đa dung lượng tải về và bộ nhớ.
   * @param {Object} delta Gói delta chứa { version, inserts: [...], deletes: [...] }
   */
  async applyDeltaUpdate(delta) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['dictionary', 'metadata'], 'readwrite');
      const dictStore = transaction.objectStore('dictionary');
      const metaStore = transaction.objectStore('metadata');

      transaction.oncomplete = () => {
        console.log(`[JP-Dict DB] Đã cập nhật Delta thành công lên phiên bản dữ liệu ${delta.version}`);
        resolve();
      };

      transaction.onerror = (event) => {
        console.error('[JP-Dict DB] Giao dịch cập nhật Delta thất bại:', event.target.error);
        reject(event.target.error);
      };

      // 1. Thực hiện xóa các từ vựng chỉ định
      if (delta.deletes && delta.deletes.length > 0) {
        const kanjiIndex = dictStore.index('kanji');
        delta.deletes.forEach(kanjiToDelete => {
          // Truy quét kho lưu trữ thông qua Index Kanji để lấy ID chính
          const req = kanjiIndex.getKey(kanjiToDelete);
          req.onsuccess = () => {
            const id = req.result;
            if (id !== undefined) {
              dictStore.delete(id);
            }
          };
        });
      }

      // 2. Thực hiện thêm mới hoặc cập nhật đè
      if (delta.inserts && delta.inserts.length > 0) {
        const kanjiIndex = dictStore.index('kanji');
        delta.inserts.forEach(item => {
          if (item.romaji) item.romaji = item.romaji.toLowerCase();
          if (item.kana) item.kana = item.kana.toLowerCase();

          // Kiểm tra xem từ đã có ID chưa để cập nhật đè thay vì insert mới
          const req = kanjiIndex.getKey(item.kanji);
          req.onsuccess = () => {
            const id = req.result;
            if (id !== undefined) {
              item.id = id;
            }
            dictStore.put(item);
          };
        });
      }

      // 3. Ghi đè cập nhật phiên bản mới
      metaStore.put({ key: 'data_version', value: delta.version });
    });
  }

  /**
   * Quét và tìm kiếm tiền tố trên một chỉ mục cụ thể
   * @param {string} indexName Tên chỉ mục ('kanji', 'kana', 'romaji')
   * @param {string} query Từ khóa tìm kiếm
   * @returns {Promise<Array>}
   */
  searchIndex(indexName, query) {
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const index = store.index(indexName);
      
      // Prefix matching range
      const range = IDBKeyRange.bound(query, query + '\uffff', false, false);
      const request = index.openCursor(range);
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  }

  /**
   * Tìm kiếm theo nghĩa tiếng Việt (substring matching trên trường meaning)
   * @param {string} query Từ khóa tiếng Việt viết thường
   * @returns {Promise<Array>}
   */
  searchMeaning(query) {
    return new Promise((resolve) => {
      const transaction = this.db.transaction(['dictionary'], 'readonly');
      const store = transaction.objectStore('dictionary');
      const request = store.openCursor();
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const item = cursor.value;
          if (item.meaning && item.meaning.toLowerCase().includes(query)) {
            results.push(item);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  }

  /**
   * Hàm tìm kiếm từ điển tương thích ngược
   * @param {string} query Từ khóa người dùng nhập vào
   * @returns {Promise<Array>}
   */
  async searchDictionary(query) {
    return this.search(query);
  }

  /**
   * Tìm kiếm đa năng song song qua cả 4 trường chỉ mục (Kanji, Kana, Romaji, Vietnamese)
   * @param {string} queryStr Từ khóa người dùng nhập vào
   * @returns {Promise<Array>} Mảng chứa kết quả đã gộp và loại bỏ trùng lặp
   */
  async search(queryStr) {
    if (!this.db) {
      console.warn('[JP-Dict DB] Database chưa được khởi tạo.');
      return [];
    }

    const cleanQuery = queryStr.trim().toLowerCase();
    if (!cleanQuery) return [];

    console.time(`[JP-Dict DB] Quét tìm kiếm từ khóa: "${cleanQuery}"`);

    // Thực hiện truy vấn song song trên cả 4 tiêu chí để đạt hiệu năng tối đa
    const [kanjiResults, kanaResults, romajiResults, meaningResults] = await Promise.all([
      this.searchIndex('kanji', cleanQuery),
      this.searchIndex('kana', cleanQuery),
      this.searchIndex('romaji', cleanQuery),
      this.searchMeaning(cleanQuery)
    ]);

    // Gộp kết quả và loại bỏ các bản ghi trùng lặp thông qua Map (sử dụng kanji làm khóa)
    const merged = [...kanjiResults, ...kanaResults, ...romajiResults, ...meaningResults];
    const uniqueMap = new Map();
    merged.forEach(item => {
      uniqueMap.set(item.kanji, item);
    });

    const finalResults = Array.from(uniqueMap.values());
    console.timeEnd(`[JP-Dict DB] Quét tìm kiếm từ khóa: "${cleanQuery}"`);
    console.log(`[JP-Dict DB] Tìm thấy ${finalResults.length} kết quả.`);
    
    return finalResults;
  }

  /**
   * Tìm kiếm chính xác trên một chỉ mục cụ thể
   * @param {string} indexName Tên chỉ mục ('kanji', 'kana', 'romaji')
   * @param {string} query Giá trị cần so sánh chính xác
   * @returns {Promise<Array>}
   */
  searchExactIndex(indexName, query) {
    return new Promise((resolve) => {
      try {
        const transaction = this.db.transaction(['dictionary'], 'readonly');
        const store = transaction.objectStore('dictionary');
        const index = store.index(indexName);
        const request = index.getAll(query);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (err) {
        resolve([]);
      }
    });
  }

  /**
   * Tra cứu từ chính xác (Exact match) cho việc tra từ bôi đen tức thì
   * @param {string} text Từ tiếng Nhật cần tra
   * @returns {Promise<Object|null>}
   */
  async findExact(text) {
    if (!this.db || !text) return null;
    const clean = text.trim();
    const cleanLower = clean.toLowerCase();

    // 1. Thử tìm trên Kanji
    const kanjiMatches = await this.searchExactIndex('kanji', clean);
    if (kanjiMatches && kanjiMatches.length > 0) return kanjiMatches[0];

    // 2. Thử tìm trên Kana
    const kanaMatches = await this.searchExactIndex('kana', cleanLower);
    if (kanaMatches && kanaMatches.length > 0) return kanaMatches[0];

    // 3. Thử tìm trên Romaji
    const romajiMatches = await this.searchExactIndex('romaji', cleanLower);
    if (romajiMatches && romajiMatches.length > 0) return romajiMatches[0];

    return null;
  }
}
