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
  - `vocab/`: 7.811 từ vựng (N5: 674, N4: 630, N3: 1.659, N2: 1.778, N1: 3.070).
  - `kanji/`: 2.383 chữ Hán (N5: 84, N4: 169, N3: 387, N2: 398, N1: 1.345).
  - `grammar/`: 526 điểm ngữ pháp (N5: 81, N4: 98, N3: 101, N2: 123, N1: 123).
  - `meta.json`: Tóm tắt tổng số 10.720 mục, giấy phép CC BY-SA 4.0 và báo cáo chất lượng bản dịch.
- **Lưu trữ dữ liệu học tập cá nhân (`chrome.storage.local`):**
  - `savedWords`: Danh sách từ đã lưu của người dùng.
  - `savedFolders`: Danh sách thư mục phân loại.
  - `jpex_decks`: Danh sách bộ thẻ Flashcard tùy chỉnh.
  - `jpex_cards`: Các thẻ Flashcard mang thông số Spaced Repetition (SRS SM-2: interval, repetition, easeFactor, dueDate, state).
  - `jpex_review_stats`: Thống kê lịch sử ôn tập.

## 3. Hoàn thiện 100% Nghĩa Tiếng Việt cho Từ vựng JLPT N1–N5
- **Chỉ tiêu chất lượng:**
  - `missingVietnameseMeaningCount = 0` trên toàn bộ 7.811 mục từ vựng N1 đến N5.
  - 100% mục từ có nghĩa tiếng Việt xác thực, tự nhiên và giàu ngữ cảnh; loại bỏ triệt để mọi placeholder ("Chưa có nghĩa tiếng Việt", mảng rỗng, chuỗi tiếng Anh đơn thuần).
  - Đồng bộ cả 2 trường `meaning` và `meaningVi` để tương thích hoàn toàn với các script kiểm thử và các thành phần giao diện.
- **Nguồn dữ liệu dịch thuật đối chiếu tin cậy:**
  - **OpenJLPT & JMdict (EDRDG):** Dữ liệu chuẩn gốc phát âm, từ vựng và câu ví dụ (CC BY-SA 4.0).
  - **ODVP Japanese-Vietnamese Dictionary (JMdict Vietnamese Project):** 29 tập từ điển thuật ngữ Nhật - Việt công cộng (GPL / CC BY-SA 4.0) với hơn 93.400 định nghĩa tiếng Việt chuẩn.
  - **Từ điển Anh - Việt Hồ Ngọc Đức (Free Vietnamese Dictionary Project):** 103.097 mục từ đối chiếu nghĩa thuật ngữ ngoại lai, từ Katakana và từ mượn phương Tây.
  - **Bộ dữ liệu tinh chỉnh chuyên sâu (Curated Modular Mappings):** Rà soát các từ đồng âm dị nghĩa, động từ ghép, tính từ biến cách và thành ngữ tiếng Nhật.

## 4. Tái cấu trúc Giao diện: Hợp nhất JLPT vào Workspace
- **Gỡ bỏ tra cứu JLPT độc lập tại Popup:**
  - Loại bỏ tab `jlpt-tab`, chip danh mục trùng lặp và các hàm tìm kiếm JLPT độc lập khỏi `popup.html` và `popup.js`.
  - Giữ Popup tinh gọn, tối ưu tốc độ tra cứu từ điển nhanh và phân tích câu ngắn.
  - Bổ sung banner dẫn hướng trực quan: *"⛩️ Luyện thi JLPT N1–N5... Bấm để mở Không gian học tập toàn diện"*.
- **Workspace là điểm học tập JLPT duy nhất:**
  - Tích hợp trọn vẹn: Chọn cấp độ N1–N5, duyệt từ vựng theo bảng, tra cứu chữ Hán, học ngữ pháp, phiên Flashcard tức thì, quản lý tiến độ và thêm từ vào bộ thẻ cá nhân.

## 5. Cẩm nang Hướng dẫn Sử dụng In-App (Offline)
- **Vị trí tích hợp:**
  - Thêm menu **📖 Hướng dẫn sử dụng** trên thanh Sidebar Workspace.
  - Nút truy cập nhanh **📖 Hướng dẫn sử dụng** ngay tại Banner màn hình Tổng quan (Overview).
  - Nút chuyển hướng nhanh giữa các mục JLPT và Ôn tập SRS.
