# KẾ HOẠCH KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (AUTOMATED TEST PLAN)
## Dự án: Nihongo Helper Extension (JP Dictionary & Flashcards SRS)

---

## 1. Mục tiêu và Phạm vi Kiểm thử (Objectives & Scope)

### 1.1. Mục tiêu
Xây dựng một hệ thống kiểm thử tự động, lặp lại được (repeatable), phát hiện lỗi thực tế, sửa chữa triệt để và kiểm thử hồi quy (regression testing) nhằm đảm bảo tiện ích hoạt động ổn định 100% ngoại tuyến (offline-first), không lỗi cú pháp, không tham chiếu DOM null, bảo vệ tuyệt đối dữ liệu người dùng và đáp ứng toàn bộ tiêu chí kỹ thuật.

### 1.2. Nguyên tắc bất di bất dịch (Non-negotiables)
1. **Bảo toàn dữ liệu (Zero Data Loss):** Tuyệt đối không xóa, ghi đè hoặc làm hỏng dữ liệu từ vựng, bộ thẻ, thư mục, dấu trang và lịch sử ôn tập thật của người dùng. Mọi kiểm thử ghi/xóa dữ liệu phải thực thi trên môi trường bộ nhớ cô lập (`memoryStore` / mocks).
2. **Ngoại tuyến 100% (Offline-First):** Không tích hợp hay phụ thuộc vào bất kỳ API AI bên ngoài, API key, hay dịch vụ mạng bắt buộc nào.
3. **Trung thực về kết quả kiểm thử:** Không bao giờ tuyên bố một bài kiểm tra đạt (PASS) trừ khi nó đã thực sự được chạy và kiểm tra kết quả cụ thể trong console/terminal.
4. **Không thu hẹp tính năng:** Không xóa bỏ tính năng đang hoạt động chỉ để làm bài kiểm tra pass một cách giả tạo.
5. **Độc lập và có thể lặp lại:** Toàn bộ test suite có thể chạy lại bất cứ lúc nào thông qua lệnh tiêu chuẩn `npm test`.

---

## 2. Ma trận Kiểm thử & Ca kiểm thử Chi tiết (Test Matrix)

### Khối A: Khởi động Extension, Manifest V3 & Toàn vẹn DOM
- **Mức độ ưu tiên:** CRITICAL (P0)
- **Tiêu chí chấp nhận:**
  - `JPEX/manifest.json` tuân thủ Manifest V3 (`manifest_version: 3`).
  - Toàn bộ 4 kích thước icon (`icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`) tồn tại và kích thước hợp lệ.
  - Toàn bộ 8 tệp JavaScript cốt lõi (`background.js`, `content_script.js`, `storage.js`, `popup.js`, `workspace.js`, `analyzer.js`, `analyzer_ui.js`, `db.js`) vượt qua kiểm tra cú pháp VM Script.
  - Tất cả các DOM ID được gọi trong JavaScript đều tồn tại trong HTML tương ứng hoặc có cơ chế bọc kiểm tra null / fallback an toàn:
    - `workspace.html` vs `workspace.js` (Form thêm/sửa thẻ, nút lưu/hủy).
    - `popup.html` vs `popup.js` (Ô tìm kiếm, nút chuyển Workspace, bộ lọc thư mục).
    - `analyzer.html` vs `analyzer_ui.js` (Nút phân tích câu, bảng từ vựng).

### Khối B: Từ điển & Xử lý Văn bản Tiếng Nhật (Tokenizer & Sentence Analyzer)
- **Mức độ ưu tiên:** CRITICAL (P0)
- **Tiêu chí chấp nhận:**
  - Phân tích câu chính xác không cắt vụn các từ mang ý nghĩa hoàn chỉnh.
  - Vượt qua 4 ca hồi quy trọng yếu (Regression Test Cases):
    1. `さらに`: Phân tích thành 1 token duy nhất ("Hơn nữa, thêm nữa"), không bị chẻ thành `さ`, `ら`, `に`.
    2. `eスポーツ`: Nhận diện từ mượn lai chữ cái + Katakana, bảo toàn surface `eスポーツ` và reading `イースポーツ`.
    3. `待っているだけなので`: Phân tách chính xác cấu trúc động từ chia thể Te `待って` + trợ động từ `いる` + liên từ `だけ` + `なので`.
    4. `不可能であるように思えるかもしれない`: Phân tách chính xác cụm danh từ/tính từ `不可能`, cụm liên kết `ように思える` và mẫu ngữ pháp phỏng đoán `かもしれない`.
  - Kiểm thử câu chuẩn kết hợp Kanji, Hiragana, Katakana, số đếm và dấu câu (`昨日、友達と映画を見ました。`, `日本語を勉強しています。`, `本を3冊買いました。`).
  - Xử lý an toàn các trường hợp biên: Chuỗi rỗng `""`, chuỗi toàn khoảng trắng `"   "`, chuỗi toàn dấu câu `"。。。 、、、 ！？"`, chữ Hán hiếm ngoài từ điển thông dụng `"龘靐"`, và câu siêu dài (>500 ký tự trả về thông báo lỗi êm dịu, không crash).
  - Sinh mã HTML thẻ `<ruby>` và `<rt>` chuẩn xác để hiển thị Furigana.

