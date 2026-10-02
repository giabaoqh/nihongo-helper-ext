# 🌸 Nihongo Helper - Japanese Dictionary Chrome Extension

Tiện ích mở rộng tra cứu tiếng Nhật cao cấp, hoạt động **Offline-First**, hỗ trợ tra từ tức thì bằng phím tắt **Hover**, bóc tách **Hán tự - Hán Việt**, **Deconjugation** tự động, song ngữ **Việt - Anh**, và tích hợp trình luyện tập **Flashcard (SRS)** & xuất file cho **Anki / Excel**.

---

## ✨ Tính năng nổi bật

### 1. 🔍 Tra cứu siêu tốc trên mọi trang web
* **Hover tra từ (`Shift` + rê chuột):** Giữ phím `Shift` (hoặc `Alt`) và rê chuột qua từ vựng tiếng Nhật để mở bảng tra cứu tức thì mà không cần bôi đen kéo chuột.
* **Tự động bôi đen (⚡ / 👆):** Tùy chọn thả chuột là hiện bảng dịch ngay hoặc hiện icon tròn `辞` để click mở.
* **Lọc Furigana thông minh:** Tự động loại bỏ thẻ `<rt>` và `<rp>` khi bôi đen trên các trang web có phiên âm furigana (như NHK Easy, Yomichan web).
* **Deconjugation & Tách trợ từ:** Tự động nhận diện thể nguyên mẫu khi từ vựng đã bị chia thì (như `食べました` $\rightarrow$ `食べる`, `近くに` $\rightarrow$ `近い`, `活動の` $\rightarrow$ `活動`).

### 2. 🗂️ Giao diện Tooltip Mazii Dark Mode với 3 Tab
* **Tab [Từ vựng]:** Hiển thị đa dạng cách đọc, Hán Việt, cấp độ JLPT, từ loại và giải nghĩa.
* **Tab [Hán tự]:** Hiển thị chi tiết từng chữ Kanji trong từ, bao gồm: Âm Hán Việt chuẩn, nghĩa Hán Việt, số nét và bộ thủ. Dữ liệu offline hơn 10.000 Hán tự.
* **Tab [Dịch]:** Bản dịch câu tự động hỗ trợ phân tích ngữ cảnh.

### 3. 🌐 Tùy chọn Ngôn ngữ dịch linh hoạt
* **Song ngữ Việt - Anh:** Hiển thị song song cả nghĩa Tiếng Việt (tag `VI`) và Tiếng Anh (tag `EN`).
* **Chỉ Tiếng Việt:** Tập trung hoàn toàn vào tiếng mẹ đẻ.
* **Chỉ Tiếng Anh:** Dành cho các bạn muốn học bằng tiếng Anh.
* Có thể chuyển đổi nhanh ngôn ngữ trực tiếp ngay dưới chân bảng Tooltip (`[Song ngữ] [Việt] [Anh]`) hoặc trong cài đặt Popup.

### 4. ⭐ Quản lý Thư mục & Ôn tập Flashcard (SRS)
* **Lưu từ theo Thư mục tùy chỉnh:** Phân loại từ vựng theo chủ đề, cấp độ (N5, N4, N3, Manga, Công việc...).
* **🃏 Trình luyện tập Flashcard:** Lật thẻ thông minh để ghi nhớ mặt chữ, cách đọc và giải nghĩa. Hỗ trợ thuật toán đẩy thẻ chưa thuộc về cuối lượt học để ôn lại.
* **📥 Xuất file CSV cho Anki & Excel:** Xuất danh sách từ vựng chuẩn UTF-8 with BOM, mở trên Excel không lỗi font và import thẳng vào Anki trên điện thoại.

### 5. 🔊 Phát âm tiếng Nhật (Hybrid Audio)
* Ưu tiên giọng đọc Google TTS tự nhiên bản xứ.
* Tự động dự phòng sang Web Speech API (`speechSynthesis ja-JP`) nếu website chặn tài nguyên ngoài hoặc khi ngoại tuyến.

---

## 🚀 Hướng dẫn cài đặt lên Chrome / Edge / Brave

1. Tải hoặc clone repository về máy tính:
   ```bash
   git clone https://github.com/giabaoqh/nihongo-helper-ext.git
   ```
2. Mở trình duyệt và truy cập trang quản lý tiện ích:
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
3. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
4. Nhấn nút **Load unpacked (Tải tiện ích đã giải nén)**.
5. Chọn thư mục `JPEX` bên trong thư mục dự án vừa tải về.
6. Hoàn tất! Biểu tượng tiện ích sẽ xuất hiện trên thanh công cụ của bạn.

---

## 🛠️ Cấu trúc thư mục

```
ExtensionJP/
├── README.md
├── .gitignore
└── JPEX/
    ├── manifest.json            # Manifest V3 cấu hình Extension
    ├── popup.html               # Giao diện Popup Dashboard
    ├── scripts/
    │   ├── background.js        # Service Worker xử lý tra cứu, deconjugation, dịch thuật
    │   ├── content_script.js    # Quản lý Tooltip nổi, hover tra từ, bóc tách text
    │   ├── storage.js           # Quản lý lưu trữ từ vựng, thư mục và cài đặt
    │   ├── popup.js             # Logic điều khiển Popup Dashboard, Flashcard, CSV Export
    │   └── db.js                # Quản lý IndexedDB offline database
    ├── styles/
    │   ├── popup.css            # Giao diện Popup, Flashcard và Dashboard
    │   └── theme.css            # Biến màu sắc, phông chữ và theme
    └── data/
        ├── core_dict.json       # Từ điển từ vựng cốt lõi ngoại tuyến
        ├── kanji_details.json   # Dữ liệu giải nghĩa, số nét, bộ thủ >10.000 Hán tự
        └── kanji_hanviet.json   # Bảng đối chiếu âm Hán Việt
```

---

## 📜 Giấy phép

Dự án được phát triển phục vụ mục đích học tập và nghiên cứu tiếng Nhật.