- **Nội dung 6 phần toàn diện (Phần A – F):**
  - **Phần A — Bắt đầu học:** Hướng dẫn mở Workspace, chọn cấp độ N1–N5, chọn danh mục (Từ vựng, Ngữ pháp, Chữ Hán) và khởi tạo phiên học.
  - **Phần B — Thêm từ vựng vào danh sách ôn tập:** Cách lưu từ vào danh sách yêu thích, thêm từ JLPT vào bộ thẻ cá nhân, kiểm tra xác nhận lưu thành công.
  - **Phần C — Sử dụng Flashcards:** Hướng dẫn cấu hình bộ thẻ, giao diện mặt trước thẻ, lật mặt sau xem nghĩa tiếng Việt & ví dụ, chấm điểm đánh giá và kết thúc phiên.
  - **Phần D — Ôn tập & Thuật toán SRS:** Cơ chế thuật toán Lặp lại ngắt quãng, hành vi nút *Chưa nhớ* (phím Z) và *Đã nhớ* (phím X), chu kỳ lặp (1-3-7-14-30-60 ngày) và lưu tự động ngoại tuyến.
  - **Phần E — Theo dõi tiến độ:** Giải thích ý nghĩa các trạng thái (Chưa học, Đang học, Đã thuộc, Thẻ đến hạn hôm nay), cách duy trì chuỗi học.
  - **Phần F — Nhập & Xuất dữ liệu cá nhân:** Cấu trúc 6 trường JSON chuẩn, công cụ tạo Prompt cho AI (ChatGPT/Claude), cơ chế bảo vệ chống ghi đè dữ liệu cũ.

## 6. Tối ưu Hiển thị Nghĩa Từ vựng & Cơ chế Mở rộng Đa tầng (Expandable Meanings)
- **Vấn đề giải quyết:** Các mục từ đa nghĩa phong phú (như `空く（あく）`, `青い`, `上げる`...) chứa khối lượng văn bản dịch lớn, các thuật ngữ chuyên ngành (điện học, hàng hải...) làm vỡ bố cục hàng và che khuất các cột thao tác.
- **Giải pháp triển khai:**
  - **Mặc định:** Trích xuất và hiển thị 1–3 nghĩa tiếng Việt quan trọng nhất phù hợp cấp độ JLPT (độ dài gọn gàng ~100–120 ký tự).
  - **Cơ chế mở rộng (Expandable Drawer):** Bấm nút `▶ Xem thêm (+N nghĩa)` để mở ngăn kéo xem toàn bộ nghĩa mở rộng, ngữ cảnh chuyên ngành và nghĩa gốc `[Gốc]` mà không phải tải lại trang.
  - **Nút thu gọn (`▼ Thu gọn nghĩa`):** Thu gọn lại tức thì khi cần.
  - **Bảo toàn 100% dữ liệu gốc:** Không xóa hoặc rút gọn dữ liệu trong tệp lưu trữ.
  - **Nhất quán toàn hệ thống:** Áp dụng đồng bộ cho Bảng từ vựng JLPT N1–N5, Từ đã lưu, Chi tiết bộ thẻ Flashcard, Thẻ đến hạn SRS Hub, Tra cứu từ điển và Quiz trắc nghiệm.

## 7. Nguồn gốc & Bản quyền (Attribution & Licenses)
- **OpenJLPT:** Bản quyền Evan Cavanaugh và cộng đồng (giấy phép CC BY-SA 4.0).
- **JMdict / KANJIDIC2:** Electronic Dictionary Research and Development Group (EDRDG - CC BY-SA 4.0).
- **ODVP Japanese - Vietnamese JMdict:** Bản dịch cộng đồng tiếng Việt (GPL / CC BY-SA 4.0).
- **Từ điển Anh - Việt:** Dự án Từ điển tiếng Việt miễn phí Hồ Ngọc Đức (Open Source / Free Documentation).
- **Tatoeba Project:** Câu ví dụ song ngữ (CC BY 2.0 FR).

## 8. Kiến trúc Kiểm thử Tự động & Đảm bảo Chất lượng (Automated QA Architecture)
- **Hệ thống Kiểm thử Ngoại tuyến (Repeatable & Offline):**
  - Cấu hình tiêu chuẩn qua `package.json` với lệnh `npm test` và `npm run test:all`.
  - Thực thi hoàn toàn trong môi trường bộ nhớ cô lập (`memoryStore` / mocks) bảo vệ tuyệt đối 100% dữ liệu người dùng thật (Zero Personal Data Mutation).
  - Không sử dụng API AI bên ngoài hay yêu cầu API key.
- **Master QA Test Suite (`test_master_qa_suite.js`):**
  - Bao quát 7 khối kiểm thử từ Khối A đến Khối G với 120 kiểm thử tự động đạt tỷ lệ 100% PASS.
  - Tích hợp 4 ca kiểm thử hồi quy trọng yếu cho bộ phân tích câu: `さらに`, `eスポーツ`, `待っているだけなので`, `不可能であるように思えるかもしれない`.
- **Bộ tài liệu QA chuẩn hóa:**
  - `TEST_PLAN.md`: Ma trận kiểm thử chi tiết, độ ưu tiên P0-P2 và tiêu chí chấp nhận.
  - `TEST_RESULTS.md`: Báo cáo số liệu thực tế, lệnh thực thi, thời gian chạy và giới hạn môi trường.
  - `BUG_FIX_LOG.md`: Nhật ký phát hiện lỗi, phân tích nguyên nhân gốc rễ và ca kiểm thử hồi quy cho BUG-01 đến BUG-04.


