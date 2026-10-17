# Danh sách chức năng: JP Dictionary Extension

Tài liệu này tổng hợp toàn bộ các tính năng, kiến trúc kỹ thuật và hướng dẫn sử dụng của tiện ích mở rộng tra cứu tiếng Nhật cao cấp.

---

## 1. Tra cứu thông minh & Tôn trọng trải nghiệm đọc (Floating Dictionary)
* **Nhận diện tự động**: Tự động nhận diện chữ tiếng Nhật (Kanji, Hiragana, Katakana) khi bôi đen văn bản.
* **Biểu tượng kích hoạt nhanh (Floating Icon)**: Khi bôi đen, hiển thị biểu tượng tròn nhỏ gọn, tinh tế ngay cạnh vùng chọn. Bấm vào icon để mở bảng tra cứu tức thì.
* **Chế độ Tra cứu Hover (Shift + Rê chuột)**: Đọc lướt nhanh văn bản mà không cần thao tác bôi đen phức tạp: chỉ cần giữ phím **Shift** và rê chuột qua từ cần tra.
* **Tự động mở khóa bôi đen**: Tự động phá vỡ cơ chế chống copy / chống bôi đen (`user-select: none`) trên các website được bảo vệ.

---

## 2. Tự động chèn Furigana bằng Phím nóng (Furigana Hotkey)
* **Kho từ vựng khổng lồ (157.886 từ ghép)**: Tích hợp từ điển ngoại tuyến toàn diện bao phủ toàn bộ JLPT N5 đến N1 và JMDict, chèn phiên âm Hiragana chuẩn xác 100% ngay trên đầu chữ Hán (Kanji).
* **Phím nóng linh hoạt**: Nhấn phím nóng mặc định **`Alt + F`** trên bất kỳ trang web nào để Bật/Tắt Furigana toàn trang.
* **Giao diện sạch sẽ**: Không nút bấm thừa thãi che màn hình, hiển thị thông báo Toast nhỏ gọn khi chuyển đổi trạng thái (`🈓 Furigana: ĐÃ BẬT ✨` / `🈓 Furigana: ĐÃ TẮT`).
* **Bảo toàn DOM**: Thuật toán TreeWalker thông minh bảo tồn cấu trúc trang, không làm xáo trộn layout web.

---

## 3. Chụp vùng màn hình dịch chữ (Manga / Screen OCR) 📸✨
* **Dịch truyện tranh & Ảnh chụp**: Cho phép khoanh vùng bất kỳ đoạn chữ nào trong truyện tranh (Manga/Webtoon), ảnh chụp, canvas hoặc video để nhận diện chữ tiếng Nhật.
* **Cách sử dụng**:
  - **Cách 1 (Phím nóng)**: Nhấn **`Alt + S`** trên bàn phím.
  - **Cách 2 (Nút bấm)**: Mở popup extension và bấm nút **`📸 Chụp dịch OCR`** ở thanh tiêu đề trên cùng.
  - Sau khi kích hoạt, con trỏ chuột chuyển thành hình dấu thập `+`. Bạn chỉ cần **kéo chuột khoanh vùng hình chữ nhật** quanh bóng thoại hoặc chữ cần tra.
  - Nhấn phím **`ESC`** bất kỳ lúc nào để hủy bỏ.
* **Nhận diện chữ Nhật đa hướng**: Tự động nhận diện cả chữ viết dọc (truyện tranh truyền thống) và chữ viết ngang với độ chính xác cao.
* **Tự động mở bảng tra từ**: Sau khi nhận diện, hệ thống tự động bóc tách từ vựng, âm Hán Việt, phát âm và bản dịch tiếng Việt tương ứng ngay tại vị trí vừa khoanh vùng.

---

## 4. Tab Hán tự chi tiết (Kanji Breakdown)
* **Cách đọc Hiragana trực quan**: Mỗi chữ Hán hiển thị to rõ kèm toàn bộ cách đọc Hiragana (Onyomi & Kunyomi) ở ngay bên phải.
* **Âm Hán Việt & Bộ thủ**: Huy hiệu âm Hán Việt chuẩn xác, số nét vẽ và thông tin bộ thủ chi tiết kèm giải nghĩa tiếng Việt từ 14.746 Hán tự.

---

## 5. Câu ví dụ thực tế (Example Sentences)
* **Ví dụ ngữ cảnh**: Tự động lấy các câu ví dụ thực tế kèm cách đọc Hiragana và bản dịch tương ứng.
* **Học từ vựng theo văn cảnh**: Giúp hiểu rõ từ vựng được dùng trong đời sống thực tế ra sao.

---

## 6. Giao diện Co giãn linh hoạt (Dynamic Fit Popup)
* **Thiết kế Glassmorphism & Dark Mode**: Hiện đại, tinh tế, font chữ tối ưu chuẩn tiếng Nhật (Noto Sans JP / Outfit).
* **Thuần Việt 100%**: Bản dịch tập trung hoàn toàn vào tiếng Việt, loại bỏ các nút thừa thãi.

---

## 7. Quản lý Từ đã lưu & Flashcard (SRS)
* **Lưu từ 1-click**: Đánh dấu sao (☆ -> ★) để lưu từ vựng vào bộ nhớ cục bộ theo thư mục chủ đề.
* **Luyện tập lật thẻ**: Ôn tập phản xạ từ vựng bằng Flashcards trực quan ngay trên popup extension.
* **Xuất file CSV**: Dễ dàng xuất toàn bộ danh sách từ vựng đã lưu ra file CSV để mở bằng Excel hoặc các ứng dụng học tập khác (như Anki).
