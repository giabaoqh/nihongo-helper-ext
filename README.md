# 🌸 Nihongo Helper - Japanese Dictionary Chrome Extension

Tiện ích mở rộng tra cứu tiếng Nhật cao cấp, hoạt động **Offline-First**, hỗ trợ tra từ tức thì bằng phím tắt **Hover**, bóc tách **Hán tự - Hán Việt**, chèn **Furigana toàn trang (157.886 từ vựng)**, **Chụp vùng màn hình dịch chữ (Manga / Screen OCR)**, giao diện thuần Việt 100% và tích hợp **Flashcard (SRS)** & xuất file cho **Anki / Excel**.

---

## 🚀 Tính năng nổi bật

### 1. 🔍 Tra cứu siêu tốc & Mở khóa bôi đen
* **Hover tra từ (`Shift` + rê chuột):** Giữ phím `Shift` (hoặc `Alt`) và rê chuột qua từ vựng tiếng Nhật để mở bảng tra cứu tức thì mà không cần bôi đen kéo chuột.
* **Biểu tượng nổi thông minh:** Tự động nhận diện chữ tiếng Nhật khi quét chọn, hiển thị icon tròn tinh tế ngay cạnh con trỏ chuột.
* **Tự động mở khóa bôi đen:** Phá bỏ hoàn toàn các cơ chế chống copy/chống chọn chữ (`user-select: none`, `onselectstart`) trên mọi trang web.
* **Deconjugation & Tách trợ từ:** Tự động nhận diện thể nguyên mẫu khi từ vựng đã bị chia thì (như `食べました` $\rightarrow$ `食べる`, `行かない` $\rightarrow$ `行く`, `近くに` $\rightarrow$ `近い`).

### 2. 📸 Chụp vùng màn hình dịch chữ (Manga / Screen OCR)
* **Dịch truyện tranh & Ảnh chụp:** Bấm phím nóng **`Alt + S`** (hoặc nút **📸 Chụp dịch OCR** trên popup) và kéo chuột khoanh vùng bóng thoại truyện tranh, ảnh chụp hoặc phụ đề video để dịch ngay lập tức.
* **Nhận diện chữ Nhật đa hướng:** Tự động nhận diện cả chữ viết dọc và chữ viết ngang (Asian OCR Engine v2) và mở ngay bảng tra từ chi tiết.

### 3. 🈓 Tự động chèn Furigana toàn trang (`Alt + F`)
* **Kho từ vựng khổng lồ 157.886 từ ghép:** Bao phủ toàn bộ các cấp độ JLPT từ N5 đến N1 và JMDict, tự động gắn phiên âm Hiragana chuẩn xác 100% trên đầu chữ Hán (Kanji).
* **Phím tắt chuyển đổi tức thì:** Nhấn `Alt + F` để Bật/Tắt Furigana với thông báo Toast nhỏ gọn, bảo tồn 100% layout website.

### 4. 🎴 Giao diện Tooltip Dark Mode với 3 Tab (Thuần Việt 100%)
* **Tab [Từ vựng]:** Hiển thị Kanji, Hiragana, âm Hán Việt nổi bật, cấp độ JLPT, từ loại và giải nghĩa tiếng Việt chuẩn xác.
* **Tab [Hán tự]:** Chi tiết từng chữ Kanji trong từ, bao gồm: Âm Hán Việt, cách đọc On/Kun, số nét, bộ thủ và giải nghĩa từ 14.746 chữ Hán ngoại tuyến.
* **Tab [Dịch]:** Bản dịch câu và phân tích ngữ cảnh tự động.

### 5. ⭐ Quản lý Thư mục & Ôn tập Flashcard (SRS)
* **Lưu từ theo Thư mục tùy chỉnh:** Phân loại từ vựng theo chủ đề, cấp độ (N5, N4, N3, Manga, Công việc...).
* **Trình luyện tập Flashcard:** Lật thẻ thông minh để ghi nhớ mặt chữ, cách đọc và giải nghĩa.
* **Xuất file CSV cho Anki & Excel:** Xuất danh sách từ vựng chuẩn UTF-8 with BOM, tương thích tuyệt đối với Anki và Excel.

### 6. 🔊 Phát âm tiếng Nhật (Hybrid Audio)
* Ưu tiên giọng đọc Google TTS tự nhiên bản xứ.
* Tự động dự phòng sang Web Speech API (`speechSynthesis ja-JP`) khi ngoại tuyến.

---

## 📦 Hướng dẫn cài đặt lên Chrome / Edge / Brave / Cốc Cốc

1. Tải hoặc clone repository về máy tính:
   ```bash
   git clone https://github.com/giabaoqh/nihongo-helper-ext.git
   ```
2. Mở trình duyệt và truy cập trang quản lý tiện ích:
   * Chrome / Brave: `chrome://extensions/`
   * Edge: `edge://extensions/`
   * Cốc Cốc: `coccoc://extensions/`
3. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
4. Nhấn nút **Load unpacked (Tải tiện ích đã giải nén)**.
5. Chọn thư mục `JPEX` bên trong thư mục dự án vừa tải về.
6. Hoàn tất! Biểu tượng tiện ích sẽ xuất hiện trên thanh công cụ của bạn.

---

## ⌨️ Phím tắt nhanh

| Thao tác | Phím tắt | Mô tả |
| :--- | :---: | :--- |
| **Bật/Tắt Furigana** | `Alt + F` | Chèn phiên âm Hiragana trên đầu chữ Hán toàn trang |
| **Chụp dịch Manga / OCR** | `Alt + S` | Khoanh vùng chữ trên ảnh/truyện tranh để nhận diện và tra từ |
| **Hover tra nhanh** | `Shift` + Rê chuột | Rê chuột qua từ tiếng Nhật để mở bảng dịch tức thì |
| **Hủy thao tác OCR** | `ESC` | Thoát chế độ khoanh vùng chụp ảnh |

---

## 📄 Bản quyền & Giấy phép
Dự án được phát hành theo giấy phép [MIT License](LICENSE).