### Khối C: Quản lý Từ vựng & Đồng bộ Hai chiều Storage
- **Mức độ ưu tiên:** HIGH (P1)
- **Tiêu chí chấp nhận:**
  - Thêm từ mới vào thư mục "Mặc định": Từ vựng được lưu vào `savedWords` đồng thời tạo thẻ Flashcard tương ứng trong `deck_default`.
  - Thêm từ mới vào thư mục tùy chỉnh (ví dụ "JLPT N3"): Thẻ Flashcard chỉ nằm trong deck "JLPT N3", tuyệt đối KHÔNG bị sao chép nhầm vào `deck_default`.
  - Di chuyển từ vựng giữa các thư mục (ví dụ từ "JLPT N3" sang "Kinh Tế"):
    - `savedWords` cập nhật `folder = "Kinh Tế"`.
    - Thẻ Flashcard chuyển sạch sẽ sang deck "Kinh Tế".
    - Bản sao ở deck cũ và `deck_default` được dọn sạch hoàn toàn, không tạo thẻ trùng lặp thừa (ghost cards).
  - Chỉnh sửa thẻ từ vựng trong Modal (`saveCard`):
    - Cập nhật nghĩa, ví dụ, bản dịch ví dụ trong `jpex_cards`.
    - Tự động đồng bộ các thay đổi (`meaning`, `example`, `exampleMeaning`, `folder`) sang `savedWords`.
  - Xóa bộ thẻ an toàn (`deleteDeck`):
    - Ngăn chặn tuyệt đối việc xóa bộ thẻ Mặc định hệ thống (`deck_default`).
    - Khi xóa bộ thẻ tùy chỉnh: Dọn dẹp tên thư mục trong `savedFolders`, chuyển các từ vựng thuộc bộ thẻ đó về thư mục "Mặc định", bảo toàn dữ liệu từ vựng không bị mất.

### Khối D: Thẻ nhớ Flashcard & Thuật toán Ôn tập SRS (SM-2)
- **Mức độ ưu tiên:** HIGH (P1)
- **Tiêu chí chấp nhận:**
  - Khởi tạo thẻ mới mang đầy đủ thông số SRS: `interval: 0`, `repetition: 0`, `easeFactor: 2.5`, `dueDate: Date.now()`, `state: 'new'`.
  - Chuyển trạng thái theo thuật toán SM-2:
    - Đánh giá *Đã nhớ (Good - 3)* lần 1: `interval = 1`, `repetition = 1`.
    - Đánh giá *Đã nhớ (Good - 3)* lần 2: `interval = 6`, `repetition = 2`.
    - Đánh giá *Chưa nhớ (Again - 1)*: `interval` reset về 1 ngày, `repetition` reset về 0, `easeFactor` giảm để ôn tập thường xuyên hơn.
  - Lọc chính xác các thẻ đến hạn ôn tập (`dueDate <= Date.now()`).
  - Hỗ trợ thao tác phím nóng (phím Z cho *Chưa nhớ*, phím X cho *Đã nhớ*).

