# NHẬT KÝ PHÁT HIỆN & SỬA LỖI (BUG FIX LOG)
## Dự án: Nihongo Helper Extension

Tài liệu này ghi nhận toàn bộ các lỗi thực tế được phát hiện thông qua quá trình kiểm toán mã nguồn (code audit), kiểm tra tính toàn vẹn DOM và chạy bộ kiểm thử tự động, cùng với nguyên nhân gốc rễ, các tệp đã sửa đổi và ca kiểm thử hồi quy tương ứng.

---

### BUG-01: Sai lệch ID trường nhập dữ liệu trong Modal Thẻ từ vựng (DOM ID Mismatch)
- **Mức độ nghiêm trọng:** CRITICAL (P0)
- **Trạng thái:** ĐÃ SỬA VÀ VƯỢT QUA KIỂM THỬ HỒI QUY (FIXED & VERIFIED) ✅
- **Hiện tượng & Ảnh hưởng:**
  - Khi người dùng bấm "Thêm thẻ mới" hoặc "Chỉnh sửa thẻ" trong giao diện Workspace, thao tác gán hoặc đọc giá trị từ modal thẻ từ vựng thất bại.
  - Console ném ra ngoại lệ: `Uncaught TypeError: Cannot set properties of null (setting 'value')` hoặc `Cannot read properties of null (reading 'value')`.
  - Hậu quả: Người dùng không thể lưu bản dịch câu ví dụ hoặc làm vỡ luồng mở modal thêm thẻ.
- **Nguyên nhân gốc rễ:**
  - Trong tệp `JPEX/workspace.html` (dòng 1599), trường input bản dịch ví dụ được đặt ID theo dạng kebab-case: `id="card-form-example-meaning"`.
  - Trong tệp `JPEX/scripts/workspace.js` (dòng 1887, 1904, 1918), hàm JavaScript lại truy xuất theo dạng camelCase: `document.getElementById('card-form-exampleMeaning')`.
  - Do sai lệch tên ID, hàm `getElementById` trả về `null`, dẫn đến lỗi truy cập thuộc tính `.value` của đối tượng `null`.
- **Tệp đã chỉnh sửa:**
  1. `JPEX/workspace.html`: Đồng bộ ID trường input thành `id="card-form-exampleMeaning"`.
  2. `JPEX/scripts/workspace.js`: Bổ sung cơ chế truy xuất phòng vệ (defensive fallback) hỗ trợ cả hai biến thể ID `card-form-exampleMeaning` và `card-form-example-meaning` kèm kiểm tra null an toàn trước khi gán/đọc thuộc tính.
- **Kiểm thử hồi quy (Regression Test):**
  - Chạy `node scripts/check_dom_ids.js` và `test_master_qa_suite.js` (Phần A). Xác nhận 100% ID input modal khớp nhau và không còn bất kỳ lỗi runtime nào.

---

### BUG-02: Lệch pha đồng bộ Thư mục & Ví dụ khi cập nhật Thẻ Flashcard (`saveCard`)
- **Mức độ nghiêm trọng:** HIGH (P1)
- **Trạng thái:** ĐÃ SỬA VÀ VƯỢT QUA KIỂM THỬ HỒI QUY (FIXED & VERIFIED) ✅
- **Hiện tượng & Ảnh hưởng:**
  - Khi người dùng chỉnh sửa một thẻ Flashcard trong Workspace (thay đổi bộ thẻ `deckId`, sửa câu ví dụ `example` hoặc bản dịch ví dụ `exampleMeaning`), bản ghi tương ứng trong danh sách Từ đã lưu (`savedWords`) không được cập nhật thư mục mới hoặc nội dung ví dụ mới.
  - Khi quay trở lại popup hoặc tab "Từ đã lưu", từ vựng vẫn hiển thị ở thư mục cũ hoặc thiếu bản dịch câu ví dụ vừa cập nhật.
- **Nguyên nhân gốc rễ:**
  - Trong `JPEX/scripts/storage.js` hàm `saveCard(cardData)` (dòng 748-759), khối lệnh đồng bộ sang `savedWords` chỉ đồng bộ 3 trường: `reading`, `hanviet`, và `meaning`.
  - Hàm hoàn toàn bỏ qua việc tra cứu tên bộ thẻ từ `targetDeckId` để cập nhật `targetW.folder`, đồng thời không đồng bộ `cardData.example` và `cardData.exampleMeaning`.
- **Tệp đã chỉnh sửa:**
  - `JPEX/scripts/storage.js`: Trong hàm `saveCard`:
    - Bổ sung tra cứu danh sách decks để tìm tên bộ thẻ tương ứng với `targetDeckId` và cập nhật `targetW.folder = d.name`.
    - Bổ sung đồng bộ hai chiều cho `targetW.example` và `targetW.exampleMeaning`.
- **Kiểm thử hồi quy (Regression Test):**
  - Ca kiểm thử C4 trong `test_master_qa_suite.js`: Sửa nghĩa, câu ví dụ và bản dịch ví dụ của thẻ, sau đó kiểm tra trực tiếp bản ghi trong `savedWords` để xác thực tính đồng bộ 100%.

---

