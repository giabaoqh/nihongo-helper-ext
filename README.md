# 🌸 Nihongo Helper - Japanese Dictionary Chrome Extension (v4.0)

Tiện ích mở rộng học tiếng Nhật toàn diện, hoạt động **Offline-First**, cung cấp **Không gian làm việc Toàn màn hình (Full-Screen Workspace)**, hệ thống **Bộ thẻ Flashcard Lặp lại ngắt quãng (Spaced Repetition System - SRS)** theo phong cách Quizlet/Anki, **Sentence Analyzer 2 cột** chuyên sâu, **Chụp vùng màn hình dịch chữ (Manga / Screen OCR)**, bóc tách **Furigana toàn trang (157.886 từ vựng)** và hỗ trợ phát âm tiếng Nhật tự nhiên.

---

## 🚀 Kiến trúc giao diện mới (Version 4.0)

Hệ thống được tổ chức khoa học thành 3 thành phần trải nghiệm tách biệt:

### 1. ⚡ Quick Popup (Tra cứu nhanh & Cửa ngõ điều hướng)
* Popup nhỏ gọn trên thanh công cụ dành riêng cho các thao tác tra từ nhanh, xem nghĩa cơ bản và bật/tắt tính năng.
* Không còn hiển thị các trang chức năng phức tạp trong cửa sổ popup chật hẹp.
* Tích hợp các nút điều hướng nhanh mở thẳng Không gian làm việc toàn màn hình:
  * **📚 Từ điển & Thẻ nhớ:** Mở Workspace học tập và quản lý bộ thẻ trong tab riêng.
  * **🔍 Phân tích câu:** Mở Sentence Analyzer toàn màn hình.
  * **📸 Chụp dịch OCR:** Kích hoạt khoanh vùng ảnh/manga nhanh bằng phím tắt `Alt + S`.
  * **🃏 Ôn tập:** Mở thẳng chế độ Review Mode toàn màn hình.
  * **🔍 Tra cứu chi tiết:** Trên từng thẻ kết quả, nhấp để chuyển ngay sang Workspace tra cứu sâu.
* Cơ chế **Tái sử dụng Tab thông minh (Tab Reuse)**: Nếu tab Workspace hoặc Sentence Analyzer đã mở, hệ thống sẽ tự động chuyển focus đến tab đó mà không tạo thêm các tab trùng lặp.

### 2. 🧠 Sentence Analyzer — Full-Screen Workspace 2 Cột
* **Bố cục 2 cột toàn màn hình:**
  * **Cột trái:** Ô nhập câu với phím tắt `Ctrl + Enter`, các câu ví dụ mẫu và **Lịch sử phân tích gần đây** giúp tra cứu lại ngay với 1 cú click.
  * **Cột phải:** Khung tổng quan câu gốc, Furigana (có công tắc ẩn/hiện), bản dịch câu tiếng Việt, bảng phân tách token theo đúng thứ tự, giải nghĩa ngữ pháp, thể chia động từ (`baseForm`) và giải thích trợ từ.
* **Token Inspector (Bảng thanh tra từ):** Nhấp vào từng token để xem số nét Hán tự, âm Hán Việt, phát âm giọng Nhật, sao chép nhanh, tra cứu chi tiết và lưu trực tiếp vào Flashcard.

