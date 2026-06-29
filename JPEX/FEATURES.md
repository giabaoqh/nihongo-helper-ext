# Danh sách chức năng: JP Dictionary Extension with AI Tutor

Tài liệu này tổng hợp toàn bộ các tính năng, kiến trúc kỹ thuật và ưu điểm thiết kế UI/UX của bộ tiện ích mở rộng tra cứu tiếng Nhật cao cấp.

---

## 1. Tra cứu bôi đen thông minh (Floating Dictionary)
*   **Nhận diện tự động**: Tự động nhận diện chữ tiếng Nhật (Kanji, Hiragana, Katakana) ngay khi người dùng thả chuột kết thúc bôi đen văn bản trên bất kỳ trang web nào.
*   **Bong bóng kích hoạt nhanh (Floating Icon)**: Hiển thị một icon tròn `辞` nhỏ gọn, tinh tế cạnh vùng bôi đen. Thiết kế trễ nhẹ `50ms` để tính toán tọa độ chính xác, không gây cản trở trải nghiệm đọc thông thường.
*   **Công nghệ Shadow DOM cô lập**: Khi click vào icon, hệ thống hiển thị Tooltip thông tin dịch thuật được đóng gói bên trong Shadow DOM. Điều này ngăn chặn hoàn toàn việc CSS của trang web đang xem ghi đè hay làm hỏng giao diện của Tooltip.
*   **Nội dung tra cứu giàu thông tin**: Hiển thị đầy đủ chữ Kanji gốc, âm Hán Việt (từ Thi Viện), cách đọc (Furigana & Romaji), nhãn cấp độ JLPT, độ phổ biến, phân loại Từ loại tiếng Việt và nghĩa tiếng Việt chi tiết.

---

## 2. Tìm kiếm ngoại tuyến siêu tốc (Offline IndexedDB v3)
*   **Không giới hạn bộ nhớ**: Sử dụng IndexedDB làm bộ lưu trữ từ điển chính của trình duyệt thay vì `chrome.storage` (bị giới hạn 5MB), đảm bảo sức chứa hàng chục vạn từ vựng ngoại tuyến.
*   **Tải lười thông minh (Lazy Seeding)**: Khi mở extension lần đầu, dữ liệu từ vựng mẫu sẽ được nạp vào IndexedDB theo từng gói nhỏ (200 từ) cách nhau `10ms` để không gây nghẽn hoặc đóng băng UI trình duyệt.
*   **Tìm kiếm đa năng song song qua 4 chỉ mục**:
    *   Tìm theo chữ **Kanji** (Quét Index).
    *   Tìm theo cách đọc **Kana / Hiragana** (Quét Index).
    *   Tìm theo phiên âm **Romaji** (Quét Index).
    *   Tìm theo **Nghĩa tiếng Việt** (Quét so khớp chuỗi con bằng cursor).
*   **Cơ chế gõ phím Debounce (300ms)**: Tránh việc gửi liên tiếp nhiều truy vấn dữ liệu thừa khi người dùng đang nhập dở chữ, tăng tối đa hiệu năng.

---

## 3. Hệ thống Phát âm thanh thông minh (Hybrid Audio)
Tích hợp nút loa phát âm (**🔊**) trên cả Tooltip nổi trên trang web và các thẻ kết quả trên Dashboard:
*   **Ưu tiên phát âm tự nhiên**: Gọi **Google Translate TTS** để lấy giọng phát âm tiếng Nhật chuẩn bản xứ, ngữ điệu tự nhiên.
*   **Cơ chế dự phòng cục bộ (Offline Fallback)**: Nếu trang web có chính sách bảo mật CSP ngăn chặn tải âm thanh ngoài, hệ thống tự động bắt lỗi và chuyển hướng sang **Web Speech API (`speechSynthesis`)** có sẵn của Chrome. Đảm bảo tính năng phát âm hoạt động 100% trên mọi website và khi không có internet.

---

## 4. Trợ giảng ngữ pháp AI Tutor (Gemini Integration)
*   **Nút "Giải thích bằng AI"**: Tích hợp biểu tượng AI/lấp lánh trên Tooltip.
*   **Bảo mật API Key qua Google Apps Script (GAS) Proxy**: Yêu cầu dịch thuật và phân tích ngữ pháp sẽ được chuyển tiếp qua một Web App Apps Script trung gian do bạn sở hữu. API Key Gemini được lưu trữ an toàn trong Apps Script Project Properties, loại bỏ hoàn toàn nguy cơ bị lộ khóa API khi đóng gói Extension.
*   **Phân tích ngữ pháp chi tiết**: Trả về bản dịch tự nhiên, phân tích sâu các mẫu ngữ pháp chính có trong câu được bôi đen và liệt kê cách dùng bằng tiếng Việt.
*   **Lưu trữ cache AI**: Kết quả phân tích được lưu trữ tạm trong `chrome.storage.local` để hiển thị tức thì nếu bạn xem lại cùng một từ/câu, tiết kiệm lượt gọi API.

---

## 5. Dashboard Popup đa năng (Giao diện chính)
Giao diện Popup trên thanh công cụ của Chrome được thiết kế tối giản, hiện đại (công nghệ Glassmorphism, font chữ Outfit & Noto Sans JP):
*   **Thanh tìm kiếm offline**: Tìm kiếm tức thì trong IndexedDB của trình duyệt.
*   **Phân tách 3 Tab chức năng**:
    *   **[Tra cứu]**: Màn hình tìm kiếm đa năng và Empty State chào mừng thân thiện.
    *   **[Từ đã lưu]**: Hiển thị danh sách từ vựng đã bookmark. Cho phép xóa nhanh bằng nút thùng rác 🗑️ kèm hiệu ứng chuyển động mượt mà.
    *   **[Cài đặt]**: Quản lý cấu hình URL Web App Google Apps Script và theo dõi trạng thái dữ liệu ngoại tuyến.

---

## 6. Cơ chế đồng bộ dữ liệu Bookmark 2 chiều
*   Sử dụng `chrome.storage.local` làm kênh đồng bộ dữ liệu gọn nhẹ.
*   Khi bạn bấm nút Ngôi sao (☆ $\rightarrow$ ★) để lưu từ trên Tooltip khi đang lướt web, từ đó sẽ xuất hiện tức thì trong danh sách của tab **Từ đã lưu** trong Popup Dashboard và ngược lại.