### Khối E: Động cơ Xuất / Nhập Dữ liệu (Import & Export Engine)
- **Mức độ ưu tiên:** HIGH (P1)
- **Tiêu chí chấp nhận:**
  - **Single Deck JSON Export (`exportDecksToJson(deckId)`):** Xuất cấu trúc `version: 1`, `type: "single_deck"`, lồng mảng `cards` bên trong đối tượng bộ thẻ.
  - **Full Backup JSON Export (`exportDecksToJson('__all__')`):** Xuất toàn bộ các bộ thẻ và thẻ từ vựng (`type: "full_backup"`).
  - **Khôi phục Round-trip:** Nhập lại file sao lưu JSON khôi phục 100% dữ liệu, giữ nguyên vẹn âm Hán Việt, câu ví dụ, bản dịch ví dụ và lịch sử SRS (tính tương đương ngữ nghĩa hoàn hảo).
  - **Nhập JSON từ AI Prompt:** Tự động bóc tách khối Markdown code fence (````json ... ````), nhận diện mảng từ vựng 6 trường chuẩn AI (`word`, `reading`, `hanviet`, `meaning`, `example`, `exampleMeaning`) và nạp vào bộ thẻ chỉ định.
  - **Xuất CSV tương thích Excel:** Bắt đầu bằng byte UTF-8 BOM (`\uFEFF`), bao bọc chuỗi trong dấu nháy kép, đọc tiếng Việt không lỗi font trên Excel Windows.
  - **Xử lý file lỗi:** Bắt lỗi chính xác file rỗng, JSON sai cú pháp, schema không hợp lệ; đưa ra thông báo tiếng Việt rõ ràng và giữ nguyên vẹn 100% dữ liệu đang có (Zero Data Loss).

### Khối F: Thư viện JLPT N1–N5 & Trình bày Nghĩa Đa tầng
- **Mức độ ưu tiên:** HIGH (P1)
- **Tiêu chí chấp nhận:**
  - Cả 5 cấp độ N1–N5 có đầy đủ tệp dữ liệu tại `JPEX/data/jlpt/vocab/` và `JPEX/data/jlpt/`.
  - Tổng số lượng từ vựng đạt chính xác 7.811 mục từ (N5: 674, N4: 630, N3: 1.659, N2: 1.778, N1: 3.070).
  - 100% mục từ có nghĩa tiếng Việt đầy đủ (`totalMissingMeaning = 0`), không còn placeholder hay mảng rỗng.
  - Cơ chế hiển thị nghĩa thông minh (`formatExpandableMeaning`):
    - Trích xuất 1–3 nghĩa chính cho giao diện mặc định, chiều rộng tối đa 320px.
    - Cung cấp nút `▶ Xem thêm` mở rộng ngăn kéo xem chi tiết khi từ có nhiều nghĩa phụ/chuyên ngành.
    - Nút `▼ Thu gọn` để đóng lại nhanh chóng.
  - Tab tra cứu JLPT độc lập đã được gỡ bỏ khỏi Popup, tập trung toàn bộ trải nghiệm học JLPT vào Workspace.
  - Cẩm nang Hướng dẫn sử dụng In-App tiếng Việt đầy đủ 6 phân mục (Mục A đến Mục F).

### Khối G: Lưu trữ Bền vững & Cô lập An toàn
- **Mức độ ưu tiên:** MEDIUM (P2)
- **Tiêu chí chấp nhận:**
  - Kiểm thử tự động chạy 100% trên môi trường sandbox, không gọi runtime sống của extension.
  - Tương thích ngược với schema cũ: Nhận diện chính xác bản ghi cũ chỉ có trường `kanji` hoặc `kana`.

---

## 3. Lệnh Thực thi Kiểm thử Tiêu chuẩn
Người dùng và kỹ sư phát triển có thể lặp lại toàn bộ quá trình kiểm thử bất cứ lúc nào thông qua các lệnh:

```bash
# Chạy Master QA Suite toàn diện (120 kiểm thử)
npm test

# Hoặc chạy kiểm thử từng phân hệ chuyên biệt:
npm run test:master     # Chạy Master QA Suite (Sections A-G)
npm run test:sync       # Chạy kiểm thử đồng bộ thư mục & flashcard (20 tests)
npm run test:json       # Chạy kiểm thử xuất/nhập JSON & AI prompt (31 tests)
npm run test:analyzer   # Chạy kiểm thử bộ phân tích câu tiếng Nhật (65 tests)
npm run test:jlpt       # Chạy kiểm định dữ liệu 7.811 từ JLPT & Hướng dẫn (107 tests)
npm run test:expandable # Chạy kiểm thử tính năng thu gọn/mở rộng nghĩa (27 tests)

# Chạy TẤT CẢ các bộ kiểm thử tự động (Tổng cộng 382 tests):
npm run test:all
```
