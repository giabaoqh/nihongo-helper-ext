# PROJECT CONTEXT: JP Dictionary Extension (Nihongo Helper)

## 1. Giới thiệu dự án
- **Tên dự án:** JP Dictionary Extension (Nihongo Helper)
- **Kiến trúc:** Chrome Extension Manifest V3 (Vanilla JS, HTML5, CSS3, IndexedDB / chrome.storage.local).
- **Mục tiêu:** Tiện ích toàn diện hỗ trợ người Việt Nam học tiếng Nhật: Tra cứu từ điển ngoại tuyến, phân tích câu thông minh (Sentence Analyzer), chụp dịch OCR Manga/Ảnh, luyện thi JLPT N1–N5 toàn diện và ôn tập ghi nhớ Flashcard bằng thuật toán Lặp lại ngắt quãng (SRS SM-2).

## 2. Hệ sinh thái dữ liệu & Lưu trữ
- **Dữ liệu từ điển & phân tích ngoại tuyến:**
  - `data/core_dict.json`: Từ điển cốt lõi tra cứu tức thì (tiếng Việt).
  - `data/kanji_details.json`: Thông tin chi tiết hơn 10.000 Hán tự (nghĩa tiếng Việt, bộ thủ, số nét, âm On/Kun).
  - `data/kanji_hanviet.json`: 11.092 mục từ Hán tự kèm âm Hán Việt chuẩn.
  - `data/compound_words.json`, `data/kanji_readings.json`: Dữ liệu phân tích ngữ pháp và Furigana.
- **Thư viện Luyện thi JLPT N1–N5 ngoại tuyến (`data/jlpt/`):**
  - `vocab/`: 7.811 từ vựng (N5: 674, N4: 630, N3: 1659, N2: 1778, N1: 3070).
  - `kanji/`: 2.383 chữ Hán (N5: 84, N4: 169, N3: 387, N2: 398, N1: 1345).
  - `grammar/`: 526 điểm ngữ pháp (N5: 81, N4: 98, N3: 101, N2: 123, N1: 123).
  - `meta.json`: Tóm tắt tổng số 10.720 mục, giấy phép CC BY-SA 4.0 và báo cáo chất lượng bản dịch.
- **Lưu trữ dữ liệu học tập cá nhân (`chrome.storage.local`):**
  - `savedWords`: Danh sách từ đã lưu của người dùng.
  - `savedFolders`: Danh sách thư mục phân loại.
  - `jpex_decks`: Danh sách bộ thẻ Flashcard tùy chỉnh.
  - `jpex_cards`: Các thẻ Flashcard mang thông số Spaced Repetition (SRS SM-2: interval, repetition, easeFactor, dueDate, state).
  - `jpex_review_stats`: Thống kê lịch sử ôn tập.

## 3. Chiến lược Bản địa hóa Tiếng Việt & Minh bạch Dữ liệu
- **Nguyên tắc cốt lõi:**
  - Tiếng Việt là ngôn ngữ giao diện và diễn giải chính. 100% nút bấm, nhãn, bộ lọc, hướng dẫn, thông báo và thông số thống kê đều là tiếng Việt tự nhiên có dấu chuẩn.
  - Tách bạch rõ ràng `meaningVi` (nghĩa tiếng Việt), `originalMeaning` (nghĩa tiếng Anh gốc tham khảo) và `translationStatus` (`verified`, `needs_review`, `missing`).
  - Không bịa đặt dữ liệu (Zero fabrication): Các từ chưa có nghĩa tiếng Việt được ghi rõ "Chưa có nghĩa tiếng Việt" và giữ nghĩa tiếng Anh gốc để tham khảo.
  - Chữ Hán (Kanji): 100% (2.383/2.383) có nghĩa tiếng Việt và 2.380 chữ có âm Hán Việt chuẩn xác.
  - Ngữ pháp (Grammar): 100% (526/526) có nghĩa tiếng Việt, cấu trúc và giải thích cách dùng. N5 & N4 được rà soát đối chiếu (`verified`), N3-N1 được chuẩn hóa cấu trúc (`needs_review`).

## 4. Giao diện & Tính năng Module JLPT trong Workspace
- **Cấp độ hỗ trợ:** N5, N4, N3, N2, N1 (N4 được làm nổi bật để truy cập thuận tiện; ghi nhớ cấp độ đã chọn trong localStorage).
- **6 Phân hệ con (Subviews):**
  1. `📖 Từ vựng (Vocabulary)`: Bảng từ vựng kèm lọc trạng thái học, lọc bản dịch, phân trang, chọn hàng loạt, nghe phát âm và thêm vào bộ thẻ.
  2. `📐 Ngữ pháp (Grammar)`: Danh sách thẻ ngữ pháp hiển thị cấu trúc, ý nghĩa, giải thích chi tiết và ví dụ song ngữ Nhật - Việt.
  3. `🈸 Chữ Hán (Kanji)`: Lưới thẻ chữ Hán hiển thị nét vẽ, âm Hán Việt (vàng kim), nghĩa tiếng Việt, Onyomi, Kunyomi và từ vựng ghép ví dụ.
  4. `🃏 Thẻ ghi nhớ & Ôn tập (Flashcards)`: Hub cấu hình phiên học theo cấp độ, loại kiến thức (Từ vựng, Ngữ pháp, Chữ Hán), phạm vi (đến hạn, mới, tất cả) và số lượng thẻ; liên kết trực tiếp với SRS.
  5. `📊 Tiến độ học (Progress Dashboard)`: Thống kê số lượng đã thuộc, đang học, đến hạn, thanh tiến độ 5 cấp độ và Báo cáo chất lượng bản dịch tiếng Việt minh bạch.
  6. `📥 Nhập giáo trình cá nhân (Import)`: Hỗ trợ tệp JSON và CSV, kiểm tra tính hợp lệ trước khi nhập, xem trước 10 dòng, phân loại theo Giáo trình / Bài học, không ghi đè dữ liệu cũ.

## 5. Nguồn gốc & Bản quyền (Attribution & Licenses)
- **OpenJLPT:** Bản quyền Evan Cavanaugh và cộng đồng (giấy phép CC BY-SA 4.0).
- **Jonathan Waller's JLPT Lists:** Phân bổ cấp độ cộng đồng (CC BY).
- **JMdict / KANJIDIC2:** Electronic Dictionary Research and Development Group (EDRDG - CC BY-SA 4.0).
- **Tatoeba Project:** Câu ví dụ song ngữ (CC BY 2.0 FR).
- **Tuyên bố quan trọng:** Dữ liệu JLPT là tài liệu tham khảo cộng đồng uy tín, không phải danh sách chính thức hay đầy đủ tuyệt đối của Japan Foundation / kỳ thi JLPT.
