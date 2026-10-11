/**
 * Japanese Sentence Analyzer Engine (Nihongo Helper Extension)
 * 
 * Bộ phân tích câu và hình thái học tiếng Nhật (Sentence Tokenizer & Morphological Analyzer)
 * - 100% Offline, hiệu năng cao (<1ms), không phụ thuộc thư viện nặng ngoài
 * - Tách câu thành các token tuần tự, bảo toàn 100% dấu câu, số và ký tự Latin
 * - Nhận diện thể chia động từ, tính từ (Deinflection: Masu, Te, Ta, Nai, Ba/Kereba, Nakereba)
 * - Nhận diện cấu trúc ngữ pháp và trợ từ (は, が, を, に, で, と, てから, なければならない...)
 * - Ánh xạ dạng từ điển (baseForm), cách đọc Kana, nghĩa tiếng Việt, vai trò ngữ pháp
 * - Tự động sinh phiên âm toàn câu (Hiragana) và HTML Furigana Ruby tag
 * - Hỗ trợ cả môi trường Browser Extension (Content Script, Popup, Tab) và Node.js (Testing)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SentenceAnalyzer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Bảng từ chỉ thị (Demonstratives)
  const DEMONSTRATIVES = {
    'この': { base: 'この', pos: 'Chỉ thị từ (Liên thể từ)', role: 'Bổ nghĩa cho danh từ đi liền sau (Gần người nói)', meaning: 'Này (cái ... này)' },
    'その': { base: 'その', pos: 'Chỉ thị từ (Liên thể từ)', role: 'Bổ nghĩa cho danh từ đi liền sau (Gần người nghe)', meaning: 'Đó (cái ... đó)' },
    'あの': { base: 'あの', pos: 'Chỉ thị từ (Liên thể từ)', role: 'Bổ nghĩa cho danh từ đi liền sau (Xa cả hai)', meaning: 'Kia (cái ... kia)' },
    'どの': { base: 'どの', pos: 'Từ nghi vấn (Liên thể từ)', role: 'Hỏi danh từ cụ thể', meaning: 'Nào (cái ... nào)' },
    'これ': { base: 'これ', pos: 'Đại từ chỉ thị', role: 'Chỉ vật gần người nói', meaning: 'Cái này' },
    'それ': { base: 'それ', pos: 'Đại từ chỉ thị', role: 'Chỉ vật gần người nghe', meaning: 'Cái đó' },
    'あれ': { base: 'あれ', pos: 'Đại từ chỉ thị', role: 'Chỉ vật xa cả hai', meaning: 'Cái kia' },
    'どれ': { base: 'どれ', pos: 'Đại từ nghi vấn', role: 'Hỏi vật trong nhóm', meaning: 'Cái nào' },
    'ここ': { base: 'ここ', pos: 'Đại từ chỉ nơi chốn', role: 'Chỉ địa điểm gần người nói', meaning: 'Ở đây, chỗ này' },
    'そこ': { base: 'そこ', pos: 'Đại từ chỉ nơi chốn', role: 'Chỉ địa điểm gần người nghe', meaning: 'Ở đó, chỗ đó' },
    'あそこ': { base: 'あそこ', pos: 'Đại từ chỉ nơi chốn', role: 'Chỉ địa điểm xa cả hai', meaning: 'Ở kia, đằng kia' },
    'どこ': { base: 'どこ', pos: 'Đại từ nghi vấn', role: 'Hỏi nơi chốn', meaning: 'Ở đâu' }
  };

  // Trợ động từ & Động từ bất quy tắc đặc thù (Suru, Iru, Naru, Kuru)
  const AUXILIARY_VERBS = {
    // Thể của する (Suru)
    'しました': { base: 'する', reading: 'しました', pos: 'Động từ', conj: 'Thể quá khứ lịch sự (ました)', role: 'Vị ngữ / Biểu thị hành động đã hoàn tất', meaning: 'Đã làm, đã thực hiện' },
    'します': { base: 'する', reading: 'します', pos: 'Động từ', conj: 'Thể lịch sự hiện tại (ます)', role: 'Vị ngữ / Biểu thị hành động', meaning: 'Làm, thực hiện' },
    'しません': { base: 'する', reading: 'しません', pos: 'Động từ', conj: 'Thể phủ định lịch sự (ません)', role: 'Vị ngữ / Phủ định hành động', meaning: 'Không làm' },
    'しませんでした': { base: 'する', reading: 'しませんでした', pos: 'Động từ', conj: 'Thể phủ định quá khứ (ませんでした)', role: 'Vị ngữ / Phủ định trong quá khứ', meaning: 'Đã không làm' },
    'して': { base: 'する', reading: 'して', pos: 'Động từ', conj: 'Thể Te (て) nối câu', role: 'Liên kết hành động / Bổ trợ động từ', meaning: 'Làm (và...)' },
    'した': { base: 'する', reading: 'した', pos: 'Động từ', conj: 'Thể Ta (た) quá khứ ngắn', role: 'Vị ngữ / Bổ nghĩa định ngữ', meaning: 'Đã làm' },
    'しない': { base: 'する', reading: 'しない', pos: 'Động từ', conj: 'Thể Nai (ない) phủ định ngắn', role: 'Phủ định hành động', meaning: 'Không làm' },
    'しなかった': { base: 'する', reading: 'しなかった', pos: 'Động từ', conj: 'Thể quá khứ phủ định ngắn', role: 'Đã không làm trong quá khứ', meaning: 'Đã không làm' },
    'できる': { base: 'できる', reading: 'できる', pos: 'Động từ khả năng', conj: 'Thể nguyên mẫu', role: 'Biểu thị năng lực / Khả năng', meaning: 'Có thể làm' },
    'できます': { base: 'できる', reading: 'できます', pos: 'Động từ khả năng', conj: 'Thể lịch sự hiện tại', role: 'Biểu thị khả năng lịch sự', meaning: 'Có thể làm' },
    'できません': { base: 'できる', reading: 'できません', pos: 'Động từ khả năng', conj: 'Thể phủ định khả năng', role: 'Không thể làm', meaning: 'Không thể' },

    // Thể của いる (Iru - Tiếp diễn / Tồn tại)
    'います': { base: 'いる', reading: 'います', pos: 'Trợ động từ / Động từ', conj: 'Thể lịch sự hiện tại (ます)', role: 'Biểu thị hành động đang tiếp diễn (~ている) hoặc tồn tại người/động vật', meaning: 'Đang (làm gì) / Có' },
    'いました': { base: 'いる', reading: 'いました', pos: 'Trợ động từ / Động từ', conj: 'Thể quá khứ lịch sự (ました)', role: 'Biểu thị tiếp diễn hoặc tồn tại trong quá khứ', meaning: 'Đã đang (làm gì) / Đã có' },
    'いません': { base: 'いる', reading: 'いません', pos: 'Trợ động từ / Động từ', conj: 'Thể phủ định lịch sự (ません)', role: 'Phủ định tiếp diễn hoặc tồn tại', meaning: 'Không đang (làm) / Không có' },
    'いませんでした': { base: 'いる', reading: 'いませんでした', pos: 'Trợ động từ / Động từ', conj: 'Thể phủ định quá khứ lịch sự', role: 'Đã không tiếp diễn trong quá khứ', meaning: 'Đã không có' },
    'いる': { base: 'いる', reading: 'いる', pos: 'Trợ động từ / Động từ', conj: 'Thể nguyên mẫu', role: 'Tiếp diễn (~ている) / Có mặt', meaning: 'Đang (làm gì) / Có' },
    'いた': { base: 'いる', reading: 'いた', pos: 'Trợ động từ / Động từ', conj: 'Thể Ta (た) quá khứ ngắn', role: 'Đã tiếp diễn / Đã có', meaning: 'Đã đang (làm) / Đã có' },

    // Thể của くる (Kuru - Đi đến / Hành động lại gần)
    'きました': { base: 'くる', reading: 'きました', pos: 'Động từ', conj: 'Thể quá khứ lịch sự', role: 'Vị ngữ / Diễn tả hành động đến', meaning: 'Đã đến' },
    'きます': { base: 'くる', reading: 'きます', pos: 'Động từ', conj: 'Thể lịch sự hiện tại', role: 'Diễn tả hành động đến', meaning: 'Đến' },
    'きて': { base: 'くる', reading: 'きて', pos: 'Động từ', conj: 'Thể Te (て) nối câu', role: 'Đến (và...) / Cụm hành động lại gần (~てくる)', meaning: 'Đến (và...)' },

    // Thể của なる (Naru - Trở thành / Cụm bắt buộc)
    'なりません': { base: 'なる', reading: 'なりません', pos: 'Động từ / Cụm ngữ pháp', conj: 'Thể phủ định lịch sự', role: 'Không được (dùng trong cấu trúc bắt buộc: 〜なければなりません)', meaning: 'Không được (Phải...)' },
    'ならない': { base: 'なる', reading: 'ならない', pos: 'Động từ / Cụm ngữ pháp', conj: 'Thể phủ định ngắn', role: 'Không được (dùng trong cấu trúc: 〜なければならない)', meaning: 'Không được (Phải...)' },
    'なります': { base: 'なる', reading: 'なります', pos: 'Động từ', conj: 'Thể lịch sự hiện tại', role: 'Biến đổi trạng thái', meaning: 'Trở nên, trở thành' },
    'なった': { base: 'なる', reading: 'なった', pos: 'Động từ', conj: 'Thể quá khứ ngắn', role: 'Đã biến đổi trạng thái', meaning: 'Đã trở nên, đã trở thành' }
  };

  // Bảng ngữ pháp & Trợ từ tiếng Nhật (Đa ký tự và Đơn ký tự)
  const GRAMMAR_AND_PARTICLES = {
    // Cụm ngữ pháp đa ký tự
    'てから': { pos: 'Cấu trúc ngữ pháp', role: 'Sau khi làm V1 thì làm V2 (Biểu thị trình tự trước sau)', meaning: 'Sau khi' },
    'てください': { pos: 'Cấu trúc ngữ pháp', role: 'Yêu cầu, nhờ vả đối phương một cách lịch sự', meaning: 'Xin hãy, vui lòng' },
    'てはいけない': { pos: 'Cấu trúc ngữ pháp', role: 'Cấm đoán không được làm gì', meaning: 'Không được phép' },
    'てもいい': { pos: 'Cấu trúc ngữ pháp', role: 'Cho phép được làm gì', meaning: 'Làm ... cũng được' },
    'について': { pos: 'Cấu trúc ngữ pháp', role: 'Về vấn đề / chủ đề nào đó', meaning: 'Về, liên quan tới' },
    'に対して': { pos: 'Cấu trúc ngữ pháp', role: 'Đối với đối tượng / Trái ngược với', meaning: 'Đối với' },
    'によると': { pos: 'Cấu trúc ngữ pháp', role: 'Theo nguồn thông tin nào đó', meaning: 'Theo như' },
    'でしょう': { pos: 'Trợ động từ', role: 'Phỏng đoán lịch sự', meaning: 'Có lẽ là, phải không' },
    'だろう': { pos: 'Trợ động từ', role: 'Phỏng đoán thân mật', meaning: 'Có lẽ là' },
    'でした': { pos: 'Trợ động từ', role: 'Khẳng định quá khứ lịch sự của です', meaning: 'Đã là' },
    'です': { pos: 'Trợ động từ', role: 'Hệ từ lịch sự (Copula)', meaning: 'Là, thì' },
    'だった': { pos: 'Trợ động từ', role: 'Khẳng định quá khứ thân mật của だ', meaning: 'Đã là' },
    'から': { pos: 'Trợ từ', role: 'Chỉ điểm xuất phát (từ đâu) hoặc nguyên nhân / lý do (vì)', meaning: 'Từ (nơi chốn/thời gian), vì' },
    'まで': { pos: 'Trợ từ', role: 'Chỉ giới hạn kết thúc của hành động / thời gian', meaning: 'Đến, cho đến' },
    'より': { pos: 'Trợ từ so sánh', role: 'Chỉ tiêu chuẩn so sánh (hơn so với cái gì)', meaning: 'Hơn, so với' },
    'など': { pos: 'Trợ từ liệt kê', role: 'Liệt kê không đầy đủ các ví dụ tiêu biểu', meaning: 'Như là, vân vân' },
    'だけ': { pos: 'Trợ từ giới hạn', role: 'Biểu thị sự giới hạn duy nhất', meaning: 'Chỉ, duy nhất' },
    'しか': { pos: 'Trợ từ giới hạn', role: 'Đi kèm vị ngữ phủ định để biểu thị chỉ có', meaning: 'Chỉ (không có cách nào ngoài)' },
    'ほど': { pos: 'Trợ từ so sánh/mức độ', role: 'Chỉ khoảng chừng hoặc mức độ tương đương', meaning: 'Khoảng, đến mức' },
    'ばかり': { pos: 'Trợ từ', role: 'Chỉ toàn là / vừa mới làm xong', meaning: 'Toàn là, vừa mới' },

    // Trợ từ đơn ký tự
    'は': { pos: 'Trợ từ chủ đề', role: 'Đánh dấu chủ đề chính của câu (Topic marker)', reading: 'わ', meaning: 'Thì, là (đánh dấu chủ đề)' },
    'が': { pos: 'Trợ từ chủ ngữ', role: 'Đánh dấu chủ ngữ ngữ pháp / đối tượng của cảm xúc, khả năng', reading: 'が', meaning: 'Chỉ chủ ngữ thực hiện / đối tượng' },
    'を': { pos: 'Trợ từ tân ngữ', role: 'Đánh dấu tân ngữ trực tiếp chịu tác động của tha động từ', reading: 'を', meaning: 'Chỉ đối tượng chịu tác động' },
    'に': { pos: 'Trợ từ', role: 'Chỉ thời điểm cụ thể, địa điểm đích đến, đối tượng tiếp nhận', reading: 'に', meaning: 'Vào lúc, ở (nơi đến), cho (ai)' },
    'で': { pos: 'Trợ từ', role: 'Chỉ nơi diễn ra hành động, phương tiện, phương pháp, nguyên nhân', reading: 'で', meaning: 'Tại (nơi làm), bằng (phương tiện), do' },
    'へ': { pos: 'Trợ từ phương hướng', role: 'Chỉ phương hướng di chuyển tới', reading: 'え', meaning: 'Về hướng, tới' },
    'と': { pos: 'Trợ từ liên kết / đối tượng', role: 'Chỉ đối tượng cùng thực hiện hành động, hoặc liên từ "và", hoặc trích dẫn', reading: 'と', meaning: 'Với (cùng ai); và; rằng' },
    'も': { pos: 'Trợ từ tương đồng', role: 'Biểu thị sự tương đồng (cũng) hoặc nhấn mạnh (đến cả)', reading: 'も', meaning: 'Cũng, đến cả' },
    'の': { pos: 'Trợ từ sở hữu / liên kết', role: 'Liên kết 2 danh từ (của, về, bằng), hoặc danh từ hóa mệnh đề', reading: 'の', meaning: 'Của, thuộc về' },
    'ね': { pos: 'Trợ từ cuối câu', role: 'Tìm kiếm sự đồng tình hoặc xác nhận nhẹ nhàng từ người nghe', reading: 'ね', meaning: 'Nhỉ, nhé' },
    'よ': { pos: 'Trợ từ cuối câu', role: 'Cung cấp thông tin mới hoặc khẳng định với người nghe', reading: 'よ', meaning: 'Đấy, nhé' },
    'か': { pos: 'Trợ từ nghi vấn', role: 'Đặt câu hỏi ở cuối câu', reading: 'か', meaning: 'Có phải không, chăng' },
    'だ': { pos: 'Trợ động từ', role: 'Hệ từ khẳng định thân mật (Copula)', reading: 'だ', meaning: 'Là' }
  };

  // Quy tắc giải chia thể (Deconjugation rules)
  const DECONJUGATIONS = [
    // 1. Phủ định quá khứ lịch sự: 〜ませんでした (見ませんでした -> 見る / 買いませんでした -> 買う)
    { suffix: 'ませんでした', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định quá khứ lịch sự (ませんでした)', prefixMeaning: 'Đã không' },
    { suffix: 'ませんでした', newSuffix: 'う', type: 'v5_i', conj: 'Thể phủ định quá khứ lịch sự (ませんでした)', prefixMeaning: 'Đã không' },

    // 2. Quá khứ lịch sự: 〜ました (見ました -> 見る / 買いました -> 買う / 読みました -> 読む)
    { suffix: 'ました', newSuffix: 'る', type: 'v1', conj: 'Thể quá khứ lịch sự (ました)', prefixMeaning: 'Đã' },
    { suffix: 'ました', newSuffix: 'う', type: 'v5_i', conj: 'Thể quá khứ lịch sự (ました)', prefixMeaning: 'Đã' },

    // 3. Phủ định lịch sự: 〜ません (見ません -> 見る / 行きません -> 行く)
    { suffix: 'ません', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định lịch sự (ません)', prefixMeaning: 'Không' },
    { suffix: 'ません', newSuffix: 'う', type: 'v5_i', conj: 'Thể phủ định lịch sự (ません)', prefixMeaning: 'Không' },

    // 4. Lịch sự hiện tại: 〜ます (見ます -> 見る / 行きます -> 行く)
    { suffix: 'ます', newSuffix: 'る', type: 'v1', conj: 'Thể lịch sự hiện tại (ます)', prefixMeaning: '' },
    { suffix: 'ます', newSuffix: 'う', type: 'v5_i', conj: 'Thể lịch sự hiện tại (ます)', prefixMeaning: '' },

    // 5. Thể điều kiện phủ định: 〜なければ (行かなければ -> 行く / 食べなければ -> 食べる)
    { suffix: 'なければ', newSuffix: 'る', type: 'v1', conj: 'Thể điều kiện phủ định (Nếu không...)', prefixMeaning: 'Nếu không' },
    { suffix: 'なければ', newSuffix: 'う', type: 'v5_a', conj: 'Thể điều kiện phủ định (Nếu không...)', prefixMeaning: 'Nếu không' },

    // 6. Thể phủ định quá khứ: 〜なかった (行かなかった -> 行く / 食べなかった -> 食べる)
    { suffix: 'なかった', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định quá khứ (なかった)', prefixMeaning: 'Đã không' },
    { suffix: 'なかった', newSuffix: 'う', type: 'v5_a', conj: 'Thể phủ định quá khứ (なかった)', prefixMeaning: 'Đã không' },

    // 7. Thể phủ định ngắn: 〜ない (行かない -> 行く / 食べない -> 食べる)
    { suffix: 'ない', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định ngắn (ない)', prefixMeaning: 'Không' },
    { suffix: 'ない', newSuffix: 'う', type: 'v5_a', conj: 'Thể phủ định ngắn (ない)', prefixMeaning: 'Không' },

    // 8. Động từ thể Te & Ta nhóm 1: 〜って / 〜った (買った -> 買う, 待った -> 待つ, 帰った -> 帰る)
    { suffix: 'って', newSuffix: 'う', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'って', newSuffix: 'つ', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'って', newSuffix: 'る', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'った', newSuffix: 'う', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'った', newSuffix: 'つ', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'った', newSuffix: 'る', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 9. Động từ thể Te & Ta đuôi む / ぶ / ぬ: 〜んで / 〜んだ (読んだ / 読んで -> 読む)
    { suffix: 'んで', newSuffix: 'む', type: 'v5_m', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'んで', newSuffix: 'ぶ', type: 'v5_m', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'んだ', newSuffix: 'む', type: 'v5_m', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'んだ', newSuffix: 'ぶ', type: 'v5_m', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 10. Động từ thể Te & Ta đuôi く / ぐ: 〜いて / 〜いた / 〜いで / 〜いだ (書いた -> 書く, 泳いだ -> 泳ぐ)
    { suffix: 'いて', newSuffix: 'く', type: 'v5_k', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'いた', newSuffix: 'く', type: 'v5_k', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'いで', newSuffix: 'ぐ', type: 'v5_g', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'いだ', newSuffix: 'ぐ', type: 'v5_g', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 11. Động từ thể Te & Ta đuôi す: 〜して / 〜した (話した -> 話す)
    { suffix: 'して', newSuffix: 'す', type: 'v5_s', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'した', newSuffix: 'す', type: 'v5_s', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 12. Tính từ đuôi い: 〜かった, 〜くない, 〜く (難しかった -> 難しい)
    { suffix: 'かった', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Quá khứ)', prefixMeaning: 'Đã' },
    { suffix: 'くない', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Phủ định)', prefixMeaning: 'Không' },
    { suffix: 'く', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Thể liên từ / Phó từ hóa)', prefixMeaning: '' }
  ];

  const I_TO_U = { 'い':'う', 'き':'く', 'ぎ':'ぐ', 'し':'す', 'ち':'つ', 'に':'ぬ', 'び':'ぶ', 'み':'む', 'り':'る' };
  const A_TO_U = { 'わ':'う', 'か':'く', 'が':'ぐ', 'さ':'す', 'た':'つ', 'な':'ぬ', 'ば':'ぶ', 'ま':'む', 'ら':'る' };

  class SentenceAnalyzerEngine {
    constructor() {
      this.compoundWords = null;
      this.coreDictList = null;
      this.coreDictMap = null;
      this.kanjiHanviet = null;
      this.kanjiDetails = null;
      this.isInitialized = false;
      this.initPromise = null;
    }

    /**
     * Khởi tạo và nạp dữ liệu từ điển offline vào bộ nhớ
     */
    async init(options = {}) {
      if (this.isInitialized) return true;
      if (this.initPromise) return this.initPromise;

      this.initPromise = (async () => {
        try {
          if (options.compoundWords && options.coreDict && options.kanjiHanviet) {
            this.compoundWords = options.compoundWords;
            this.coreDictList = options.coreDict;
            this.kanjiHanviet = options.kanjiHanviet;
            this.kanjiDetails = options.kanjiDetails || {};
          } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            // Nạp từ Chrome Extension Web Resources
            const [cwRes, coreRes, hvRes, kdRes] = await Promise.all([
              fetch(chrome.runtime.getURL('data/compound_words.json')).then(r => r.json()).catch(() => ({})),
              fetch(chrome.runtime.getURL('data/core_dict.json')).then(r => r.json()).catch(() => ([])),
              fetch(chrome.runtime.getURL('data/kanji_hanviet.json')).then(r => r.json()).catch(() => ({})),
              fetch(chrome.runtime.getURL('data/kanji_details.json')).then(r => r.json()).catch(() => ({}))
            ]);
            this.compoundWords = cwRes;
            this.coreDictList = coreRes;
            this.kanjiHanviet = hvRes;
            this.kanjiDetails = kdRes;
          } else if (typeof require === 'function') {
            // Nạp trong môi trường Node.js (Unit Test)
            const fs = require('fs');
            const path = require('path');
            const baseDir = options.dataDir || path.resolve(__dirname, '../data');
            this.compoundWords = JSON.parse(fs.readFileSync(path.join(baseDir, 'compound_words.json'), 'utf8'));
            this.coreDictList = JSON.parse(fs.readFileSync(path.join(baseDir, 'core_dict.json'), 'utf8'));
            this.kanjiHanviet = JSON.parse(fs.readFileSync(path.join(baseDir, 'kanji_hanviet.json'), 'utf8'));
            try {
              this.kanjiDetails = JSON.parse(fs.readFileSync(path.join(baseDir, 'kanji_details.json'), 'utf8'));
            } catch (e) {
              this.kanjiDetails = {};
            }
          }

          // Xây dựng bản đồ tra cứu nhanh core dict
          this.coreDictMap = new Map();
          if (Array.isArray(this.coreDictList)) {
            this.coreDictList.forEach(item => {
              if (item.kanji && !this.coreDictMap.has(item.kanji)) {
                this.coreDictMap.set(item.kanji, item);
              }
              if (item.kana && !this.coreDictMap.has(item.kana)) {
                this.coreDictMap.set(item.kana, item);
              }
            });
          }

          this.isInitialized = true;
          return true;
        } catch (err) {
          console.error('[SentenceAnalyzer] Khởi tạo thất bại:', err);
          return false;
        }
      })();

      return this.initPromise;
    }

    /**
     * Tra cứu âm Hán Việt
     */
    getHanViet(text) {
      if (!text || !this.kanjiHanviet) return '';
      const kanjiChars = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
      if (!kanjiChars) return '';
      return kanjiChars.map(c => this.kanjiHanviet[c] || '').filter(Boolean).join(' ');
    }

    /**
     * Tra cứu chi tiết từng chữ Kanji trong từ
     */
    getKanjiBreakdown(text) {
      if (!text) return [];
      const kanjiChars = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
      if (!kanjiChars) return [];
      const unique = Array.from(new Set(kanjiChars));
      return unique.map(char => {
        const hv = (this.kanjiHanviet && this.kanjiHanviet[char]) ? this.kanjiHanviet[char].toUpperCase() : '';
        const detail = (this.kanjiDetails && this.kanjiDetails[char]) ? this.kanjiDetails[char] : null;
        return {
          char: char,
          hanviet: hv,
          meaning: detail ? (detail.meaning || detail.definition || '') : '',
          strokes: detail ? detail.strokes : '',
          radical: detail ? detail.radical : ''
        };
      });
    }

    /**
     * Giải chia thể động từ / tính từ (Deconjugation)
     */
    deconjugate(word) {
      const results = [];
      // Xử lý các từ chia thể đặc biệt
      if (word === '行った') results.push({ base: '行く', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã', surfaceSuffix: 'った', dropLen: 1 });
      if (word === '行って') results.push({ base: '行く', conj: 'Thể Te (て) nối câu', prefixMeaning: '', surfaceSuffix: 'って', dropLen: 1 });
      if (word === '行かなければ') results.push({ base: '行く', conj: 'Thể điều kiện phủ định (Nếu không...)', prefixMeaning: 'Nếu không', surfaceSuffix: 'かなければ', dropLen: 1 });

      for (const rule of DECONJUGATIONS) {
        if (word.endsWith(rule.suffix) && word.length > rule.suffix.length) {
          const stem = word.slice(0, -rule.suffix.length);
          let cand = '';
          let surfaceSuffix = rule.suffix;
          let dropLen = 1;

          if (rule.type === 'v1') {
            cand = stem + rule.newSuffix;
            surfaceSuffix = rule.suffix;
            dropLen = 1; // drop 'る'
          } else if (rule.type === 'v5_i') {
            const last = stem.slice(-1);
            if (I_TO_U[last]) {
              cand = stem.slice(0, -1) + I_TO_U[last];
              surfaceSuffix = last + rule.suffix;
              dropLen = 1; // drop last kana of base (e.g. む -> み + ました)
            }
          } else if (rule.type === 'v5_a') {
            const last = stem.slice(-1);
            if (A_TO_U[last]) {
              cand = stem.slice(0, -1) + A_TO_U[last];
              surfaceSuffix = last + rule.suffix;
              dropLen = 1; // drop last kana of base (e.g. く -> か + なければ)
            }
          } else if (rule.type === 'adj_i') {
            cand = stem + rule.newSuffix;
            surfaceSuffix = rule.suffix;
            dropLen = 1; // drop 'い'
          } else {
            cand = stem + rule.newSuffix;
            surfaceSuffix = rule.suffix;
            dropLen = 1;
          }

          if (cand && (this.compoundWords[cand] || (this.coreDictMap && this.coreDictMap.has(cand)))) {
            results.push({
              base: cand,
              conj: rule.conj,
              prefixMeaning: rule.prefixMeaning,
              surfaceSuffix: surfaceSuffix,
              dropLen: dropLen
            });
          }
        }
      }
      return results;
    }

    /**
     * Phân tách câu tiếng Nhật thành mảng các token ngữ pháp hoàn chỉnh
     * @param {string} rawSentence Câu tiếng Nhật đầu vào
     * @returns {Array<Object>} Danh sách các token
     */
    tokenize(rawSentence) {
      if (!rawSentence || typeof rawSentence !== 'string') return [];
      const sentence = rawSentence.trim();
      if (!sentence) return [];

      const tokens = [];
      let i = 0;
      const len = sentence.length;

      while (i < len) {
        const char = sentence[i];

        // 1. Dấu câu & khoảng trắng (bảo toàn 100%)
        if (/[\s\u3000、。，．,!！？?・…:：()（）「」『』【】\[\]{}ー〜～\-\/\n\r]/.test(char)) {
          tokens.push({
            surface: char,
            baseForm: char,
            reading: '—',
            meaning: /[\s\u3000\n\r]/.test(char) ? 'Khoảng trắng / Xuống dòng' : 'Dấu câu',
            partOfSpeech: 'Dấu câu',
            grammarRole: 'Ngăn cách câu / Nhịp điệu',
            isPunctuation: true,
            isGrammar: false,
            source: 'punctuation'
          });
          i++;
          continue;
        }

        // 2. Chữ số & Ký tự Latin / Thuật ngữ tiếng Anh
        const numOrLatinMatch = sentence.slice(i).match(/^[A-Za-z0-9０-９]+/);
        if (numOrLatinMatch) {
          const matched = numOrLatinMatch[0];
          const isNum = /^[0-9０-９]+$/.test(matched);
          tokens.push({
            surface: matched,
            baseForm: matched,
            reading: matched,
            meaning: isNum ? 'Số thứ tự / Số đếm' : 'Từ ngoại lai / Thuật ngữ',
            partOfSpeech: isNum ? 'Chữ số' : 'Từ ngoại lai (Latin)',
            grammarRole: isNum ? 'Số lượng' : 'Thuật ngữ',
            isAlphanumeric: true,
            isGrammar: false,
            source: 'alphanumeric'
          });
          i += matched.length;
          continue;
        }

        // 3. Chuỗi Katakana (Mượn từ nước ngoài)
        const katakanaMatch = sentence.slice(i).match(/^[\u30a0-\u30ffー]+/);
        if (katakanaMatch) {
          const kataWord = katakanaMatch[0];
          const coreInfo = this.coreDictMap ? this.coreDictMap.get(kataWord) : null;
          tokens.push({
            surface: kataWord,
            baseForm: kataWord,
            reading: kataWord,
            meaning: (coreInfo ? coreInfo.meaning : '') || (this.compoundWords && this.compoundWords[kataWord] ? 'Từ mượn Katakana' : 'Từ ngoại lai Katakana'),
            partOfSpeech: (coreInfo ? coreInfo.partOfSpeech : 'Danh từ (Katakana)'),
            grammarRole: 'Thành phần từ vựng',
            isKatakana: true,
            isGrammar: false,
            source: 'katakana'
          });
          i += kataWord.length;
          continue;
        }

        // 4. Từ chỉ thị (Demonstratives: この, その, あの, どの...)
        let demoMatched = false;
        for (const [dWord, dInfo] of Object.entries(DEMONSTRATIVES)) {
          if (sentence.startsWith(dWord, i)) {
            tokens.push({
              surface: dWord,
              baseForm: dInfo.base,
              reading: dWord,
              meaning: dInfo.meaning,
              partOfSpeech: dInfo.pos,
              grammarRole: dInfo.role,
              isDemonstrative: true,
              isGrammar: true,
              source: 'grammar-engine'
            });
            i += dWord.length;
            demoMatched = true;
            break;
          }
        }
        if (demoMatched) continue;

        // 5. Trợ động từ & Động từ bất quy tắc (Suru, Iru, Naru, Kuru forms)
        let auxMatched = false;
        const sortedAux = Object.keys(AUXILIARY_VERBS).sort((a, b) => b.length - a.length);
        for (const auxKey of sortedAux) {
          if (sentence.startsWith(auxKey, i)) {
            const aInfo = AUXILIARY_VERBS[auxKey];
            tokens.push({
              surface: auxKey,
              baseForm: aInfo.base,
              reading: aInfo.reading,
              meaning: aInfo.meaning,
              partOfSpeech: aInfo.pos,
              conjugation: aInfo.conj,
              grammarRole: aInfo.role,
              isAuxiliary: true,
              isGrammar: true,
              source: 'grammar-engine'
            });
            i += auxKey.length;
            auxMatched = true;
            break;
          }
        }
        if (auxMatched) continue;

        // 6. Cấu trúc ngữ pháp & Trợ từ đa ký tự (てから, てください, より, から, まで, です, でした...)
        let pMatched = false;
        const sortedGrammar = Object.keys(GRAMMAR_AND_PARTICLES).sort((a, b) => b.length - a.length);
        for (const gKey of sortedGrammar) {
          if (gKey.length > 1 && sentence.startsWith(gKey, i)) {
            const gInfo = GRAMMAR_AND_PARTICLES[gKey];
            tokens.push({
              surface: gKey,
              baseForm: gKey,
              reading: gInfo.reading || gKey,
              meaning: gInfo.meaning,
              partOfSpeech: gInfo.pos,
              grammarRole: gInfo.role,
              isParticle: true,
              isGrammar: true,
              source: 'grammar-engine'
            });
            i += gKey.length;
            pMatched = true;
            break;
          }
        }
        if (pMatched) continue;

        // 7. Longest Match tìm từ vựng trong từ điển (8 ký tự xuống 1 ký tự)
        let bestMatch = null;
        for (let l = Math.min(8, len - i); l >= 1; l--) {
          const sub = sentence.substr(i, l);

          // A. Có trong từ điển gốc (compound_words hoặc core_dict)
          if ((this.compoundWords && this.compoundWords[sub]) || (this.coreDictMap && this.coreDictMap.has(sub))) {
            const coreInfo = this.coreDictMap ? this.coreDictMap.get(sub) : null;
            const rd = (this.compoundWords && this.compoundWords[sub]) || (coreInfo ? coreInfo.kana : sub);
            const mn = coreInfo ? coreInfo.meaning : '';
            const pos = coreInfo ? coreInfo.partOfSpeech : 'Từ vựng';

            bestMatch = {
              surface: sub,
              baseForm: sub,
              reading: rd,
              meaning: mn,
              partOfSpeech: pos,
              grammarRole: 'Thành phần từ vựng',
              hanviet: this.getHanViet(sub),
              isGrammar: false,
              source: 'offline-lexicon',
              length: l
            };
            break;
          }

          // B. Là từ chia thể (Deconjugation: 見ました -> 見る, 行かなければ -> 行く, 思った -> 思う)
          const deconjList = this.deconjugate(sub);
          if (deconjList.length > 0) {
            const dItem = deconjList[0];
            const baseWord = dItem.base;
            const coreInfo = this.coreDictMap ? this.coreDictMap.get(baseWord) : null;
            const baseReading = (this.compoundWords && this.compoundWords[baseWord]) || (coreInfo ? coreInfo.kana : baseWord);
            const baseMeaning = coreInfo ? coreInfo.meaning : '';

            let surfaceReading = baseReading;
            if (baseReading && dItem.surfaceSuffix && dItem.dropLen) {
              if (baseReading.length >= dItem.dropLen) {
                surfaceReading = baseReading.slice(0, -dItem.dropLen) + dItem.surfaceSuffix;
              }
            }

            let formattedMeaning = '';
            if (baseMeaning) {
              formattedMeaning = dItem.prefixMeaning ? `${dItem.prefixMeaning} ${baseMeaning}` : baseMeaning;
              formattedMeaning += `; dạng ${dItem.conj.toLowerCase()} của ${baseWord}`;
            } else {
              formattedMeaning = `${dItem.conj} của ${baseWord}`;
            }

            bestMatch = {
              surface: sub,
              baseForm: baseWord,
              reading: surfaceReading,
              baseReading: baseReading,
              meaning: formattedMeaning,
              partOfSpeech: baseWord.endsWith('い') ? 'Tính từ đuôi い' : 'Động từ',
              conjugation: dItem.conj,
              grammarRole: 'Vị ngữ / Hành động',
              hanviet: this.getHanViet(baseWord),
              isGrammar: false,
              source: 'deconjugation-engine',
              length: l
            };
            break;
          }
        }

        if (bestMatch && bestMatch.length > 1) {
          tokens.push(bestMatch);
          i += bestMatch.length;
          continue;
        }

        // 8. Trợ từ đơn ký tự (は, が, を, に, で, と, も, の, ね, よ, か, だ)
        const singleChar = sentence[i];
        if (GRAMMAR_AND_PARTICLES[singleChar]) {
          const gInfo = GRAMMAR_AND_PARTICLES[singleChar];
          tokens.push({
            surface: singleChar,
            baseForm: singleChar,
            reading: gInfo.reading || singleChar,
            meaning: gInfo.meaning,
            partOfSpeech: gInfo.pos,
            grammarRole: gInfo.role,
            isParticle: true,
            isGrammar: true,
            source: 'grammar-engine'
          });
          i++;
          continue;
        }

        // 9. Nếu có bestMatch độ dài 1 ký tự
        if (bestMatch) {
          tokens.push(bestMatch);
          i++;
          continue;
        }

        // 10. Fallback cho ký tự đơn (Hán tự hiếm hoặc ký tự đơn)
        const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(singleChar);
        const hv = isKanji ? this.getHanViet(singleChar) : '';
        tokens.push({
          surface: singleChar,
          baseForm: singleChar,
          reading: singleChar,
          meaning: hv ? `Chữ Hán (${hv})` : '',
          partOfSpeech: isKanji ? 'Hán tự đơn' : 'Ký tự',
          grammarRole: 'Thành phần ký tự',
          hanviet: hv,
          isGrammar: false,
          source: isKanji ? 'kanji-db' : 'unknown'
        });
        i++;
      }

      return tokens;
    }

    /**
     * Tạo chuỗi Furigana / Hiragana cho toàn bộ câu
     */
    generateFullSentenceReading(tokens) {
      if (!tokens || tokens.length === 0) return '';
      return tokens.map(t => {
        if (t.isPunctuation) return t.surface;
        return t.reading !== '—' ? t.reading : t.surface;
      }).join('');
    }

    /**
     * Tạo chuỗi HTML Ruby / Furigana
     */
    generateFuriganaHtml(tokens) {
      if (!tokens || tokens.length === 0) return '';
      return tokens.map(t => {
        if (t.isPunctuation) {
          return `<span class="punct-char">${this.escapeHtml(t.surface)}</span>`;
        }
        const hasKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(t.surface);
        if (hasKanji && t.reading && t.reading !== t.surface && t.reading !== '—') {
          return `<ruby class="ruby-token">${this.escapeHtml(t.surface)}<rt>${this.escapeHtml(t.reading)}</rt></ruby>`;
        }
        return `<span class="plain-token">${this.escapeHtml(t.surface)}</span>`;
      }).join('');
    }

    /**
     * Thoát mã HTML an toàn tránh XSS
     */
    escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * Phân tích toàn diện câu và chuẩn bị đầy đủ thông tin trả về
     */
    async analyze(sentence) {
      await this.init();

      if (!sentence || !sentence.trim()) {
        return {
          success: false,
          error: 'Văn bản đầu vào trống'
        };
      }

      if (sentence.length > 500) {
        return {
          success: false,
          error: 'Câu quá dài (vượt quá 500 ký tự). Vui lòng chia nhỏ câu để phân tích chính xác nhất.'
        };
      }

      const tokens = this.tokenize(sentence);
      const fullReading = this.generateFullSentenceReading(tokens);
      const furiganaHtml = this.generateFuriganaHtml(tokens);

      return {
        success: true,
        sentence: sentence.trim(),
        reading: fullReading,
        furiganaHtml: furiganaHtml,
        tokens: tokens,
        tokenCount: tokens.filter(t => !t.isPunctuation).length
      };
    }
  }

  // Khởi tạo Singleton instance
  const instance = new SentenceAnalyzerEngine();
  instance.SentenceAnalyzerEngine = SentenceAnalyzerEngine;
  return instance;
});