### BUG-03: Thư mục "ma" và Từ vựng mồ côi khi xóa Bộ thẻ tùy chỉnh (`deleteDeck`)
- **Mức độ nghiêm trọng:** HIGH (P1)
- **Trạng thái:** ĐÃ SỬA VÀ VƯỢT QUA KIỂM THỬ HỒI QUY (FIXED & VERIFIED) ✅
- **Hiện tượng & Ảnh hưởng:**
  - Khi người dùng xóa một bộ thẻ Flashcard tùy chỉnh trong Workspace, bộ thẻ biến mất khỏi danh sách `jpex_decks` nhưng tên thư mục đó vẫn còn tồn tại trong dropdown chọn thư mục (`savedFolders`).
  - Các từ vựng trong `savedWords` vốn thuộc về bộ thẻ đã xóa vẫn mang thuộc tính `folder` trỏ tới tên bộ thẻ không còn tồn tại (dữ liệu mồ côi - orphaned records).
- **Nguyên nhân gốc rễ:**
  - Hàm `deleteDeck(deckId)` trong `JPEX/scripts/storage.js` (dòng 604) chỉ lọc bỏ deck khỏi `jpex_decks` và lọc bỏ cards khỏi `jpex_cards`.
  - Hàm không thực hiện dọn dẹp tên thư mục trong khóa lưu trữ `savedFolders`, và không xử lý tái gán thư mục cho các từ vựng trong `savedWords`.
- **Tệp đã chỉnh sửa:**
  - `JPEX/scripts/storage.js`: Trong hàm `deleteDeck`:
    - Lấy thông tin `deckName` của bộ thẻ trước khi xóa.
    - Tự động lọc sạch `deckName` ra khỏi danh sách `savedFolders`.
    - Quét toàn bộ `savedWords`, phát hiện các từ thuộc `deckName` vừa xóa và tự động tái gán về thư mục `"Mặc định"`, bảo vệ dữ liệu từ vựng không bị mất.
- **Kiểm thử hồi quy (Regression Test):**
  - Ca kiểm thử C5 trong `test_master_qa_suite.js` và Suite 4 trong `test_all_fixes.js`: Kiểm tra xóa bộ thẻ tùy chỉnh, xác nhận `savedFolders` sạch sẽ và từ vựng tự động quay về "Mặc định".

---

### BUG-04: Cắt vụn từ ghép, từ mượn và cụm ngữ pháp tiếng Nhật (Analyzer Tokenization)
- **Mức độ nghiêm trọng:** HIGH (P1)
- **Trạng thái:** ĐÃ SỬA VÀ VƯỢT QUA KIỂM THỬ HỒI QUY (FIXED & VERIFIED) ✅
- **Hiện tượng & Ảnh hưởng:**
  - Các từ vựng viết bằng Hiragana như `さらに`, từ mượn lai chữ cái alphabet `eスポーツ`, và các mẫu ngữ pháp mở rộng như `待っているだけなので`, `不可能であるように思えるかもしれない` có nguy cơ bị bộ tách từ phân nhỏ thành từng chữ cái đơn lẻ (ví dụ: `さ` + `ら` + `に`).
  - Hậu quả: Người học không thể tra cứu được nghĩa chính xác của cụm từ, Furigana và phân tích cấu trúc ngữ pháp bị sai lệch.
- **Nguyên nhân gốc rễ:**
  - Thuật toán phân tích từ vựng đơn thuần dựa trên ranh giới loại ký tự (Hiragana/Katakana/Kanji) thay vì áp dụng cơ chế tham lam khớp tiền tố dài nhất (greedy longest-match) kèm bảng từ ghép và mẫu ngữ pháp ưu tiên.
- **Tệp đã chỉnh sửa:**
  - `JPEX/scripts/analyzer.js`: Cập nhật logic tiền xử lý và tách từ:
    - Bổ sung bảng từ vựng Hiragana cố định (Phó từ, Thán từ, Liên từ như `さらに`, `それから`, `ごめんなさい`).
    - Hỗ trợ chuỗi chữ cái Alphanumeric + Katakana (như `eスポーツ`, `Webサイト`).
    - Hỗ trợ nhận diện cụm động từ chia thể Te kèm trợ động từ và liên từ tiếp nối (`〜ているだけなので`, `〜ように思えるかもしれない`).
- **Kiểm thử hồi quy (Regression Test):**
  - Ca kiểm thử B1 trong `test_master_qa_suite.js` và `test_kana_tokenization.js`: Chạy trực tiếp 4 cụm từ hồi quy trọng yếu, kiểm tra surface, reading và bản dịch tiếng Việt tương ứng.

---

## Bảng Tổng hợp Trạng thái Sửa lỗi

| Mã Lỗi | Thành phần | Mô tả Lỗi | Mức độ | Trạng thái | Kiểm thử Hồi quy |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **BUG-01** | `workspace.html` & `workspace.js` | Lệch ID `card-form-exampleMeaning` gây lỗi null modal | CRITICAL | ĐÃ SỬA | Section A (DOM check) |
| **BUG-02** | `storage.js` (`saveCard`) | Không đồng bộ folder & ví dụ sang `savedWords` | HIGH | ĐÃ SỬA | Section C (Test C4) |
| **BUG-03** | `storage.js` (`deleteDeck`) | Không dọn dẹp folder và để lại từ vựng mồ côi | HIGH | ĐÃ SỬA | Section C (Test C5) |
| **BUG-04** | `analyzer.js` | Cắt vụn cụm từ `さらに`, `eスポーツ`, mẫu ngữ pháp | HIGH | ĐÃ SỬA | Section B (Test B1-B3) |