### 3. 📚 Dictionary & Flashcards — Full-Screen Workspace
Không gian trung tâm cho việc học tập, quản lý từ vựng và luyện phản xạ ghi nhớ:
* **Sidebar cố định & Responsive:**
  * **📊 Tổng quan (Overview):** Thống kê số lượng bộ thẻ, tổng số từ vựng, số thẻ đến hạn hôm nay (Due today) và chuỗi học tập (Streak).
  * **🗂️ Bộ thẻ Flashcard (Decks Manager):** Tạo bộ thẻ mới, sửa tên, mô tả, màu sắc nhận diện, nhân bản bộ thẻ, xóa bộ thẻ và xem số lượng thẻ cần ôn.
  * **📖 Tra cứu từ điển (Dictionary Search):** Tra cứu từ vựng ngoại tuyến kết hợp trực tuyến, hiển thị đầy đủ Hán tự, Furigana, âm Hán Việt, nghĩa tiếng Việt và nút thêm trực tiếp vào bộ thẻ mong muốn.
  * **⭐ Từ đã lưu (Saved Words):** Quản lý và lọc từ vựng theo thư mục, xuất CSV hỗ trợ Excel và liên thông 100% với Flashcards.
  * **📝 Kiểm tra trắc nghiệm (Quiz Mode):** Luyện phản xạ từ vựng với các câu hỏi 4 lựa chọn ngẫu nhiên từ bộ thẻ của bạn.
  * **📈 Thống kê tiến độ (SRS Stats):** Theo dõi số thẻ đã thuộc, số thẻ đang học và nhật ký các phiên ôn tập gần đây.
  * **⚙️ Cài đặt & Sao lưu:** Điều chỉnh tốc độ phát âm giọng đọc, sao lưu xuất/nhập toàn bộ dữ liệu dưới định dạng JSON an toàn.

---

## 🎴 Trải nghiệm Ôn tập Flashcard SRS (Review Mode)

Giao diện học tập tập trung cao độ, ẩn hoàn toàn sidebar và các yếu tố gây mất tập trung:
* **Sân khấu Flashcard 3D:** Hiệu ứng lật thẻ 3D mượt mà.
  * **Mặt trước:** Từ vựng / Chữ Kanji khổ lớn, tùy chọn bật/tắt Hiragana, nút phát âm.
  * **Mặt sau:** Cách đọc Kana, âm Hán Việt, nghĩa tiếng Việt, câu ví dụ có phiên âm, bản dịch và ghi chú cá nhân.
* **Đánh giá mức độ ghi nhớ 4 mức độ:**
  * `[1]` **Chưa thuộc** (Again): Đưa thẻ vào ôn lại ngay và reset chu kỳ ngắt quãng.
  * `[2]` **Khó nhớ** (Hard): Tăng nhẹ khoảng thời gian ngắt quãng.
  * `[3]` **Đã nhớ** (Good): Nhân hệ số khoảng thời gian chuẩn (Ease Factor).
  * `[4]` **Dễ nhớ** (Easy): Thưởng thêm thời gian và tăng hệ số dễ.
* **Điều khiển phím tắt toàn diện:**
  * Bấm `[Space]` để lật thẻ xem đáp án.
  * Bấm các phím số `[1]`, `[2]`, `[3]`, `[4]` để đánh giá mức độ nhớ.
  * Bấm `[Escape]` để tạm dừng và quay lại bộ thẻ.
* **Đồng bộ dữ liệu an toàn:** Dữ liệu ôn tập được lưu tự động ngay sau mỗi lần đánh giá, không bị mất khi tải lại trang hoặc đóng tab.

---

## ⌨️ Bảng phím tắt nhanh

| Thao tác | Phím tắt | Phạm vi | Mô tả |
| :--- | :---: | :---: | :--- |
| **Phân tích câu tiếng Nhật** | `Alt + A` | Mọi trang web | Mở Sentence Analyzer toàn màn hình và nạp câu được chọn |
| **Chụp dịch Manga / OCR** | `Alt + S` | Mọi trang web | Khoanh vùng chữ trên ảnh hoặc bóng thoại manga để tra từ |
| **Bật/Tắt Furigana toàn trang** | `Alt + F` | Mọi trang web | Chèn Hiragana trên đầu chữ Hán toàn trang web |
| **Hover tra nhanh** | `Shift` + Rê chuột | Mọi trang web | Mở bảng tra từ tức thì không cần bôi đen kéo chuột |
| **Lật thẻ Flashcard** | `Space` | Review Mode | Lật giữa mặt trước (từ vựng) và mặt sau (đáp án) |
| **Đánh giá thẻ SRS** | `1`, `2`, `3`, `4` | Review Mode | Đánh giá mức độ ghi nhớ từ Chưa thuộc đến Dễ nhớ |
| **Thoát / Hủy thao tác** | `ESC` | Toàn hệ thống | Hủy khoanh vùng OCR hoặc thoát chế độ ôn tập |

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

## 📄 Bản quyền & Giấy phép
Dự án được phát hành theo giấy phép [MIT License](LICENSE).
