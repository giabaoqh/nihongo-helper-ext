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

### 4. ⛩️ Thư viện Từ vựng JLPT N1–N5 Ngoại tuyến (OpenJLPT)
* Kho **7.811 từ vựng JLPT N1–N5** tích hợp cục bộ, hoạt động 100% offline không phụ thuộc internet hay API bên ngoài.
* **Số lượng từ theo cấp độ:**
  * **N5:** 674 từ
  * **N4:** 630 từ
  * **N3:** 1.659 từ
  * **N2:** 1.778 từ
  * **N1:** 3.070 từ
* **Chuẩn hóa thông tin chi tiết:**
  * Từ vựng gốc tiếng Nhật (Kanji/Kana) kèm ID ổn định theo mã băm SHA-1 của OpenJLPT.
  * Cách đọc Hiragana/Katakana chuẩn xác từ JMdict.
  * Âm Hán Việt được đối chiếu và gán tự động từ cơ sở dữ liệu 11.092 chữ Hán nội bộ của JPEX.
  * Nghĩa tiếng Anh chuẩn mực từ cộng đồng Jonathan Waller và JMdict.
  * Câu ví dụ song ngữ Nhật - Anh thực tế trích xuất từ kho ngữ liệu Tatoeba.
* **Tích hợp Flashcard & SRS:**
  * Duyệt theo từng cấp độ N1–N5, tìm kiếm tức thì theo Kanji, Kana, Hán Việt hoặc nghĩa.
  * Chọn một số từ hoặc chọn toàn bộ cấp độ để bắt đầu phiên Flashcard Quizlet-style ngay lập tức.
  * Tùy chọn thêm vào bộ thẻ hiện có hoặc tự động tạo các bộ thẻ theo chủ đề JLPT (VD: `JLPT N5`).
  * Theo dõi tiến độ học tập (Chưa học / Đang học / Đã thuộc) theo thời gian thực dựa trên thuật toán Spaced Repetition (SRS SM-2).

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

## 📄 Bản quyền & Nguồn dữ liệu

- **Mã nguồn dự án:** Phát hành theo giấy phép [MIT License](LICENSE).
- **Thư viện Từ vựng JLPT (N1–N5):** Tích hợp dữ liệu từ dự án mã nguồn mở [OpenJLPT](https://github.com/evanclan/OpenJLPT) bởi Evan Cavanaugh và các cộng tác viên, phát hành theo giấy phép **Creative Commons Attribution-ShareAlike 4.0 International ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/))**.
  - **Jonathan Waller's JLPT Resources** ([tanos.co.uk](https://www.tanos.co.uk/jlpt/) - CC BY): Danh sách phân loại cấp độ N1–N5 và nghĩa từ vựng tiếng Anh.
  - **JMdict & KANJIDIC2** ([EDRDG](https://www.edrdg.org/) - CC BY-SA 4.0): Chuẩn hóa cách đọc Kana, từ loại (`pos`) và Furigana.
  - **Tatoeba Project** ([tatoeba.org](https://tatoeba.org) - CC BY 2.0 FR): Câu ví dụ song ngữ Nhật - Anh kèm định danh câu (`tatoeba_id`).
  - **JPEX Kanji Database:** Cơ sở dữ liệu 11.092 mục từ Hán Việt chuẩn xác nội bộ, cho phép tra cứu và đối chiếu âm Hán Việt hoàn toàn ngoại tuyến.

---

## 📚 Tài liệu kỹ thuật chi tiết (`docs/`)

- [Kiến trúc & Bối cảnh dự án (Project Context)](docs/PROJECT_CONTEXT.md)
- [Danh sách tính năng & Hướng dẫn sử dụng (Features & Guide)](docs/FEATURES.md)
- [Kế hoạch kiểm thử tự động (Test Plan)](docs/TEST_PLAN.md)
- [Báo cáo kết quả kiểm thử (Test Results)](docs/TEST_RESULTS.md)
- [Nhật ký sửa lỗi hệ thống (Bug Fix Log)](docs/BUG_FIX_LOG.md)
- [Tiến độ & Nhật ký các mốc triển khai (Progress Log)](docs/PROGRESS.md)

### ⚠️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)
> Tổ chức kỳ thi JLPT (Japan Foundation và Japan Educational Exchanges and Services) **không phát hành** danh sách từ vựng hay Hán tự chính thức cho các cấp độ N1–N5 kể từ kỳ thi đổi mới năm 2010. Danh sách từ vựng trong tiện ích này dựa trên tiêu chuẩn cộng đồng uy tín của Jonathan Waller và OpenJLPT, là tài liệu hỗ trợ học tập tham khảo, **không tuyên bố là danh sách chính thức hoặc đầy đủ tuyệt đối** của kỳ thi JLPT thực tế.

