/**
 * Japanese Sentence Analyzer Engine (Nihongo Helper Extension)
 * 
 * Bộ phân tích câu và hình thái học tiếng Nhật (Sentence Tokenizer & Morphological Analyzer)
 * - 100% Offline, hiệu năng cao (<1ms), không phụ thuộc thư viện nặng ngoài
 * - Tách câu thành các token tuần tự, bảo toàn 100% dấu câu, số và ký tự Latin
 * - Phân tích toàn diện số đếm, số thứ tự và đơn vị đếm (Numbers & Counters: 30代, 1日, 10時間, 3冊, 三人, 25...)
 * - Nhận diện thể chia động từ, tính từ (Deinflection: Masu, Te, Ta, Nai, Ba/Kereba, Nakereba)
 * - Nhận diện cấu trúc ngữ pháp và trợ từ (は, が, を, に, で, と, てから, なければならない...)
 * - Ánh xạ dạng từ điển (baseForm), cách đọc Kana, nghĩa tiếng Việt, vai trò ngữ pháp
 * - Tự động sinh phiên âm toàn câu (Hiragana) và HTML Furigana Ruby tag
 * - Tích hợp cơ chế làm giàu nghĩa từ điển (Dictionary Enrichment) liên thông với Extension Database
 * - Hỗ trợ cả môi trường Browser Extension (Content Script, Popup, Tab) và Node.js (Testing)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SentenceAnalyzer = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // =========================================================================
  // 1. TỪ ĐIỂN TỪ VỰNG & TIẾP VĨ TỪ THÔNG DỤNG (BUILT-IN COMMON LEXICON)
  // =========================================================================
  const BUILTIN_VOCAB = {
    // Thuật ngữ eSports & Từ vựng mới
    'eスポーツ': { reading: 'イースポーツ', pos: 'Danh từ (Katakana/Alphanumeric)', meaning: 'Thể thao điện tử (Esports)', hanviet: '' },
    'スポーツ': { reading: 'スポーツ', pos: 'Danh từ (Katakana)', meaning: 'Thể thao (Sport)', hanviet: '' },
    'ゲーム': { reading: 'ゲーム', pos: 'Danh từ (Katakana)', meaning: 'Trò chơi điện tử, game', hanviet: '' },
    'カロリー': { reading: 'カロリー', pos: 'Danh từ (Katakana)', meaning: 'Lượng calo, nhiệt lượng (Calorie)', hanviet: '' },
    '選手': { reading: 'せんしゅ', pos: 'Danh từ', meaning: 'Tuyển thủ, vận động viên', hanviet: 'TUYỂN THỦ' },
    '消費': { reading: 'しょうひ', pos: 'Danh từ / Động từ Suru', meaning: 'Tiêu hao, tiêu thụ', hanviet: 'TIÊU PHÍ' },
    '思える': { base: '思う', reading: 'おもえる', pos: 'Động từ tự phát / Khả năng', conj: 'Thể tự phát / khả năng của 思う', meaning: 'Tự nhiên cảm thấy, có thể nghĩ rằng', hanviet: 'TƯ' },
    '思えます': { base: '思う', reading: 'おもえます', pos: 'Động từ tự phát / Khả năng', conj: 'Thể tự phát / khả năng lịch sự của 思う', meaning: 'Tự nhiên cảm thấy, có thể nghĩ rằng', hanviet: 'TƯ' },
    '問題': { reading: 'もんだい', pos: 'Danh từ', meaning: 'Vấn đề, câu hỏi, bài tập', hanviet: 'VẤN ĐỀ' },
    '簡単': { reading: 'かんたん', pos: 'Tính từ đuôi な', meaning: 'Đơn giản, dễ dàng', hanviet: 'GIẢN ĐƠN' },
    '雨': { reading: 'あめ', pos: 'Danh từ', meaning: 'Mưa, cơn mưa', hanviet: 'VŨ' },
    '降って': { base: '降る', reading: 'ふって', pos: 'Động từ', conj: 'Thể Te (て) nối câu', meaning: 'Rơi (mưa, tuyết)', hanviet: 'HÀNG' },
    '降る': { base: '降る', reading: 'ふる', pos: 'Động từ', meaning: 'Rơi (mưa, tuyết)', hanviet: 'HÀNG' },
    '出かけません': { base: '出かける', reading: 'でかけません', pos: 'Động từ', conj: 'Thể phủ định lịch sự', meaning: 'Không đi ra ngoài', hanviet: 'XUẤT' },
    '出かける': { base: '出かける', reading: 'でかける', pos: 'Động từ', meaning: 'Đi ra ngoài, xuất hành', hanviet: 'XUẤT' },

    // Địa danh & danh từ riêng
    '関東': { reading: 'かんとう', pos: 'Danh từ riêng', meaning: 'Vùng Kanto (miền đông Nhật Bản, bao gồm Tokyo)', hanviet: 'QUAN ĐÔNG' },
    '関西': { reading: 'かんさい', pos: 'Danh từ riêng', meaning: 'Vùng Kansai (miền tây Nhật Bản, bao gồm Osaka, Kyoto)', hanviet: 'QUAN TÂY' },
    '東京': { reading: 'とうきょう', pos: 'Danh từ riêng', meaning: 'Thủ đô Tokyo', hanviet: 'ĐÔNG KINH' },
    '京都': { reading: 'きょうと', pos: 'Danh từ riêng', meaning: 'Cố đô Kyoto', hanviet: 'KINH ĐÔ' },
    '大阪': { reading: 'おおさか', pos: 'Danh từ riêng', meaning: 'Thành phố Osaka', hanviet: 'ĐẠI PHẢN' },

    // Con người & Xã hội
    '女性': { reading: 'じょせい', pos: 'Danh từ', meaning: 'Phụ nữ, phái nữ, nữ giới', hanviet: 'NỮ TÍNH' },
    '男性': { reading: 'だんせい', pos: 'Danh từ', meaning: 'Đàn ông, phái nam, nam giới', hanviet: 'NAM TÍNH' },
    '大人': { reading: 'おとな', pos: 'Danh từ', meaning: 'Người lớn, người trưởng thành', hanviet: 'ĐẠI NHÂN' },
    '子供': { reading: 'こども', pos: 'Danh từ', meaning: 'Trẻ con, đứa trẻ, con cái', hanviet: 'TỬ CUNG' },
    '友達': { reading: 'ともだち', pos: 'Danh từ', meaning: 'Bạn bè, người bạn', hanviet: 'HỮU ĐẠT' },
    '家族': { reading: 'かぞく', pos: 'Danh từ', meaning: 'Gia đình, người thân trong nhà', hanviet: 'GIA TỘC' },
    '自分': { reading: 'じぶん', pos: 'Đại từ', meaning: 'Bản thân, chính mình', hanviet: 'TỰ PHÂN' },
    '私': { reading: 'わたし', pos: 'Đại từ', meaning: 'Tôi, bản thân tôi (lịch sự)', hanviet: 'TƯ' },
    '僕': { reading: 'ぼく', pos: 'Đại từ', meaning: 'Tôi, tớ (nam giới xưng hô thân mật)', hanviet: 'BỘC' },
    '俺': { reading: 'おれ', pos: 'Đại từ', meaning: 'Tao, tớ (thân mật, suồng sã)', hanviet: 'YÊM' },
    '先生': { reading: 'せんせい', pos: 'Danh từ', meaning: 'Thầy cô giáo, bác sĩ, chuyên gia', hanviet: 'TIÊN SINH' },
    '学生': { reading: 'がくせい', pos: 'Danh từ', meaning: 'Học sinh, sinh viên', hanviet: 'HỌC SINH' },
    '会社': { reading: 'かいしゃ', pos: 'Danh từ', meaning: 'Công ty, doanh nghiệp', hanviet: 'HỘI XÃ' },
    '社員': { reading: 'しゃいん', pos: 'Danh từ', meaning: 'Nhân viên công ty', hanviet: 'XÃ VIÊN' },

    // Thời gian & Mốc giới hạn
    '以前': { reading: 'いぜん', pos: 'Danh phó từ', meaning: 'Trước đây, trước kia, dĩ tiền', hanviet: 'DĨ TIỀN' },
    '以後': { reading: 'いご', pos: 'Danh phó từ', meaning: 'Sau này, từ đó về sau, dĩ hậu', hanviet: 'DĨ HẬU' },
    '以上': { reading: 'いじょう', pos: 'Danh từ / Tiếp vĩ từ', meaning: 'Trở lên, từ ... trở lên (tối thiểu), hơn thế nữa', hanviet: 'DĨ THƯỢNG' },
    '以下': { reading: 'いか', pos: 'Danh từ / Tiếp vĩ từ', meaning: 'Trở xuống, dưới mức ..., dĩ hạ', hanviet: 'DĨ HẠ' },
    '代': { reading: 'だい', pos: 'Tiếp vĩ từ / Danh từ', meaning: 'Thế hệ, độ tuổi (như 30代: độ tuổi 30); thời kỳ; tiền phí', hanviet: 'ĐẠI' },
    '時間': { reading: 'じかん', pos: 'Danh từ', meaning: 'Thời gian, giờ giấc, tiếng đồng hồ', hanviet: 'THỜI GIAN' },
    '昨日': { reading: 'きのう', pos: 'Danh từ', meaning: 'Hôm qua', hanviet: 'TÁC NHẬT' },
    '今日': { reading: 'きょう', pos: 'Danh từ', meaning: 'Hôm nay', hanviet: 'KIM NHẬT' },
    '明日': { reading: 'あした', pos: 'Danh từ', meaning: 'Ngày mai', hanviet: 'MINH NHẬT' },
    '毎日': { reading: 'まいにち', pos: 'Danh phó từ', meaning: 'Mỗi ngày, hàng ngày', hanviet: 'MỖI NHẬT' },
    '毎週': { reading: 'まいしゅう', pos: 'Danh phó từ', meaning: 'Mỗi tuần, hàng tuần', hanviet: 'MỖI CHU' },
    '毎月': { reading: 'まいつき', pos: 'Danh phó từ', meaning: 'Mỗi tháng, hàng tháng', hanviet: 'MỖI NGUYỆT' },
    '毎年': { reading: 'まいとし', pos: 'Danh phó từ', meaning: 'Mỗi năm, hàng năm', hanviet: 'MỖI NIÊN' },
    '朝': { reading: 'あさ', pos: 'Danh từ', meaning: 'Buổi sáng', hanviet: 'TRIÊU' },
    '昼': { reading: 'ひる', pos: 'Danh từ', meaning: 'Buổi trưa, ban ngày', hanviet: 'TRÚ' },
    '夜': { reading: 'よる', pos: 'Danh từ', meaning: 'Buổi tối, ban đêm', hanviet: 'DẠ' },
    '今': { reading: 'いま', pos: 'Danh phó từ', meaning: 'Bây giờ, hiện tại', hanviet: 'KIM' },
    '先週': { reading: 'せんしゅう', pos: 'Danh từ', meaning: 'Tuần trước', hanviet: 'TIÊN CHU' },
    '今週': { reading: 'こんしゅう', pos: 'Danh từ', meaning: 'Tuần này', hanviet: 'KIM CHU' },
    '来週': { reading: 'らいしゅう', pos: 'Danh từ', meaning: 'Tuần sau', hanviet: 'LAI CHU' },
    '去年': { reading: 'きょねん', pos: 'Danh từ', meaning: 'Năm ngoái', hanviet: 'KHỨ NIÊN' },
    '今年': { reading: 'ことし', pos: 'Danh từ', meaning: 'Năm nay', hanviet: 'KIM NIÊN' },
    '来年': { reading: 'らいねん', pos: 'Danh từ', meaning: 'Năm sau', hanviet: 'LAI NIÊN' },

    // Đồ vật, Văn hóa & Đời sống
    '本': { reading: 'ほん', pos: 'Danh từ', meaning: 'Sách, cuốn sách', hanviet: 'BẢN' },
    '映画': { reading: 'えいが', pos: 'Danh từ', meaning: 'Phim ảnh, bộ phim điện ảnh', hanviet: 'ÁNH HỌA' },
    '音楽': { reading: 'おんがく', pos: 'Danh từ', meaning: 'Âm nhạc', hanviet: 'ÂM NHẠC' },
    '写真': { reading: 'しゃしん', pos: 'Danh từ', meaning: 'Bức ảnh, tấm hình', hanviet: 'TẢ CHÂN' },
    '手紙': { reading: 'てがみ', pos: 'Danh từ', meaning: 'Bức thư', hanviet: 'THỦ CHỈ' },
    '電話': { reading: 'でんわ', pos: 'Danh từ', meaning: 'Điện thoại, cuộc gọi', hanviet: 'ĐIỆN THOẠI' },
    '車': { reading: 'くるま', pos: 'Danh từ', meaning: 'Xe hơi, ô tô', hanviet: 'XA' },
    '電車': { reading: 'でんしゃ', pos: 'Danh từ', meaning: 'Tàu điện', hanviet: 'ĐIỆN XA' },
    '自転車': { reading: 'じてんしゃ', pos: 'Danh từ', meaning: 'Xe đạp', hanviet: 'TỰ CHUYỂN XA' },
    '部屋': { reading: 'へや', pos: 'Danh từ', meaning: 'Căn phòng', hanviet: 'BỘ ỐC' },
    '家': { reading: 'いえ', pos: 'Danh từ', meaning: 'Ngôi nhà, gia đình', hanviet: 'GIA' },
    '学校': { reading: 'がっこう', pos: 'Danh từ', meaning: 'Trường học', hanviet: 'HỌC HIỆU' },
    '病院': { reading: 'びょういん', pos: 'Danh từ', meaning: 'Bệnh viện', hanviet: 'BỆNH VIỆN' },
    '店': { reading: 'みせ', pos: 'Danh từ', meaning: 'Cửa hàng, tiệm', hanviet: 'ĐIẾM' },
    '料理': { reading: 'りょうり', pos: 'Danh từ', meaning: 'Món ăn, nấu nướng', hanviet: 'LIỆU LÝ' },
    'ご飯': { reading: 'ごはん', pos: 'Danh từ', meaning: 'Cơm, bữa ăn', hanviet: 'PHẠN' },
    '水': { reading: 'みず', pos: 'Danh từ', meaning: 'Nước (uống)', hanviet: 'THỦY' },
    'お茶': { reading: 'おちゃ', pos: 'Danh từ', meaning: 'Trà, nước chè', hanviet: 'TRÀ' },
    '仕事': { reading: 'しごと', pos: 'Danh từ', meaning: 'Công việc', hanviet: 'SĨ SỰ' },
    '勉強': { reading: 'べんきょう', pos: 'Danh từ', meaning: 'Việc học tập, học hành', hanviet: 'MIỄN CƯỠNG' },
    '問題': { reading: 'もんだい', pos: 'Danh từ', meaning: 'Vấn đề, câu hỏi, bài tập', hanviet: 'VẤN ĐỀ' },
    '質問': { reading: 'しつもん', pos: 'Danh từ', meaning: 'Câu hỏi, thắc mắc', hanviet: 'CHẤT VẤN' },
    '買い物': { reading: 'かいもの', pos: 'Danh từ', meaning: 'Mua sắm, đồ mua sắm', hanviet: 'MÃI VẬT' },
    '旅行': { reading: 'りょこう', pos: 'Danh từ', meaning: 'Chuyến du lịch, đi chơi xa', hanviet: 'LỮ HÀNH' },

    // Thuật ngữ công nghệ & Katakana
    'SNS': { reading: 'エスエヌエス', pos: 'Danh từ (Katakana)', meaning: 'Mạng xã hội (Social Networking Service)', hanviet: '' },
    'テスト': { reading: 'テスト', pos: 'Danh từ (Katakana)', meaning: 'Bài kiểm tra, thử nghiệm (Test)', hanviet: '' },
    'エラー': { reading: 'エラー', pos: 'Danh từ (Katakana)', meaning: 'Lỗi, sự cố phần mềm (Error)', hanviet: '' },
    'データ': { reading: 'データ', pos: 'Danh từ (Katakana)', meaning: 'Dữ liệu, số liệu (Data)', hanviet: '' },
    'プログラム': { reading: 'プログラム', pos: 'Danh từ (Katakana)', meaning: 'Chương trình máy tính (Program)', hanviet: '' },
    'システム': { reading: 'システム', pos: 'Danh từ (Katakana)', meaning: 'Hệ thống (System)', hanviet: '' },
    'ユーザー': { reading: 'ユーザー', pos: 'Danh từ (Katakana)', meaning: 'Người dùng (User)', hanviet: '' },
    'パソコン': { reading: 'パソコン', pos: 'Danh từ (Katakana)', meaning: 'Máy tính cá nhân (PC / Laptop)', hanviet: '' },
    'スマホ': { reading: 'スマホ', pos: 'Danh từ (Katakana)', meaning: 'Điện thoại thông minh (Smartphone)', hanviet: '' },
    'インターネット': { reading: 'インターネット', pos: 'Danh từ (Katakana)', meaning: 'Mạng Internet', hanviet: '' },
    'メール': { reading: 'メール', pos: 'Danh từ (Katakana)', meaning: 'Thư điện tử, email', hanviet: '' },
    'テレビ': { reading: 'テレビ', pos: 'Danh từ (Katakana)', meaning: 'Vô tuyến, ti vi', hanviet: '' },
    'ラジオ': { reading: 'ラジオ', pos: 'Danh từ (Katakana)', meaning: 'Đài phát thanh (Radio)', hanviet: '' },

    // Danh từ hành động (Suru Nouns)
    '実行': { reading: 'じっこう', pos: 'Danh từ', meaning: 'Thực hiện, thực thi, thi hành', hanviet: 'THỰC HÀNH' },
    '修正': { reading: 'しゅうせい', pos: 'Danh từ', meaning: 'Chỉnh sửa, tu chính, sửa lỗi', hanviet: 'TU CHÍNH' },
    '開発': { reading: 'かいはつ', pos: 'Danh từ', meaning: 'Phát triển, xây dựng', hanviet: 'KHAI PHÁT' },
    '確認': { reading: 'かくにん', pos: 'Danh từ', meaning: 'Xác nhận, kiểm tra lại', hanviet: 'XÁC NHẬN' },
    '連絡': { reading: 'れんらく', pos: 'Danh từ', meaning: 'Liên lạc, thông báo', hanviet: 'LIÊN LẠC' },
    '相談': { reading: 'そうだん', pos: 'Danh từ', meaning: 'Thảo luận, bàn bạc, trao đổi', hanviet: 'TƯƠNG ĐÀM' },
    '案内': { reading: 'あんない', pos: 'Danh từ', meaning: 'Hướng dẫn, dẫn đường', hanviet: 'ÁN NỘI' },
    '予約': { reading: 'よやく', pos: 'Danh từ', meaning: 'Đặt trước, hẹn trước', hanviet: 'DỰ ƯỚC' },

    // =========================================================================
    // PHÓ TỪ & TỪ NỐI THÔNG DỤNG (ADVERBS & CONJUNCTIONS)
    // =========================================================================
    'さらに': { reading: 'さらに', pos: 'Phó từ', meaning: 'Hơn nữa, thêm nữa', base: 'さらに' },
    '更に': { reading: 'さらに', pos: 'Phó từ', meaning: 'Hơn nữa, thêm nữa', hanviet: 'CANH', base: '更に' },
    'それから': { reading: 'それから', pos: 'Liên từ', meaning: 'Sau đó, tiếp theo, rồi thì', base: 'それから' },
    '其れから': { reading: 'それから', pos: 'Liên từ', meaning: 'Sau đó, tiếp theo, rồi thì', hanviet: 'KÌ LAI', base: 'それから' },
    'そして': { reading: 'そして', pos: 'Liên từ', meaning: 'Và, rồi thì, sau đó', base: 'そして' },
    'しかし': { reading: 'しかし', pos: 'Liên từ', meaning: 'Nhưng, tuy nhiên', base: 'しかし' },
    '然し': { reading: 'しかし', pos: 'Liên từ', meaning: 'Nhưng, tuy nhiên', hanviet: 'NHIÊN', base: 'しかし' },
    'だから': { reading: 'だから', pos: 'Liên từ', meaning: 'Vì vậy, cho nên', base: 'だから' },
    'けれども': { reading: 'けれども', pos: 'Liên từ', meaning: 'Tuy nhiên, nhưng mà', base: 'けれども' },
    'けれど': { reading: 'けれど', pos: 'Liên từ', meaning: 'Tuy nhiên, nhưng', base: 'けれど' },
    'それに': { reading: 'それに', pos: 'Liên từ', meaning: 'Hơn nữa, vả lại', base: 'それに' },
    'それでも': { reading: 'それでも', pos: 'Liên từ', meaning: 'Mặc dù vậy, dù vậy', base: 'それでも' },
    'または': { reading: 'または', pos: 'Liên từ', meaning: 'Hoặc là, hay là', base: 'または' },
    'あるいは': { reading: 'あるいは', pos: 'Liên từ', meaning: 'Hoặc là, có lẽ', base: 'あるいは' },
    'つまり': { reading: 'つまり', pos: 'Liên từ', meaning: 'Tóm lại là, tức là', base: 'つまり' },

    'とても': { reading: 'とても', pos: 'Phó từ', meaning: 'Rất, cực kỳ', base: 'とても' },
    '迚も': { reading: 'とても', pos: 'Phó từ', meaning: 'Rất, cực kỳ', hanviet: 'ĐỆ', base: 'とても' },
    'たくさん': { reading: 'たくさん', pos: 'Phó từ / Danh từ', meaning: 'Nhiều, phong phú', base: 'たくさん' },
    '沢山': { reading: 'たくさん', pos: 'Phó từ / Danh từ', meaning: 'Nhiều, phong phú', hanviet: 'TẬP SƠN', base: 'たくさん' },
    'たいへん': { reading: 'たいへん', pos: 'Phó từ', meaning: 'Rất, vô cùng', base: 'たいへん' },
    '大変': { reading: 'たいへん', pos: 'Phó từ / Tính từ đuôi な', meaning: 'Vất vả; rất, vô cùng', hanviet: 'ĐẠI BIẾN', base: '大変' },
    'いつも': { reading: 'いつも', pos: 'Phó từ', meaning: 'Luôn luôn, lúc nào cũng', base: 'いつも' },
    '何時も': { reading: 'いつも', pos: 'Phó từ', meaning: 'Luôn luôn, lúc nào cũng', hanviet: 'HÀ THỜI', base: 'いつも' },
    'たぶん': { reading: 'たぶん', pos: 'Phó từ', meaning: 'Có lẽ, có thể', base: 'たぶん' },
    '多分': { reading: 'たぶん', pos: 'Phó từ', meaning: 'Có lẽ, có thể', hanviet: 'ĐA PHÂN', base: '多分' },
    'ぜんぜん': { reading: 'ぜんぜん', pos: 'Phó từ', meaning: 'Hoàn toàn không (đi với phủ định)', base: 'ぜんぜん' },
    '全然': { reading: 'ぜんぜん', pos: 'Phó từ', meaning: 'Hoàn toàn không (đi với phủ định)', hanviet: 'TOÀN NHIÊN', base: '全然' },
    'だんだん': { reading: 'だんだん', pos: 'Phó từ', meaning: 'Dần dần, từng bước', base: 'だんだん' },
    '段々': { reading: 'だんだん', pos: 'Phó từ', meaning: 'Dần dần, từng bước', hanviet: 'ĐOẠN ĐOẠN', base: '段々' },
    'ますます': { reading: 'ますます', pos: 'Phó từ', meaning: 'Ngày càng, càng ngày càng', base: 'ますます' },
    '益々': { reading: 'ますます', pos: 'Phó từ', meaning: 'Ngày càng, càng ngày càng', hanviet: 'ÍCH ÍCH', base: 'ますます' },
    'そろそろ': { reading: 'そろそろ', pos: 'Phó từ', meaning: 'Sắp sửa, đã đến lúc', base: 'そろそろ' },
    'なかなか': { reading: 'なかなか', pos: 'Phó từ', meaning: 'Khá là, mãi mà không...', base: 'なかなか' },
    '中々': { reading: 'なかなか', pos: 'Phó từ', meaning: 'Khá là, mãi mà không...', hanviet: 'TRUNG TRUNG', base: 'なかなか' },
    'ちょうど': { reading: 'ちょうど', pos: 'Phó từ', meaning: 'Vừa đúng, vừa vặn', base: 'ちょうど' },
    '丁度': { reading: 'ちょうど', pos: 'Phó từ', meaning: 'Vừa đúng, vừa vặn', hanviet: 'ĐINH ĐỘ', base: 'ちょうど' },
    'ずっと': { reading: 'ずっと', pos: 'Phó từ', meaning: 'Suốt, hơn hẳn', base: 'ずっと' },
    'もっと': { reading: 'もっと', pos: 'Phó từ', meaning: 'Hơn nữa, thêm nữa', base: 'もっと' },
    'すでに': { reading: 'すでに', pos: 'Phó từ', meaning: 'Đã, rồi', base: 'すでに' },
    '既に': { reading: 'すでに', pos: 'Phó từ', meaning: 'Đã, rồi', hanviet: 'KÝ', base: '既に' },
    'ついに': { reading: 'ついに', pos: 'Phó từ', meaning: 'Cuối cùng thì', base: 'ついに' },
    '遂に': { reading: 'ついに', pos: 'Phó từ', meaning: 'Cuối cùng thì', hanviet: 'TOẠI', base: '遂に' },
    'やっと': { reading: 'やっと', pos: 'Phó từ', meaning: 'Cuối cùng cũng', base: 'やっと' },
    'やはり': { reading: 'やはり', pos: 'Phó từ', meaning: 'Quả nhiên, như dự đoán', base: 'やはり' },
    'やっぱり': { reading: 'やっぱり', pos: 'Phó từ', meaning: 'Quả nhiên (thân mật)', base: 'やっぱり' },
    'しばらく': { reading: 'しばらく', pos: 'Phó từ', meaning: 'Một lúc, một lát, một dạo', base: 'しばらく' },
    '暫く': { reading: 'しばらく', pos: 'Phó từ', meaning: 'Một lúc, một lát, một dạo', hanviet: 'TẠM', base: 'しばらく' },
    'あまり': { reading: 'あまり', pos: 'Phó từ', meaning: 'Không... lắm (đi với phủ định)', base: 'あまり' },
    '余り': { reading: 'あまり', pos: 'Phó từ', meaning: 'Không... lắm (đi với phủ định)', hanviet: 'DƯ', base: 'あまり' },
    'ほとんど': { reading: 'ほとんど', pos: 'Phó từ', meaning: 'Hầu hết, hầu như', base: 'ほとんど' },
    '殆ど': { reading: 'ほとんど', pos: 'Phó từ', meaning: 'Hầu hết, hầu như', hanviet: 'ĐÃI', base: 'ほとんど' },
    'だいたい': { reading: 'だいたい', pos: 'Phó từ', meaning: 'Đại khái, nhìn chung', base: 'だいたい' },
    '大体': { reading: 'だいたい', pos: 'Phó từ', meaning: 'Đại khái, nhìn chung', hanviet: 'ĐẠI THỂ', base: '大体' },
    'とくに': { reading: 'とくに', pos: 'Phó từ', meaning: 'Đặc biệt là', base: 'とくに' },
    '特に': { reading: 'とくに', pos: 'Phó từ', meaning: 'Đặc biệt là', hanviet: 'ĐẶC', base: '特に' },
    'すこし': { reading: 'すこし', pos: 'Phó từ', meaning: 'Một chút, một ít', base: 'すこし' },
    '少し': { reading: 'すこし', pos: 'Phó từ', meaning: 'Một chút, một ít', hanviet: 'THIỂU', base: '少し' },
    'ちょっと': { reading: 'ちょっと', pos: 'Phó từ', meaning: 'Một chút, một lát', base: 'ちょっと' },
    '一寸': { reading: 'ちょっと', pos: 'Phó từ', meaning: 'Một chút, một lát', hanviet: 'NHẤT THỐN', base: 'ちょっと' },
    'すぐ': { reading: 'すぐ', pos: 'Phó từ', meaning: 'Ngay lập tức, gần sát', base: 'すぐ' },
    '直ぐ': { reading: 'すぐ', pos: 'Phó từ', meaning: 'Ngay lập tức, gần sát', hanviet: 'TRỰC', base: 'すぐ' },
    'すぐに': { reading: 'すぐに', pos: 'Phó từ', meaning: 'Ngay lập tức', base: 'すぐに' },
    '直ぐに': { reading: 'すぐに', pos: 'Phó từ', meaning: 'Ngay lập tức', hanviet: 'TRỰC', base: 'すぐに' },
    'ゆっくり': { reading: 'ゆっくり', pos: 'Phó từ', meaning: 'Chậm rãi, thong thả', base: 'ゆっくり' },
    'しっかり': { reading: 'しっかり', pos: 'Phó từ', meaning: 'Chắc chắn, cẩn thận', base: 'しっかり' },
    '確り': { reading: 'しっかり', pos: 'Phó từ', meaning: 'Chắc chắn, cẩn thận', hanviet: 'XÁC', base: 'しっかり' },
    'はっきり': { reading: 'はっきり', pos: 'Phó từ', meaning: 'Rõ ràng, rành mạch', base: 'はっきり' },
    'すっかり': { reading: 'すっかり', pos: 'Phó từ', meaning: 'Hoàn toàn, toàn bộ', base: 'すっかり' },
    'ぴったり': { reading: 'ぴったり', pos: 'Phó từ', meaning: 'Vừa khít, vừa vặn', base: 'ぴったり' },
    'ときどき': { reading: 'ときどき', pos: 'Phó từ', meaning: 'Thỉnh thoảng, đôi khi', base: 'ときどき' },
    '時々': { reading: 'ときどき', pos: 'Phó từ', meaning: 'Thỉnh thoảng, đôi khi', hanviet: 'THỜI THỜI', base: '時々' },
    'たまに': { reading: 'たまに', pos: 'Phó từ', meaning: 'Hiếm khi, thỉnh thoảng', base: 'たまに' },
    '偶に': { reading: 'たまに', pos: 'Phó từ', meaning: 'Hiếm khi, thỉnh thoảng', hanviet: 'NGẪU', base: 'たまに' },

    // =========================================================================
    // CÂU CHÀO & THÁN TỪ (GREETINGS & INTERJECTIONS)
    // =========================================================================
    'さようなら': { reading: 'さようなら', pos: 'Thán từ', meaning: 'Tạm biệt', base: 'さようなら' },
    '左様なら': { reading: 'さようなら', pos: 'Thán từ', meaning: 'Tạm biệt', hanviet: 'TẢ DẠNG', base: 'さようなら' },
    'ごめんなさい': { reading: 'ごめんなさい', pos: 'Thán từ', meaning: 'Xin thứ lỗi, xin lỗi (thân mật)', base: 'ごめんなさい' },
    '御免なさい': { reading: 'ごめんなさい', pos: 'Thán từ', meaning: 'Xin thứ lỗi, xin lỗi (thân mật)', hanviet: 'NGỰ MIỄN', base: 'ごめんなさい' },
    'ありがとう': { reading: 'ありがとう', pos: 'Thán từ', meaning: 'Cảm ơn bạn', base: 'ありがとう' },
    '有難う': { reading: 'ありがとう', pos: 'Thán từ', meaning: 'Cảm ơn bạn', hanviet: 'HỮU NAN', base: 'ありがとう' },
    'ありがとうございます': { reading: 'ありがとうございます', pos: 'Thán từ', meaning: 'Xin cảm ơn (lịch sự)', base: 'ありがとうございます' },
    '有難うございます': { reading: 'ありがとうございます', pos: 'Thán từ', meaning: 'Xin cảm ơn (lịch sự)', hanviet: 'HỮU NAN', base: 'ありがとうございます' },
    'すみません': { reading: 'すみません', pos: 'Thán từ', meaning: 'Xin lỗi, xin làm phiền', base: 'すみません' },
    'すいません': { reading: 'すいません', pos: 'Thán từ', meaning: 'Xin lỗi (thân mật)', base: 'すいません' },
    'こんにちは': { reading: 'こんにちは', pos: 'Thán từ', meaning: 'Xin chào (ban ngày)', base: 'こんにちは' },
    'こんばんは': { reading: 'こんばんは', pos: 'Thán từ', meaning: 'Chào buổi tối', base: 'こんばんは' },
    'おはよう': { reading: 'おはよう', pos: 'Thán từ', meaning: 'Chào buổi sáng', base: 'おはよう' },
    'お早う': { reading: 'おはよう', pos: 'Thán từ', meaning: 'Chào buổi sáng', hanviet: 'NGỰ TẢO', base: 'おはよう' },
    'おはようございます': { reading: 'おはようございます', pos: 'Thán từ', meaning: 'Chào buổi sáng (lịch sự)', base: 'おはようございます' },
    'お早うございます': { reading: 'おはようございます', pos: 'Thán từ', meaning: 'Chào buổi sáng (lịch sự)', hanviet: 'NGỰ TẢO', base: 'おはようございます' },
    'どうも': { reading: 'どうも', pos: 'Phó từ / Thán từ', meaning: 'Cảm ơn / chào (thân mật)', base: 'どうも' },
    'どうぞ': { reading: 'どうぞ', pos: 'Phó từ', meaning: 'Xin mời', base: 'どうぞ' },
    'どういたしまして': { reading: 'どういたしまして', pos: 'Thán từ', meaning: 'Không có chi', base: 'どういたしまして' },
    'いただきます': { reading: 'いただきます', pos: 'Thán từ', meaning: 'Mời dùng bữa, xin nhận', base: 'いただきます' },
    'ごちそうさま': { reading: 'ごちそうさま', pos: 'Thán từ', meaning: 'Cảm ơn vì bữa ăn', base: 'ごちそうさま' },
    'ごちそうさまでした': { reading: 'ごちそうさまでした', pos: 'Thán từ', meaning: 'Cảm ơn vì bữa ăn (lịch sự)', base: 'ごちそうさまでした' },
    'いってきます': { reading: 'いってきます', pos: 'Thán từ', meaning: 'Tôi đi đây (sẽ về)', base: 'いってきます' },
    'いってらっしゃい': { reading: 'いってらっしゃい', pos: 'Thán từ', meaning: 'Đi cẩn thận nhé', base: 'いってらっしゃい' },
    'ただいま': { reading: 'ただいま', pos: 'Thán từ', meaning: 'Tôi đã về đây', base: 'ただいま' },
    'おかえり': { reading: 'おかえり', pos: 'Thán từ', meaning: 'Mừng bạn đã về', base: 'おかえり' },
    'おかえりなさい': { reading: 'おかえりなさい', pos: 'Thán từ', meaning: 'Mừng bạn đã về (lịch sự)', base: 'おかえりなさい' },
    'おめでとう': { reading: 'おめでとう', pos: 'Thán từ', meaning: 'Chúc mừng bạn', base: 'おめでとう' },
    'おめでとうございます': { reading: 'おめでとうございます', pos: 'Thán từ', meaning: 'Xin chúc mừng (lịch sự)', base: 'おめでとうございます' },
    'おつかれさま': { reading: 'おつかれさま', pos: 'Thán từ', meaning: 'Bạn đã vất vả rồi', base: 'おつかれさま' },
    'おつかれさまでした': { reading: 'おつかれさまでした', pos: 'Thán từ', meaning: 'Anh/chị đã vất vả rồi (lịch sự)', base: 'おつかれさまでした' },
    'よろしく': { reading: 'よろしく', pos: 'Thán từ', meaning: 'Rất mong được giúp đỡ', base: 'よろしく' },
    'よろしくお願いします': { reading: 'よろしくお願いします', pos: 'Thán từ', meaning: 'Rất mong được giúp đỡ (lịch sự)', base: 'よろしくお願いします' },

    // =========================================================================
    // TÍNH TỪ & ĐẠI TỪ CƠ BẢN (ADJECTIVES & PRONOUNS)
    // =========================================================================
    '彼': { reading: 'かれ', pos: 'Đại từ', meaning: 'Anh ấy, bạn trai', hanviet: 'BỈ' },
    '彼女': { reading: 'かのじょ', pos: 'Đại từ', meaning: 'Cô ấy, bạn gái', hanviet: 'BỈ NỮ' },
    '誰': { reading: 'だれ', pos: 'Đại từ nghi vấn', meaning: 'Ai, người nào', hanviet: 'THÙY' },
    '何': { reading: 'なに', pos: 'Đại từ nghi vấn', meaning: 'Cái gì, gì', hanviet: 'HÀ' },
    '暑い': { reading: 'あつい', pos: 'Tính từ đuôi い', meaning: 'Nóng nực (thời tiết)', hanviet: 'THỬ' },
    '寒い': { reading: 'さむい', pos: 'Tính từ đuôi い', meaning: 'Lạnh giá (thời tiết)', hanviet: 'HÀN' },
    '熱い': { reading: 'あつい', pos: 'Tính từ đuôi い', meaning: 'Nóng (nhiệt độ đồ vật, nước)', hanviet: 'NHIỆT' },
    '冷たい': { reading: 'つめたい', pos: 'Tính từ đuôi い', meaning: 'Lạnh buốt (đồ vật, nước), lạnh lùng', hanviet: 'LÃNH' },
    '大きい': { reading: 'おおきい', pos: 'Tính từ đuôi い', meaning: 'To lớn', hanviet: 'ĐẠI' },
    '小さい': { reading: 'ちいさい', pos: 'Tính từ đuôi い', meaning: 'Nhỏ bé', hanviet: 'TIỂU' },
    '新しい': { reading: 'あたらしい', pos: 'Tính từ đuôi い', meaning: 'Mới mẻ', hanviet: 'TÂN' },
    '古い': { reading: 'ふるい', pos: 'Tính từ đuôi い', meaning: 'Cũ kỹ, xưa', hanviet: 'CỔ' },
    '良い': { reading: 'よい', pos: 'Tính từ đuôi い', meaning: 'Tốt, đẹp, hay', hanviet: 'LƯƠNG' },
    'いい': { reading: 'いい', pos: 'Tính từ đuôi い', meaning: 'Tốt, được, hay', base: 'いい' },
    '悪い': { reading: 'わるい', pos: 'Tính từ đuôi い', meaning: 'Xấu, tồi tệ, có lỗi', hanviet: 'ÁC' },
    '高い': { reading: 'たかい', pos: 'Tính từ đuôi い', meaning: 'Cao; đắt đỏ', hanviet: 'CAO' },
    '安い': { reading: 'やすい', pos: 'Tính từ đuôi い', meaning: 'Rẻ, rẻ tiền', hanviet: 'AN' },
    '難しい': { reading: 'むずかしい', pos: 'Tính từ đuôi い', meaning: 'Khó khăn, phức tạp', hanviet: 'NAN' },
    '易しい': { reading: 'やさしい', pos: 'Tính từ đuôi い', meaning: 'Dễ dàng, đơn giản', hanviet: 'DỊ' },

    // =========================================================================
    // TỪ NGHI VẤN KẾT HỢP ĐƠN VỊ ĐẾM (QUESTION WORDS + COUNTERS)
    // =========================================================================
    '何人': { reading: 'なんにん', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy người, bao nhiêu người', hanviet: 'HÀ NHÂN', base: '何人' },
    '何回': { reading: 'なんかい', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy lần, bao nhiêu lần', hanviet: 'HÀ HỒI', base: '何回' },
    '何冊': { reading: 'なんさつ', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy quyển, bao nhiêu cuốn (sách)', hanviet: 'HÀ SÁCH', base: '何冊' },
    '何個': { reading: 'なんこ', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy cái, bao nhiêu cái (đồ vật)', hanviet: 'HÀ CÁ', base: '何個' },
    '何本': { reading: 'なんぼん', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy chai, mấy cây (vật thon dài)', hanviet: 'HÀ BẢN', base: '何本' },
    '何枚': { reading: 'なんまい', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy tờ, mấy tấm (vật mỏng)', hanviet: 'HÀ MAI', base: '何枚' },
    '何匹': { reading: 'なんびき', pos: 'Từ nghi vấn (Lượng từ)', meaning: 'Mấy con (động vật nhỏ)', hanviet: 'HÀ THẤT', base: '何匹' },
    '何時': { reading: 'なんじ', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Mấy giờ', hanviet: 'HÀ THỜI', base: '何時' },
    '何分': { reading: 'なんぷん', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Mấy phút, bao nhiêu phút', hanviet: 'HÀ PHÂN', base: '何分' },
    '何歳': { reading: 'なんさい', pos: 'Từ nghi vấn (Tuổi tác)', meaning: 'Mấy tuổi, bao nhiêu tuổi', hanviet: 'HÀ TUẾ', base: '何歳' },
    '何才': { reading: 'なんさい', pos: 'Từ nghi vấn (Tuổi tác)', meaning: 'Mấy tuổi, bao nhiêu tuổi', hanviet: 'HÀ TÀI', base: '何才' },
    '何年': { reading: 'なんねん', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Năm nào, mấy năm', hanviet: 'HÀ NIÊN', base: '何年' },
    '何月': { reading: 'なんがつ', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Tháng mấy', hanviet: 'HÀ NGUYỆT', base: '何月' },
    '何日': { reading: 'なんにち', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Ngày mấy, bao nhiêu ngày', hanviet: 'HÀ NHẬT', base: '何日' },
    '何曜日': { reading: 'なんようび', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Thứ mấy (trong tuần)', hanviet: 'HÀ DIỆU NHẬT', base: '何曜日' },
    '何時間': { reading: 'なんじかん', pos: 'Từ nghi vấn (Thời gian)', meaning: 'Mấy tiếng, bao nhiêu tiếng đồng hồ', hanviet: 'HÀ THỜI GIAN', base: '何時間' }
  };

  // =========================================================================
  // 2. BỘ PHÂN TÍCH CHỮ SỐ & ĐƠN VỊ ĐẾM TIẾNG NHẬT (NUMBER & COUNTER ENGINE)
  // =========================================================================

  const KANJI_DIGITS = { '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const KANJI_UNITS = { '十': 10, '百': 100, '千': 1000, '万': 10000 };

  /**
   * Chuyển đổi chuỗi chữ số Hán tự (Kanji) sang số nguyên
   */
  function parseKanjiNumber(str) {
    if (!str || typeof str !== 'string') return null;
    let val = 0;
    let current = 0;
    let hasMatch = false;

    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (KANJI_DIGITS[ch] !== undefined) {
        current = KANJI_DIGITS[ch];
        hasMatch = true;
      } else if (KANJI_UNITS[ch] !== undefined) {
        hasMatch = true;
        const unit = KANJI_UNITS[ch];
        if (unit === 10000) {
          val = (val + (current || 1)) * unit;
          current = 0;
        } else {
          val += (current || 1) * unit;
          current = 0;
        }
      } else {
        return null;
      }
    }
    val += current;
    return hasMatch ? val : null;
  }

  /**
   * Phát âm số tiếng Nhật thuần túy bằng Hiragana (0 - 99,999,999)
   */
  function getNumberReading(num) {
    if (num === 0) return 'ゼロ';
    if (num < 0 || num > 99999999 || isNaN(num)) return String(num);

    const ONES = ['', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
    const TENS = ['', 'じゅう', 'にじゅう', 'さんじゅう', 'よんじゅう', 'ごじゅう', 'ろくじゅう', 'ななじゅう', 'はちじゅう', 'きゅうじゅう'];
    const HUNDREDS = ['', 'ひゃく', 'にひゃく', 'さんびゃく', 'よんひゃく', 'ごひゃく', 'ろっぴゃく', 'ななひゃく', 'はっぴゃく', 'きゅうひゃく'];
    const THOUSANDS = ['', 'せん', 'にせん', 'さんぜん', 'よんせん', 'ごせん', 'ろくせん', 'ななせん', 'はっせん', 'きゅうせん'];

    function readUnder10000(n) {
      let res = '';
      const th = Math.floor(n / 1000);
      const h = Math.floor((n % 1000) / 100);
      const t = Math.floor((n % 100) / 10);
      const o = n % 10;
      if (th) res += THOUSANDS[th];
      if (h) res += HUNDREDS[h];
      if (t) res += TENS[t];
      if (o) res += ONES[o];
      return res;
    }

    const man = Math.floor(num / 10000);
    const remainder = num % 10000;
    let result = '';
    if (man > 0) {
      result += (man === 1 ? 'いちまん' : readUnder10000(man) + 'まん');
    }
    if (remainder > 0) {
      result += readUnder10000(remainder);
    }
    return result || String(num);
  }

  /**
   * Phát âm số theo tiếng Việt
   */
  function getNumberVietnamese(num) {
    if (num === 0) return 'không';
    if (isNaN(num)) return String(num);

    const UNITS = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    if (num <= 10) {
      if (num === 10) return 'mười';
      return UNITS[num];
    }
    if (num < 20) {
      const o = num % 10;
      return 'mười ' + (o === 5 ? 'lăm' : UNITS[o]);
    }
    if (num < 100) {
      const t = Math.floor(num / 10);
      const o = num % 10;
      let tens = (t === 2 ? 'hai mươi' : t === 3 ? 'ba mươi' : UNITS[t] + ' mươi');
      if (o === 0) return tens;
      if (o === 1) return tens + ' mốt';
      if (o === 4) return tens + ' tư';
      if (o === 5) return tens + ' lăm';
      return tens + ' ' + UNITS[o];
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const rem = num % 100;
      let res = UNITS[h] + ' trăm';
      if (rem === 0) return res;
      if (rem < 10) return res + ' lẻ ' + UNITS[rem];
      return res + ' ' + getNumberVietnamese(rem);
    }
    return String(num);
  }

  /**
   * Bảng quy tắc biến âm và giải nghĩa đơn vị đếm tiếng Nhật (Counters / 助数詞)
   */
  const COUNTER_RULES = {
    // Đếm người
    '人': {
      category: 'person',
      getReading: (num) => {
        if (num === 1) return 'ひとり';
        if (num === 2) return 'ふたり';
        if (num === 4) return 'よにん';
        if (num === 14) return 'じゅうよにん';
        if (num === 24) return 'にじゅうよにん';
        return getNumberReading(num) + 'にん';
      },
      getMeaning: (num) => `${num} người`
    },
    // Đếm sách vở, ấn phẩm
    '冊': {
      category: 'book',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっさつ';
        if (num === 8) return 'はっさつ';
        if (num === 10) return 'じゅっさつ';
        if (last === 1) return base + 'いっさつ';
        if (last === 8) return base + 'はっさつ';
        if (last === 0) return base + 'じゅっさつ';
        return getNumberReading(num) + 'さつ';
      },
      getMeaning: (num) => `${num} quyển, cuốn (sách, vở)`
    },
    // Độ tuổi, thế hệ, thập niên
    '代': {
      category: 'age_generation',
      getReading: (num) => getNumberReading(num) + 'だい',
      getMeaning: (num) => `Độ tuổi ${num}, thế hệ ${num} (${num}〜${num + 9} tuổi)`
    },
    // Khoảng thời gian (tiếng / giờ đồng hồ)
    '時間': {
      category: 'time_duration',
      getReading: (num) => {
        if (num === 4) return 'よじかん';
        if (num === 9) return 'くじかん';
        if (num === 14) return 'じゅうよじかん';
        return getNumberReading(num) + 'じかん';
      },
      getMeaning: (num) => `${num} giờ (${num} tiếng đồng hồ)`
    },
    // Ngày trong tháng / số lượng ngày
    '日': {
      category: 'date_day',
      getReading: (num) => {
        const specialDays = {
          1: 'いちにち (1 ngày) / ついたち (mùng 1)',
          2: 'ふつか',
          3: 'みっか',
          4: 'よっか',
          5: 'いつか',
          6: 'むいか',
          7: 'なのか',
          8: 'ようか',
          9: 'こconoka (ここのか)',
          10: 'とおか',
          14: 'じゅうよっか',
          20: 'はつか',
          24: 'にじゅうよっか'
        };
        if (specialDays[num]) return specialDays[num];
        return getNumberReading(num) + 'にち';
      },
      getMeaning: (num) => num === 1 ? '1 ngày / Mùng 1' : `${num} ngày / Mùng ${num}`
    },
    // Số lần, lượt
    '回': {
      category: 'frequency',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっかい';
        if (num === 6) return 'ろっかい';
        if (num === 8) return 'はっかい';
        if (num === 10) return 'じゅっかい';
        if (last === 1) return base + 'いっかい';
        if (last === 6) return base + 'ろっかい';
        if (last === 8) return base + 'はっかい';
        if (last === 0) return base + 'じゅっかい';
        return getNumberReading(num) + 'かい';
      },
      getMeaning: (num) => `${num} lần, lượt`
    },
    // Vật thon dài: chai, bút, cây, video, trận đấu
    '本': {
      category: 'long_objects',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっぽん';
        if (num === 2) return 'にほん';
        if (num === 3) return 'さんぼん';
        if (num === 6) return 'ろっぽん';
        if (num === 8) return 'はっぽん';
        if (num === 10) return 'じゅっぽん';
        if (last === 1) return base + 'いっぽん';
        if (last === 3) return base + 'さんぼん';
        if (last === 6) return base + 'ろっぽん';
        if (last === 8) return base + 'はっぽん';
        if (last === 0) return base + 'じゅっぽん';
        return getNumberReading(num) + 'ほん';
      },
      getMeaning: (num) => `${num} cái, cây, chai (vật thon dài)`
    },
    // Vật phẳng mỏng: tờ, tấm, chiếc áo, vé
    '枚': {
      category: 'flat_objects',
      getReading: (num) => getNumberReading(num) + 'まい',
      getMeaning: (num) => `${num} tờ, tấm, chiếc (vật phẳng mỏng)`
    },
    // Đồ vật nhỏ, quả, chiếc
    '個': {
      category: 'small_items',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっこ';
        if (num === 6) return 'ろっこ';
        if (num === 8) return 'はっこ';
        if (num === 10) return 'じゅっこ';
        if (last === 1) return base + 'いっこ';
        if (last === 6) return base + 'ろっこ';
        if (last === 8) return base + 'はっこ';
        if (last === 0) return base + 'じゅっこ';
        return getNumberReading(num) + 'こ';
      },
      getMeaning: (num) => `${num} cái, chiếc, quả`
    },
    '箇': {
      category: 'small_items',
      getReading: (num) => COUNTER_RULES['個'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['個'].getMeaning(num)
    },
    // Tuổi tác
    '歳': {
      category: 'age',
      getReading: (num) => {
        if (num === 1) return 'いっさい';
        if (num === 8) return 'はっさい';
        if (num === 10) return 'じゅっさい';
        if (num === 20) return 'はたち (hoặc にじゅっさい)';
        return getNumberReading(num) + 'さい';
      },
      getMeaning: (num) => `${num} tuổi`
    },
    '才': {
      category: 'age',
      getReading: (num) => COUNTER_RULES['歳'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['歳'].getMeaning(num)
    },
    // Năm
    '年': {
      category: 'year',
      getReading: (num) => num === 4 ? 'よねん' : getNumberReading(num) + 'ねん',
      getMeaning: (num) => (num >= 1000 && num <= 2999) ? `Năm ${num}` : `${num} năm`
    },
    '年間': {
      category: 'year_duration',
      getReading: (num) => (num === 4 ? 'よねんかん' : getNumberReading(num) + 'ねんかん'),
      getMeaning: (num) => `${num} năm (khoảng thời gian)`
    },
    // Tháng trong năm
    '月': {
      category: 'month',
      getReading: (num) => {
        if (num === 4) return 'しがつ';
        if (num === 7) return 'しちがつ';
        if (num === 9) return 'くがつ';
        return getNumberReading(num) + 'がつ';
      },
      getMeaning: (num) => `Tháng ${num}`
    },
    // Khoảng thời gian tháng
    'か月': {
      category: 'month_duration',
      getReading: (num) => {
        if (num === 1) return 'いっかげつ';
        if (num === 6) return 'ろっかげつ';
        if (num === 8) return 'はっかげつ';
        if (num === 10) return 'じゅっかげつ';
        return getNumberReading(num) + 'かげつ';
      },
      getMeaning: (num) => `${num} tháng (thời lượng)`
    },
    'ヶ月': {
      category: 'month_duration',
      getReading: (num) => COUNTER_RULES['か月'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['か月'].getMeaning(num)
    },
    'カ月': {
      category: 'month_duration',
      getReading: (num) => COUNTER_RULES['か月'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['か月'].getMeaning(num)
    },
    '箇月': {
      category: 'month_duration',
      getReading: (num) => COUNTER_RULES['か月'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['か月'].getMeaning(num)
    },
    // Khoảng thời gian tuần
    '週間': {
      category: 'week_duration',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっしゅうかん';
        if (num === 8) return 'はっしゅうかん';
        if (num === 10) return 'じゅっしゅうかん';
        if (last === 1) return base + 'いっしゅうかん';
        if (last === 8) return base + 'はっしゅうかん';
        if (last === 0) return base + 'じゅっしゅうかん';
        return getNumberReading(num) + 'しゅうかん';
      },
      getMeaning: (num) => `${num} tuần (khoảng thời gian)`
    },
    '週': {
      category: 'week',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっしゅう';
        if (num === 8) return 'はっしゅう';
        if (num === 10) return 'じゅっしゅう';
        if (last === 1) return base + 'いっしゅう';
        if (last === 8) return base + 'はっしゅう';
        if (last === 0) return base + 'じゅっしゅう';
        return getNumberReading(num) + 'しゅう';
      },
      getMeaning: (num) => `${num} tuần`
    },
    // Khoảng thời gian ngày
    '日間': {
      category: 'date_duration',
      getReading: (num) => (num === 1 ? 'いちにちかん' : COUNTER_RULES['日'].getReading(num) + 'かん'),
      getMeaning: (num) => `${num} ngày (khoảng thời gian ${num} ngày)`
    },
    // Thời điểm giờ
    '時': {
      category: 'time_point',
      getReading: (num) => {
        if (num === 4) return 'よじ';
        if (num === 7) return 'しちじ';
        if (num === 9) return 'くじ';
        return getNumberReading(num) + 'じ';
      },
      getMeaning: (num) => `${num} giờ (thời điểm)`
    },
    // Phút
    '分': {
      category: 'minute',
      getReading: (num) => {
        const last = num % 10;
        const base = num > 10 ? getNumberReading(Math.floor(num / 10) * 10) : '';
        if (num === 1) return 'いっぷん';
        if (num === 2) return 'にふん';
        if (num === 3) return 'さんぷん';
        if (num === 4) return 'よんぷん';
        if (num === 5) return 'ごふん';
        if (num === 6) return 'ろっぷん';
        if (num === 7) return 'ななふん';
        if (num === 8) return 'はっぷん';
        if (num === 9) return 'きゅうふん';
        if (num === 10) return 'じゅっぷん';
        if (last === 1) return base + 'いっぷん';
        if (last === 3) return base + 'さんぷん';
        if (last === 4) return base + 'よんぷん';
        if (last === 6) return base + 'ろっぷん';
        if (last === 8) return base + 'はっぷん';
        if (last === 0) return base + 'じゅっぷん';
        return getNumberReading(num) + 'ふん';
      },
      getMeaning: (num) => `${num} phút`
    },
    // Khoảng thời gian phút
    '分間': {
      category: 'minute_duration',
      getReading: (num) => COUNTER_RULES['分'].getReading(num) + 'かん',
      getMeaning: (num) => `${num} phút (khoảng thời gian ${num} phút)`
    },
    // Giây
    '秒': {
      category: 'second',
      getReading: (num) => getNumberReading(num) + 'びょう',
      getMeaning: (num) => `${num} giây`
    },
    // Tiền tệ Nhật Bản
    '円': {
      category: 'currency',
      getReading: (num) => getNumberReading(num) + 'えん',
      getMeaning: (num) => `${num} Yên Nhật (JPY)`
    },
    // Lần / Độ C, góc độ
    '度': {
      category: 'degree_frequency',
      getReading: (num) => getNumberReading(num) + 'ど',
      getMeaning: (num) => `${num} lần / độ`
    },
    // Động vật nhỏ: chó, mèo, cá
    '匹': {
      category: 'small_animal',
      getReading: (num) => {
        if (num === 1) return 'いっぴき';
        if (num === 3) return 'さんびき';
        if (num === 6) return 'ろっぴき';
        if (num === 8) return 'はっぴき';
        if (num === 10) return 'じゅっぴき';
        return getNumberReading(num) + 'ひき';
      },
      getMeaning: (num) => `${num} con (động vật nhỏ)`
    },
    '疋': {
      category: 'small_animal',
      getReading: (num) => COUNTER_RULES['匹'].getReading(num),
      getMeaning: (num) => COUNTER_RULES['匹'].getMeaning(num)
    },
    // Động vật lớn: bò, voi, ngựa
    '頭': {
      category: 'large_animal',
      getReading: (num) => {
        if (num === 1) return 'いっとう';
        if (num === 8) return 'はっとう';
        if (num === 10) return 'じゅっとう';
        return getNumberReading(num) + 'とう';
      },
      getMeaning: (num) => `${num} con (động vật lớn)`
    },
    // Máy móc, xe cộ, thiết bị
    '台': {
      category: 'machinery',
      getReading: (num) => getNumberReading(num) + 'だい',
      getMeaning: (num) => `${num} chiếc, cái (máy móc, xe cộ)`
    },
    // Bộ quần áo
    '着': {
      category: 'clothing',
      getReading: (num) => (num === 1 ? 'いっちゃく' : getNumberReading(num) + 'ちゃく'),
      getMeaning: (num) => `${num} bộ (quần áo)`
    },
    // Đôi (giày, tất)
    '足': {
      category: 'pairs',
      getReading: (num) => {
        if (num === 1) return 'いっそく';
        if (num === 3) return 'さんぞく';
        if (num === 8) return 'はっそく';
        return getNumberReading(num) + 'そく';
      },
      getMeaning: (num) => `${num} đôi (giày, tất)`
    },
    // Tầng lầu
    '階': {
      category: 'floor',
      getReading: (num) => {
        if (num === 1) return 'いっかい';
        if (num === 3) return 'さんがい';
        if (num === 6) return 'ろっかい';
        if (num === 8) return 'はっかい';
        if (num === 10) return 'じゅっかい';
        return getNumberReading(num) + 'かい';
      },
      getMeaning: (num) => `Tầng ${num}`
    },
    // Căn nhà, ngôi nhà, quán
    '軒': {
      category: 'building',
      getReading: (num) => {
        if (num === 1) return 'いっけん';
        if (num === 3) return 'さんげん';
        if (num === 6) return 'ろっけん';
        if (num === 8) return 'はっけん';
        return getNumberReading(num) + 'けん';
      },
      getMeaning: (num) => `${num} căn, ngôi (nhà, quán)`
    },
    // Cốc, ly, bát
    '杯': {
      category: 'cup',
      getReading: (num) => {
        if (num === 1) return 'いっぱい';
        if (num === 2) return 'にはい';
        if (num === 3) return 'さんばい';
        if (num === 6) return 'ろっぱい';
        return getNumberReading(num) + 'はい';
      },
      getMeaning: (num) => `${num} cốc, ly, bát`
    },
    // Điểm, món
    '点': {
      category: 'point',
      getReading: (num) => getNumberReading(num) + 'てん',
      getMeaning: (num) => `${num} điểm / món`
    },
    // Vụ, việc, tin
    '件': {
      category: 'matter',
      getReading: (num) => (num === 1 ? 'いっけん' : getNumberReading(num) + 'けん'),
      getMeaning: (num) => `${num} vụ, việc, tin`
    },
    // Tàu thuyền lớn
    '隻': {
      category: 'ship',
      getReading: (num) => (num === 1 ? 'いっせき' : getNumberReading(num) + 'せき'),
      getMeaning: (num) => `${num} chiếc (tàu thuyền lớn)`
    },
    // Chim, thỏ
    '羽': {
      category: 'bird',
      getReading: (num) => (num === 3 ? 'さんば' : getNumberReading(num) + 'わ'),
      getMeaning: (num) => `${num} con (chim, thỏ)`
    },
    // Thứ tự, số
    '番目': {
      category: 'ordinal',
      getReading: (num) => getNumberReading(num) + 'ばんめ',
      getMeaning: (num) => `Thứ ${num}`
    },
    '番': {
      category: 'order',
      getReading: (num) => getNumberReading(num) + 'ばん',
      getMeaning: (num) => `Số ${num}, thứ ${num}`
    }
  };

  // Sắp xếp danh sách counter theo độ dài giảm dần
  const SORTED_COUNTER_KEYS = Object.keys(COUNTER_RULES).sort((a, b) => b.length - a.length);

  // =========================================================================
  // BẢNG PHIÊN ÂM KANA SANG ROMAJI (HEPBURN ROMANIZATION TABLE)
  // =========================================================================
  const KANA_ROMAJI_MAP = {
    // Âm ghép (Digraphs)
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'じゃ': 'ja',  'じゅ': 'ju',  'じょ': 'jo',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'ぢゃ': 'ja',  'ぢゅ': 'ju',  'ぢょ': 'jo',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ふぁ': 'fa',  'ふぃ': 'fi',  'ふぇ': 'fe',  'ふぉ': 'fo',
    'てぃ': 'ti',  'でぃ': 'di',  'とぅ': 'tu',  'どぅ': 'du',
    'ちぇ': 'che', 'じぇ': 'je',  'しぇ': 'she',
    'うぃ': 'wi',  'うぇ': 'we',  'うぉ': 'wo',
    'ヴぁ': 'va',  'ヴぃ': 'vi',  'ヴ': 'vu',   'ヴぇ': 've',  'ヴぉ': 'vo',

    // Âm đơn (Monographs)
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'o',  'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
    'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ゎ': 'wa'
  };


  // =========================================================================
  // 3. TỪ CHỈ THỊ (DEMONSTRATIVES)
  // =========================================================================
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

  // =========================================================================
  // 4. TRỢ ĐỘNG TỪ & ĐỘNG TỪ BẤT QUY TẮC (AUXILIARY VERBS)
  // =========================================================================
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

  // =========================================================================
  // 5. BẢNG NGỮ PHÁP & TRỢ TỪ (GRAMMAR & PARTICLES)
  // =========================================================================
  const GRAMMAR_AND_PARTICLES = {
    // Cụm ngữ pháp phỏng đoán & điều kiện & liên từ
    'かもしれません': { pos: 'Cấu trúc ngữ pháp / Trợ động từ', role: 'Phỏng đoán khả năng (lịch sự): có lẽ, có thể, không chừng', meaning: 'Có lẽ, có thể là, không chừng' },
    'かもしれない': { pos: 'Cấu trúc ngữ pháp / Trợ động từ', role: 'Phỏng đoán khả năng (thân mật): có lẽ, có thể, không chừng', meaning: 'Có lẽ, có thể là, không chừng' },
    'かも': { pos: 'Trợ từ / Cụm phỏng đoán rút gọn', role: 'Phỏng đoán thân mật', meaning: 'Có lẽ, có khi' },
    'ように思える': { pos: 'Cụm ngữ pháp / Diễn đạt', role: 'Tự nhiên cảm thấy như, dường như có cảm giác là', meaning: 'Dường như, có cảm giác là' },
    'ように思えます': { pos: 'Cụm ngữ pháp / Diễn đạt', role: 'Tự nhiên cảm thấy như (lịch sự)', meaning: 'Dường như, có cảm giác là' },
    'ように': { pos: 'Cấu trúc ngữ pháp / Liên từ', role: 'Để mà, có vẻ như, sao cho (chỉ mục đích, trạng thái hoặc so sánh)', meaning: 'Để mà, có vẻ như, sao cho' },
    'ような': { pos: 'Cấu trúc ngữ pháp', role: 'Như là, giống như (bổ nghĩa danh từ)', meaning: 'Như là, giống như' },
    'ようだ': { pos: 'Cấu trúc ngữ pháp', role: 'Dường như, có vẻ như (phỏng đoán theo cảm nhận khách quan)', meaning: 'Dường như, có vẻ như' },
    'ようです': { pos: 'Cấu trúc ngữ pháp', role: 'Dường như, có vẻ như (lịch sự)', meaning: 'Dường như, có vẻ như' },
    'なので': { pos: 'Liên từ / Cụm liên kết', role: 'Nguyên nhân, lý do (sau danh từ / tính từ đuôi な / だけ)', meaning: 'Bởi vì, vì là, do đó' },
    'ので': { pos: 'Trợ từ / Liên từ', role: 'Chỉ nguyên nhân, lý do khách quan', meaning: 'Bởi vì, vì' },
    'のに': { pos: 'Trợ từ / Liên từ', role: 'Chỉ sự tương phản, nghịch lý, tiếc nuối (thế mà, mặc dù)', meaning: 'Mặc dù, thế mà' },
    'だけでなく': { pos: 'Cấu trúc ngữ pháp', role: 'Không chỉ ... mà còn', meaning: 'Không chỉ' },
    'ばかりでなく': { pos: 'Cấu trúc ngữ pháp', role: 'Không chỉ ... mà còn', meaning: 'Không chỉ' },
    'わけではない': { pos: 'Cấu trúc ngữ pháp', role: 'Không hẳn là, không có nghĩa là', meaning: 'Không hẳn là' },
    'わけがない': { pos: 'Cấu trúc ngữ pháp', role: 'Lẽ nào lại, tuyệt đối không thể', meaning: 'Làm sao mà... được' },
    'はずだ': { pos: 'Cấu trúc ngữ pháp', role: 'Chắc chắn là (theo logic, tính toán)', meaning: 'Chắc chắn là' },
    'はずです': { pos: 'Cấu trúc ngữ pháp', role: 'Chắc chắn là (lịch sự)', meaning: 'Chắc chắn là' },
    'とともに': { pos: 'Cấu trúc ngữ pháp', role: 'Cùng với, đồng thời với', meaning: 'Cùng với' },
    'にしたがって': { pos: 'Cấu trúc ngữ pháp', role: 'Cùng với việc ..., theo như', meaning: 'Càng ... càng / theo như' },

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

  // =========================================================================
  // 6. QUY TẮC GIẢI CHIA THỂ (DECONJUGATION RULES)
  // =========================================================================
  const DECONJUGATIONS = [
    // 1. Phủ định quá khứ lịch sự: 〜ませんでした
    { suffix: 'ませんでした', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định quá khứ lịch sự (ませんでした)', prefixMeaning: 'Đã không' },
    { suffix: 'ませんでした', newSuffix: 'う', type: 'v5_i', conj: 'Thể phủ định quá khứ lịch sự (ませんでした)', prefixMeaning: 'Đã không' },

    // 2. Quá khứ lịch sự: 〜ました
    { suffix: 'ました', newSuffix: 'る', type: 'v1', conj: 'Thể quá khứ lịch sự (ました)', prefixMeaning: 'Đã' },
    { suffix: 'ました', newSuffix: 'う', type: 'v5_i', conj: 'Thể quá khứ lịch sự (ました)', prefixMeaning: 'Đã' },

    // 3. Phủ định lịch sự: 〜ません
    { suffix: 'ません', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định lịch sự (ません)', prefixMeaning: 'Không' },
    { suffix: 'ません', newSuffix: 'う', type: 'v5_i', conj: 'Thể phủ định lịch sự (ません)', prefixMeaning: 'Không' },

    // 4. Lịch sự hiện tại: 〜ます
    { suffix: 'ます', newSuffix: 'る', type: 'v1', conj: 'Thể lịch sự hiện tại (ます)', prefixMeaning: '' },
    { suffix: 'ます', newSuffix: 'う', type: 'v5_i', conj: 'Thể lịch sự hiện tại (ます)', prefixMeaning: '' },

    // 5. Thể điều kiện phủ định: 〜なければ
    { suffix: 'なければ', newSuffix: 'る', type: 'v1', conj: 'Thể điều kiện phủ định (Nếu không...)', prefixMeaning: 'Nếu không' },
    { suffix: 'なければ', newSuffix: 'う', type: 'v5_a', conj: 'Thể điều kiện phủ định (Nếu không...)', prefixMeaning: 'Nếu không' },

    // 6. Thể phủ định quá khứ: 〜なかった
    { suffix: 'なかった', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định quá khứ (なかった)', prefixMeaning: 'Đã không' },
    { suffix: 'なかった', newSuffix: 'う', type: 'v5_a', conj: 'Thể phủ định quá khứ (なかった)', prefixMeaning: 'Đã không' },

    // 7. Thể phủ định ngắn: 〜ない
    { suffix: 'ない', newSuffix: 'る', type: 'v1', conj: 'Thể phủ định ngắn (ない)', prefixMeaning: 'Không' },
    { suffix: 'ない', newSuffix: 'う', type: 'v5_a', conj: 'Thể phủ định ngắn (ない)', prefixMeaning: 'Không' },

    // 8. Động từ thể Te & Ta nhóm 1: 〜って / 〜った
    { suffix: 'って', newSuffix: 'う', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'って', newSuffix: 'つ', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'って', newSuffix: 'る', type: 'v5_tsu', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'った', newSuffix: 'う', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'った', newSuffix: 'つ', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'った', newSuffix: 'る', type: 'v5_tsu', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 9. Động từ thể Te & Ta đuôi む / ぶ / ぬ: 〜んで / 〜んだ
    { suffix: 'んで', newSuffix: 'む', type: 'v5_m', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'んで', newSuffix: 'ぶ', type: 'v5_m', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'んだ', newSuffix: 'む', type: 'v5_m', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'んだ', newSuffix: 'ぶ', type: 'v5_m', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 10. Động từ thể Te & Ta đuôi く / ぐ: 〜いて / 〜いた / 〜いで / 〜いだ
    { suffix: 'いて', newSuffix: 'く', type: 'v5_k', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'いた', newSuffix: 'く', type: 'v5_k', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },
    { suffix: 'いで', newSuffix: 'ぐ', type: 'v5_g', conj: 'Thể Te (で) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'いだ', newSuffix: 'ぐ', type: 'v5_g', conj: 'Thể Ta (だ) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 11. Động từ thể Te & Ta đuôi す: 〜して / 〜した
    { suffix: 'して', newSuffix: 'す', type: 'v5_s', conj: 'Thể Te (て) nối câu / yêu cầu', prefixMeaning: '' },
    { suffix: 'した', newSuffix: 'す', type: 'v5_s', conj: 'Thể Ta (た) quá khứ ngắn', prefixMeaning: 'Đã' },

    // 12. Tính từ đuôi い: 〜かった, 〜くない, 〜く
    { suffix: 'かった', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Quá khứ)', prefixMeaning: 'Đã' },
    { suffix: 'くない', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Phủ định)', prefixMeaning: 'Không' },
    { suffix: 'く', newSuffix: 'い', type: 'adj_i', conj: 'Tính từ đuôi い (Thể liên từ / Phó từ hóa)', prefixMeaning: '' }
  ];

  const I_TO_U = { 'い':'う', 'き':'く', 'ぎ':'ぐ', 'し':'す', 'ち':'つ', 'に':'ぬ', 'び':'ぶ', 'み':'む', 'り':'る' };
  const A_TO_U = { 'わ':'う', 'か':'く', 'が':'ぐ', 'さ':'す', 'た':'つ', 'な':'ぬ', 'ば':'ぶ', 'ま':'む', 'ら':'る' };

  // =========================================================================
  // 7. LỚP ĐIỀU KHIỂN ENGINE CHÍNH
  // =========================================================================
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

          // Xây dựng bản đồ tra cứu từ thuần Kana (Kana -> Kanji) từ compound_words
          // Giúp nhận diện hơn 137,000 từ vựng viết bằng Hiragana/Katakana mà không bị tách vụn thành ký tự đơn
          this.kanaWordMap = new Map();
          if (this.compoundWords && typeof this.compoundWords === 'object') {
            for (const [kanji, kana] of Object.entries(this.compoundWords)) {
              if (kana && typeof kana === 'string' && kana.length >= 2) {
                if (!this.kanaWordMap.has(kana)) {
                  this.kanaWordMap.set(kana, kanji);
                }
              }
            }
          }
          if (Array.isArray(this.coreDictList)) {
            this.coreDictList.forEach(item => {
              if (item.kana && typeof item.kana === 'string' && item.kana.length >= 2 && !this.kanaWordMap.has(item.kana)) {
                this.kanaWordMap.set(item.kana, item.kanji || item.kana);
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
      if (!text) return '';
      const kanjiChars = text.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
      if (!kanjiChars) return '';
      if (!this.kanjiHanviet) return '';
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
            dropLen = 1;
          } else if (rule.type === 'v5_i') {
            const last = stem.slice(-1);
            if (I_TO_U[last]) {
              cand = stem.slice(0, -1) + I_TO_U[last];
              surfaceSuffix = last + rule.suffix;
              dropLen = 1;
            }
          } else if (rule.type === 'v5_a') {
            const last = stem.slice(-1);
            if (A_TO_U[last]) {
              cand = stem.slice(0, -1) + A_TO_U[last];
              surfaceSuffix = last + rule.suffix;
              dropLen = 1;
            }
          } else if (rule.type === 'adj_i') {
            cand = stem + rule.newSuffix;
            surfaceSuffix = rule.suffix;
            dropLen = 1;
          } else {
            cand = stem + rule.newSuffix;
            surfaceSuffix = rule.suffix;
            dropLen = 1;
          }

          // Không coi cụm thành ngữ chứa trợ từ (như 雨が降る) là một động từ đơn để tránh nuốt trợ từ
          if (cand && !/[がをにはでとへ]/.test(cand) && (BUILTIN_VOCAB[cand] || (this.compoundWords && this.compoundWords[cand]) || (this.coreDictMap && this.coreDictMap.has(cand)))) {
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

        // ===================================================================
        // 2. PHÂN TÍCH CHỮ SỐ & ĐƠN VỊ ĐẾM (NUMBERS & COUNTERS)
        // ===================================================================
        // Nhận diện số Ả Rập (1, 25, 30...) hoặc số Kanji (一, 二, 三, 十...)
        let numParsed = null;
        let numStr = '';
        let numVal = null;
        let isArabic = false;

        const arabicMatch = sentence.slice(i).match(/^[0-9０-９]+/);
        if (arabicMatch) {
          numStr = arabicMatch[0];
          // Chuẩn hóa toàn bộ số full-width sang half-width ASCII
          const normalized = numStr.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
          numVal = parseInt(normalized, 10);
          isArabic = true;
        } else {
          // Thử kiểm tra số Kanji (〇一二三四五六七八九十百千万)
          const kanjiNumMatch = sentence.slice(i).match(/^[〇一二三四五六七八九十百千万]+/);
          if (kanjiNumMatch) {
            const candKanji = kanjiNumMatch[0];
            const parsed = parseKanjiNumber(candKanji);
            if (parsed !== null) {
              numStr = candKanji;
              numVal = parsed;
              isArabic = false;
            }
          }
        }

        if (numStr && numVal !== null) {
          const afterNumIndex = i + numStr.length;
          let matchedCounter = null;
          let matchedCounterKey = '';

          // Quét kiểm tra đơn vị đếm ngay liền kề sau chữ số
          for (const cKey of SORTED_COUNTER_KEYS) {
            if (sentence.startsWith(cKey, afterNumIndex)) {
              matchedCounter = COUNTER_RULES[cKey];
              matchedCounterKey = cKey;
              break;
            }
          }

          if (matchedCounter) {
            // Khớp thành công: [Chữ số] + [Đơn vị đếm] (vd: 30代, 1日, 10時間, 3冊, 三人, 五回...)
            const combinedSurface = numStr + matchedCounterKey;
            const counterReading = matchedCounter.getReading(numVal);
            const counterMeaning = matchedCounter.getMeaning(numVal);
            const isTime = matchedCounter.category.includes('time') || matchedCounter.category.includes('date') || matchedCounter.category.includes('year') || matchedCounter.category.includes('month');

            tokens.push({
              surface: combinedSurface,
              baseForm: combinedSurface,
              reading: counterReading,
              meaning: counterMeaning,
              partOfSpeech: isTime ? 'Thời gian & Lượng từ' : 'Số lượng & Lượng từ',
              grammarRole: isTime ? 'Chỉ thời gian' : 'Số lượng',
              numberValue: numVal,
              counterUnit: matchedCounterKey,
              isNumberCounter: true,
              isGrammar: false,
              source: 'number-counter-engine'
            });
            i += combinedSurface.length;
            continue;
          }

          // Nếu là số Ả Rập thuần túy (không kèm đơn vị đếm): vd 1, 25, 100
          if (isArabic) {
            const jpReading = getNumberReading(numVal);
            const vnMeaning = getNumberVietnamese(numVal);
            tokens.push({
              surface: numStr,
              baseForm: numStr,
              reading: jpReading || numStr,
              meaning: `Số ${numVal} (${vnMeaning})`,
              partOfSpeech: 'Chữ số',
              grammarRole: 'Số lượng',
              numberValue: numVal,
              isAlphanumeric: true,
              isNumberCounter: true,
              isGrammar: false,
              source: 'number-engine'
            });
            i += numStr.length;
            continue;
          }

          // Nếu là số Kanji đứng độc lập (vd: 一, 二, 百 đứng trước trợ từ hoặc dấu câu)
          const nextChar = sentence[afterNumIndex] || '';
          if (!nextChar || /[\s\u3000、。，．,!！？?はがをにでもへとよりからまでだです]/.test(nextChar)) {
            const jpReading = getNumberReading(numVal);
            const vnMeaning = getNumberVietnamese(numVal);
            tokens.push({
              surface: numStr,
              baseForm: numStr,
              reading: jpReading,
              meaning: `Số ${numVal} (${vnMeaning})`,
              partOfSpeech: 'Chữ số (Kanji)',
              grammarRole: 'Số lượng',
              numberValue: numVal,
              isNumberCounter: true,
              isGrammar: false,
              source: 'number-engine'
            });
            i += numStr.length;
            continue;
          }
        }

        // ===================================================================
        // 3. KÝ TỰ LATIN / THUẬT NGỮ LAI KATAKANA (e.g. eスポーツ, Tシャツ, SNS, AI...)
        // ===================================================================
        const hybridMatch = sentence.slice(i).match(/^[A-Za-z0-9]+[\-ー・]?[\u30a0-\u30ff]+/);
        if (hybridMatch) {
          const hybWord = hybridMatch[0];
          const bInfo = BUILTIN_VOCAB[hybWord];
          const coreInfo = this.coreDictMap ? this.coreDictMap.get(hybWord) : null;
          tokens.push({
            surface: hybWord,
            start: i,
            end: i + hybWord.length,
            baseForm: hybWord,
            reading: (bInfo ? bInfo.reading : '') || hybWord,
            meaning: (bInfo ? bInfo.meaning : '') || (coreInfo ? coreInfo.meaning : 'Từ ngoại lai Katakana / Alphanumeric'),
            partOfSpeech: (bInfo ? bInfo.pos : '') || 'Danh từ (Katakana/Alphanumeric)',
            grammarRole: 'Thành phần từ vựng',
            isAlphanumeric: true,
            isGrammar: false,
            source: bInfo ? 'builtin-vocab' : 'alphanumeric-hybrid'
          });
          i += hybWord.length;
          continue;
        }

        const latinMatch = sentence.slice(i).match(/^[A-Za-z]+/);
        if (latinMatch) {
          const latWord = latinMatch[0];
          const bInfo = BUILTIN_VOCAB[latWord];
          tokens.push({
            surface: latWord,
            start: i,
            end: i + latWord.length,
            baseForm: latWord,
            reading: bInfo ? bInfo.reading : latWord,
            meaning: bInfo ? bInfo.meaning : 'Từ ngoại lai / Thuật ngữ (Latin)',
            partOfSpeech: bInfo ? bInfo.pos : 'Từ ngoại lai (Latin)',
            grammarRole: 'Thuật ngữ',
            isAlphanumeric: true,
            isGrammar: false,
            source: 'alphanumeric'
          });
          i += latWord.length;
          continue;
        }

        // ===================================================================
        // 4. CHUỖI KATAKANA (MƯỢN TỪ NƯỚC NGOÀI)
        // ===================================================================
        const katakanaMatch = sentence.slice(i).match(/^[\u30a0-\u30ffー]+/);
        if (katakanaMatch) {
          const kataWord = katakanaMatch[0];
          const bInfo = BUILTIN_VOCAB[kataWord];
          const coreInfo = this.coreDictMap ? this.coreDictMap.get(kataWord) : null;
          let kataMeaning = (bInfo ? bInfo.meaning : '') || (coreInfo ? coreInfo.meaning : '');
          if (!kataMeaning) {
            kataMeaning = (this.compoundWords && this.compoundWords[kataWord]) ? 'Từ mượn Katakana' : 'Từ ngoại lai Katakana';
          }

          tokens.push({
            surface: kataWord,
            baseForm: kataWord,
            reading: kataWord,
            meaning: kataMeaning,
            partOfSpeech: (bInfo ? bInfo.pos : (coreInfo ? coreInfo.partOfSpeech : 'Danh từ (Katakana)')),
            grammarRole: 'Thành phần từ vựng',
            isKatakana: true,
            isGrammar: false,
            source: 'katakana'
          });
          i += kataWord.length;
          continue;
        }

        // ===================================================================
        // 5. TỪ CHỈ THỊ (DEMONSTRATIVES: この, その, あの, どの...)
        // ===================================================================
        let demoMatched = false;
        for (const [dWord, dInfo] of Object.entries(DEMONSTRATIVES)) {
          if (sentence.startsWith(dWord, i)) {
            // Kiểm tra xem có từ vựng dài hơn bắt đầu bằng chuỗi chỉ thị này không (vd: それから, それに, そのうち...)
            // Nếu có từ vựng dài hơn, để cho bộ Longest Match ở bước 8 xử lý từ hoàn chỉnh thay vì tách vụn
            let hasLongerWord = false;
            for (let l = Math.min(8, len - i); l > dWord.length; l--) {
              const longerSub = sentence.substr(i, l);
              if (BUILTIN_VOCAB[longerSub] || 
                  (this.coreDictMap && this.coreDictMap.has(longerSub)) || 
                  (this.compoundWords && this.compoundWords[longerSub]) ||
                  (this.kanaWordMap && this.kanaWordMap.has(longerSub))) {
                hasLongerWord = true;
                break;
              }
            }
            if (hasLongerWord) {
              // Bỏ qua demonstrative ngắn để ưu tiên từ vựng dài hơn
              break;
            }

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

        // ===================================================================
        // 6. TRỢ ĐỘNG TỪ & ĐỘNG TỪ BẤT QUY TẮC (Suru, Iru, Naru, Kuru forms)
        // ===================================================================
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

        // ===================================================================
        // 7. CẤU TRÚC NGỮ PHÁP & TRỢ TỪ ĐA KÝ TỰ (てから, より, から, まで, です...)
        // ===================================================================
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

        // ===================================================================
        // 7.5. PHÂN TÍCH TRỢ TỪ LIỀN SAU THÀNH PHẦN CÂU
        // Tránh việc trợ từ + ký tự đầu từ tiếp theo bị nuốt nhầm thành từ hiếm 2 ký tự 
        // (vd: は + さらに bị nuốt thành "はさ", は + とても bị nuốt thành "はと")
        // ===================================================================
        const pCandidate = sentence[i];
        if (tokens.length > 0 && GRAMMAR_AND_PARTICLES[pCandidate] && pCandidate.length === 1 && !/[0-9A-Za-z]/.test(pCandidate)) {
          const rest = sentence.slice(i + 1);
          if (rest.length > 0) {
            let nextStartsWord = false;
            // Kế tiếp là Kanji, Katakana, Chữ số hoặc Latin
            if (/^[\u4e00-\u9faf\u3400-\u4dbf\u30a0-\u30ff0-9０-９A-Za-z]/.test(rest)) {
              nextStartsWord = true;
            } else {
              // Hoặc kế tiếp bắt đầu bằng một từ vựng Hiragana/Kana hoàn chỉnh có độ dài >= 2 (vd: さらに, とても, それから...)
              for (let l = Math.min(8, rest.length); l >= 2; l--) {
                const candWord = rest.substr(0, l);
                if (BUILTIN_VOCAB[candWord] || 
                    (this.coreDictMap && this.coreDictMap.has(candWord)) || 
                    (this.kanaWordMap && this.kanaWordMap.has(candWord))) {
                  nextStartsWord = true;
                  break;
                }
              }
            }

            if (nextStartsWord) {
              const gInfo = GRAMMAR_AND_PARTICLES[pCandidate];
              tokens.push({
                surface: pCandidate,
                baseForm: pCandidate,
                reading: gInfo.reading || pCandidate,
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
          }
        }

        // ===================================================================
        // 8. LONGEST MATCH TÌM TỪ VỰNG TRONG TỪ ĐIỂN (8 ký tự xuống 1 ký tự)
        // ===================================================================
        let bestMatch = null;
        for (let l = Math.min(8, len - i); l >= 1; l--) {
          const sub = sentence.substr(i, l);

          // Ngoại lệ: "今日は" trong câu thông thường (không phải lời chào đứng riêng)
          // là "今日" (きょう, hôm nay) + trợ từ "は" (わ, topic marker).
          if (sub === '今日は' && len > 3 && !sentence.startsWith('今日は！', i) && !sentence.startsWith('今日は!', i)) {
            continue;
          }

          // A. Khớp trong bảng Built-in Lexicon, Core Dict, Compound Words hoặc Kana Word Map
          const bInfo = BUILTIN_VOCAB[sub];
          const coreInfo = this.coreDictMap ? this.coreDictMap.get(sub) : null;
          const cwReading = this.compoundWords ? this.compoundWords[sub] : null;
          const kanaKanji = (l >= 2 && this.kanaWordMap) ? this.kanaWordMap.get(sub) : null;

          if (bInfo || coreInfo || cwReading || kanaKanji) {
            let rd = (bInfo ? bInfo.reading : '') || (coreInfo ? coreInfo.kana : '') || cwReading || sub;
            let mn = (bInfo ? bInfo.meaning : '') || (coreInfo ? coreInfo.meaning : '');
            let pos = (bInfo ? bInfo.pos : '') || (coreInfo ? coreInfo.partOfSpeech : '');
            let hv = (bInfo ? bInfo.hanviet : '') || this.getHanViet(sub);
            let baseWord = (bInfo && bInfo.base) ? bInfo.base : sub;

            // Nếu khớp qua kanaWordMap (từ viết bằng Hiragana/Kana ánh xạ sang Kanji trong compoundWords)
            if (kanaKanji && !bInfo && !coreInfo) {
              const kInfo = BUILTIN_VOCAB[kanaKanji];
              const kCore = this.coreDictMap ? this.coreDictMap.get(kanaKanji) : null;
              if (kInfo) {
                if (!mn) mn = kInfo.meaning;
                if (!pos) pos = kInfo.pos;
              } else if (kCore) {
                if (!mn) mn = kCore.meaning;
                if (!pos) pos = kCore.partOfSpeech;
              }
              if (!hv) hv = this.getHanViet(kanaKanji);
              baseWord = kanaKanji;
              rd = sub;
            }

            bestMatch = {
              surface: sub,
              baseForm: baseWord,
              reading: rd || sub,
              meaning: mn,
              partOfSpeech: pos || 'Từ vựng',
              grammarRole: 'Thành phần từ vựng',
              hanviet: hv,
              isGrammar: false,
              source: bInfo ? 'builtin-vocab' : (coreInfo ? 'core-dict' : (kanaKanji ? 'kana-compound-map' : 'compound-words')),
              length: l
            };
            break;
          }

          // B. Là từ chia thể (Deconjugation: 見ました -> 見る, 行かなければ -> 行く, 思った -> 思う)
          const deconjList = this.deconjugate(sub);
          if (deconjList.length > 0) {
            const dItem = deconjList[0];
            const baseWord = dItem.base;
            const bInfo = BUILTIN_VOCAB[baseWord];
            const coreInfo = this.coreDictMap ? this.coreDictMap.get(baseWord) : null;
            const baseReading = (bInfo ? bInfo.reading : '') || (coreInfo ? coreInfo.kana : '') || (this.compoundWords && this.compoundWords[baseWord]) || baseWord;
            const baseMeaning = (bInfo ? bInfo.meaning : '') || (coreInfo ? coreInfo.meaning : '');

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
              hanviet: (bInfo ? bInfo.hanviet : '') || this.getHanViet(baseWord),
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

        // ===================================================================
        // 9. TRỢ TỪ ĐƠN KÝ TỰ (は, が, を, に, で, と, も, の, ね, よ, か, だ)
        // ===================================================================
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

        // 10. Nếu có bestMatch độ dài 1 ký tự
        if (bestMatch) {
          tokens.push(bestMatch);
          i++;
          continue;
        }

        // ===================================================================
        // 11. XỬ LÝ TỪ KHÔNG ĐƯỢC NHẬN DIỆN (BẢO TOÀN CHUỖI, KHÔNG TÁCH VỤN)
        // ===================================================================
        const isKanji = /[\u4e00-\u9faf\u3400-\u4dbf]/.test(singleChar);
        if (isKanji) {
          const hv = this.getHanViet(singleChar);
          tokens.push({
            surface: singleChar,
            baseForm: singleChar,
            reading: singleChar,
            meaning: hv ? `Chữ Hán (${hv})` : 'Chữ Hán',
            partOfSpeech: 'Hán tự đơn',
            grammarRole: 'Thành phần ký tự',
            hanviet: hv,
            isGrammar: false,
            source: 'kanji-db'
          });
          i++;
          continue;
        }

        // Nếu là cụm ký tự Kana chưa nhận diện được (giữ nguyên chuỗi thay vì tách vụn từng ký tự)
        if (/[\u3040-\u309f\u30a0-\u30ff]/.test(singleChar)) {
          let unkEnd = i + 1;
          while (unkEnd < len) {
            const nextCh = sentence[unkEnd];
            // Dừng nếu gặp dấu câu, khoảng trắng, số, latin, kanji
            if (/[\s\u3000、。，．,!！？?・…:：()（）「」『』【】\[\]{}ー〜～\-\/\n\r0-9０-９A-Za-z\u4e00-\u9faf\u3400-\u4dbf]/.test(nextCh)) {
              break;
            }
            // Dừng nếu tại vị trí unkEnd bắt đầu có từ điển hoặc trợ từ nhận diện được
            let hasDictMatch = false;
            for (let l = Math.min(8, len - unkEnd); l >= 1; l--) {
              const testSub = sentence.substr(unkEnd, l);
              if (BUILTIN_VOCAB[testSub] || 
                  (this.coreDictMap && this.coreDictMap.has(testSub)) ||
                  (this.compoundWords && this.compoundWords[testSub]) ||
                  (this.kanaWordMap && this.kanaWordMap.has(testSub)) ||
                  (GRAMMAR_AND_PARTICLES[testSub])) {
                hasDictMatch = true;
                break;
              }
            }
            if (hasDictMatch) break;
            unkEnd++;
          }

          const unkSurface = sentence.slice(i, unkEnd);
          tokens.push({
            surface: unkSurface,
            baseForm: unkSurface,
            reading: unkSurface,
            meaning: 'Từ chưa xác định',
            partOfSpeech: 'Chưa xác định',
            grammarRole: 'Thành phần chưa xác định',
            isGrammar: false,
            isUnknown: true,
            source: 'unrecognized-sequence'
          });
          i = unkEnd;
          continue;
        }

        // Ký tự biểu tượng lạ / khác
        tokens.push({
          surface: singleChar,
          baseForm: singleChar,
          reading: singleChar,
          meaning: 'Ký tự',
          partOfSpeech: 'Ký tự',
          grammarRole: 'Ký tự',
          isGrammar: false,
          source: 'unknown'
        });
        i++;
      }

      // Gán Romaji (Hepburn) và chuẩn hóa thông tin hiển thị cho mọi token
      tokens.forEach((t, idx) => {
        t.id = `tok_${idx}`;
        if (t.start === undefined) {
          // Tính toán vị trí start và end nếu chưa được gắn trực tiếp
          let pos = 0;
          for (let p = 0; p < idx; p++) {
            pos += tokens[p].surface.length;
          }
          t.start = pos;
          t.end = pos + t.surface.length;
        }
        if (!t.dictionaryMeaning) {
          t.dictionaryMeaning = t.meaning || '';
        }
        t.morphology = {
          conjugation: t.conjugation || '',
          isParticle: !!t.isParticle,
          isAuxiliary: !!t.isAuxiliary,
          isNumberCounter: !!t.isNumberCounter,
          isGrammar: !!t.isGrammar,
          isKatakana: !!t.isKatakana,
          isAlphanumeric: !!t.isAlphanumeric,
          numberValue: t.numberValue,
          counterUnit: t.counterUnit
        };

        if (!t.isPunctuation) {
          const readingForRomaji = (t.reading && t.reading !== '—') ? t.reading : (t.baseReading || t.surface);
          t.romaji = this.toRomaji(readingForRomaji);
        } else {
          t.romaji = '';
        }
      });

      return tokens;
    }

    /**
     * Chuyển đổi Kana (Hiragana / Katakana) sang Romaji chuẩn Hepburn
     */
    toRomaji(kana) {
      if (!kana || typeof kana !== 'string') return '';
      // Chuẩn hóa Katakana sang Hiragana
      let hira = '';
      for (let i = 0; i < kana.length; i++) {
        const code = kana.charCodeAt(i);
        if (code >= 0x30A1 && code <= 0x30F6) {
          hira += String.fromCharCode(code - 0x60);
        } else {
          hira += kana[i];
        }
      }

      let res = '';
      let i = 0;
      while (i < hira.length) {
        // Xử lý sokuon っ (âm ngắt)
        if (hira[i] === 'っ') {
          const nextTwo = hira.slice(i + 1, i + 3);
          const nextOne = hira.slice(i + 1, i + 2);
          const nextRomaji = KANA_ROMAJI_MAP[nextTwo] || KANA_ROMAJI_MAP[nextOne] || '';
          if (nextRomaji) {
            if (nextRomaji.startsWith('ch')) {
              res += 't';
            } else {
              res += nextRomaji[0];
            }
          }
          i++;
          continue;
        }

        // Xử lý trường âm ー
        if (hira[i] === 'ー') {
          if (res.length > 0) {
            const lastVowel = res[res.length - 1];
            if (/[aeiou]/.test(lastVowel)) {
              res += lastVowel;
            } else {
              res += '-';
            }
          } else {
            res += '-';
          }
          i++;
          continue;
        }

        // Kiểm tra 2 ký tự (âm ghép: きゃ, しょ...)
        if (i + 1 < hira.length) {
          const twoChar = hira.slice(i, i + 2);
          if (KANA_ROMAJI_MAP[twoChar]) {
            res += KANA_ROMAJI_MAP[twoChar];
            i += 2;
            continue;
          }
        }

        // Kiểm tra 1 ký tự
        const oneChar = hira[i];
        if (KANA_ROMAJI_MAP[oneChar]) {
          res += KANA_ROMAJI_MAP[oneChar];
        } else {
          res += oneChar;
        }
        i++;
      }
      return res;
    }

    /**
     * Làm giàu nghĩa tiếng Việt và cách đọc cho các token từ vựng chưa có nghĩa
     * Truy vấn IndexedDB và Chrome Background Translation Service
     * Đảm bảo: Ánh xạ chính xác từng token nguồn, loại trừ hoàn toàn việc ghi đè chéo
     */
    async enrichTokens(tokens) {
      if (!tokens || tokens.length === 0) return tokens;

      // Lọc các token từ vựng cần bổ sung nghĩa
      // TUYỆT ĐỐI KHÔNG tra cứu dấu câu, trợ từ, cấu trúc ngữ pháp hoặc ký tự Kana đơn lẻ
      const tokensNeedingMeaning = tokens.filter(t => 
        !t.isPunctuation && 
        !t.isParticle &&
        !t.isGrammar &&
        !t.isNumberCounter &&
        !/^[\u3040-\u309f]$/.test(t.surface) &&
        (!t.meaning || t.meaning === '—' || t.meaning.trim() === '' || t.meaning === 'Từ ngoại lai Katakana' || t.meaning === 'Từ mượn Katakana')
      );

      if (tokensNeedingMeaning.length === 0) return tokens;

      const wordsToLookup = [...new Set(tokensNeedingMeaning.map(t => t.baseForm || t.surface))];

      // 1. Thử tra cứu từ JPEXDatabase (IndexedDB) nếu có sẵn
      if (typeof root !== 'undefined' && root.db && typeof root.db.findExact === 'function') {
        try {
          await Promise.all(tokensNeedingMeaning.map(async (tok) => {
            const key = tok.baseForm || tok.surface;
            const res = await root.db.findExact(key);
            if (res && res.meaning) {
              const isMatch = (res.kanji === tok.surface || res.kanji === tok.baseForm || res.kana === tok.surface || res.kana === tok.reading);
              if (isMatch) {
                tok.meaning = res.meaning;
                if (res.partOfSpeech && (!tok.partOfSpeech || tok.partOfSpeech === 'Từ vựng' || tok.partOfSpeech === 'Chưa xác định')) {
                  tok.partOfSpeech = res.partOfSpeech;
                }
                if (res.kana && (!tok.reading || tok.reading === tok.surface)) {
                  tok.reading = res.kana;
                }
              }
            }
          }));
        } catch (e) {
          // Bỏ qua lỗi IndexedDB, fallback sang background
        }
      }

      // 2. Thử gọi Chrome Runtime Background Service Worker để tra cứu đa nguồn
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          const resp = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'batchLookupWords', words: wordsToLookup }, (res) => {
              if (chrome.runtime.lastError) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          });

          if (resp && resp.success && resp.results) {
            tokensNeedingMeaning.forEach(token => {
              const key = token.baseForm || token.surface;
              const found = resp.results[key] || resp.results[token.surface];
              if (found) {
                // KIỂM TRA CHẶT CHẼ: Kết quả phải tương ứng trực tiếp với token nguồn
                const isExact = (found.kanji && (found.kanji === token.surface || found.kanji === token.baseForm)) ||
                                (found.reading && (found.reading === token.surface || found.reading === token.reading)) ||
                                (found.query && (found.query === token.surface || found.query === token.baseForm));

                if (isExact && (found.meaning || found.meaningVi)) {
                  token.meaning = found.meaningVi || found.meaning;
                  if (found.pos && (!token.partOfSpeech || token.partOfSpeech === 'Từ vựng' || token.partOfSpeech === 'Chưa xác định')) {
                    token.partOfSpeech = found.pos;
                  }
                  if (found.reading && (!token.reading || token.reading === token.surface)) {
                    token.reading = found.reading;
                    token.romaji = this.toRomaji(found.reading);
                  }
                  if (found.hanviet && !token.hanviet) {
                    token.hanviet = found.hanviet;
                  }
                }
              }
            });
          }
        } catch (e) {
          // Background service worker timeout hoặc offline
        }
      }

      // 3. Fallback cho các token vẫn chưa tìm thấy nghĩa sau khi đã tra cứu
      tokensNeedingMeaning.forEach(token => {
        if (!token.meaning || token.meaning === '—' || token.meaning.trim() === '') {
          if (token.hanviet) {
            token.meaning = `Chữ Hán (${token.hanviet})`;
          } else {
            token.meaning = 'Chưa có trong từ điển';
          }
        }
      });

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
     * Nhận diện cấu trúc ngữ pháp local (Local Grammar Engine)
     */
    detectLocalGrammar(tokens, sentence) {
      if (!tokens || tokens.length === 0) return [];
      const grammarPoints = [];
      const s = sentence || '';

      // 1. Phỏng đoán: 〜かもしれない / 〜かもしれません
      const kamoTok = tokens.find(t => t.surface === 'かもしれません' || t.surface === 'かもしれない');
      if (kamoTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜かもしれない / 〜かもしれません',
          surface: kamoTok.surface,
          meaningVi: 'Có lẽ, có thể là, không chừng (phỏng đoán khả năng)',
          explanationVi: 'Biểu thị sự phỏng đoán của người nói với mức độ chắc chắn khoảng 50%. Thường đứng cuối câu để diễn đạt phỏng đoán nhẹ nhàng.',
          level: 'N4',
          tokenIds: [kamoTok.id],
          source: 'local-rule'
        });
      }

      // 2. Diễn đạt cảm nhận tự phát: 〜ように思える / 〜ように思えます
      const youniTok = tokens.find(t => t.surface === 'ように');
      const omoeruTok = tokens.find(t => t.surface === '思える' || t.surface === '思えます');
      if (youniTok && omoeruTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜ように思える / 〜ように思えます',
          surface: `${youniTok.surface}${omoeruTok.surface}`,
          meaningVi: 'Dường như cảm thấy như là, có cảm giác là',
          explanationVi: 'Kết hợp giữa ように (như là) và động từ tự phát 思える (tự nhiên nảy sinh suy nghĩ), dùng để diễn đạt cảm nhận chủ quan một cách tế nhị, khiêm nhường.',
          level: 'N3',
          tokenIds: [youniTok.id, omoeruTok.id],
          source: 'local-rule'
        });
      } else if (youniTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜ように',
          surface: youniTok.surface,
          meaningVi: 'Để mà, sao cho, có vẻ như',
          explanationVi: 'Biểu thị mục đích của hành động (làm gì để đạt trạng thái...) hoặc biểu thị trạng thái tương tự.',
          level: 'N4 - N3',
          tokenIds: [youniTok.id],
          source: 'local-rule'
        });
      }

      // 3. Nguyên nhân / lý do: 〜だけなので / 〜なので / 〜ので
      const dakeTok = tokens.find(t => t.surface === 'だけ');
      const nanodeTok = tokens.find(t => t.surface === 'なので');
      const nodeTok = tokens.find(t => t.surface === 'ので');
      if (dakeTok && nanodeTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜だけなので',
          surface: 'だけなので',
          meaningVi: 'Chỉ vì là, bởi vì chỉ...',
          explanationVi: 'Kết hợp giữa trợ từ giới hạn だけ (chỉ) và liên từ なので (bởi vì), biểu thị nguyên nhân một cách khách quan rằng hành động chỉ dừng lại ở mức độ đó.',
          level: 'N4',
          tokenIds: [dakeTok.id, nanodeTok.id],
          source: 'local-rule'
        });
      } else if (nanodeTok || nodeTok) {
        const target = nanodeTok || nodeTok;
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: target.surface === 'なので' ? '〜なので' : '〜ので',
          surface: target.surface,
          meaningVi: 'Bởi vì, do... (nguyên nhân khách quan)',
          explanationVi: 'Liên từ chỉ nguyên nhân, lý do một cách khách quan, nhẹ nhàng và lịch sự hơn から.',
          level: 'N5 - N4',
          tokenIds: [target.id],
          source: 'local-rule'
        });
      }

      // 4. Thể tiếp diễn / Trạng thái kéo dài: 〜ている / 〜ています
      const teTok = tokens.find(t => t.surface === 'して' || t.surface.endsWith('て') || t.surface.endsWith('で'));
      const iruTok = tokens.find(t => t.surface === 'いる' || t.surface === 'います' || t.surface === 'いた' || t.surface === 'いました');
      if (teTok && iruTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜ている / 〜ています',
          surface: `${teTok.surface}${iruTok.surface}`,
          meaningVi: 'Đang làm gì (tiếp diễn) / Trạng thái kéo dài',
          explanationVi: 'Biểu thị hành động đang diễn ra tại thời điểm nói, hoặc trạng thái của chủ thể là kết quả của một hành động đã diễn ra.',
          level: 'N5',
          tokenIds: [teTok.id, iruTok.id],
          source: 'local-rule'
        });
      }

      // 5. Cấu trúc bắt buộc: 〜なければならない / 〜なければなりません
      const nakerebaTok = tokens.find(t => t.surface.includes('なければ'));
      const narimasenTok = tokens.find(t => t.surface.includes('なりません') || t.surface.includes('ならない'));
      if (nakerebaTok && narimasenTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜なければならない / 〜なければなりません',
          surface: `${nakerebaTok.surface}${narimasenTok.surface}`,
          meaningVi: 'Phải làm gì (nghĩa vụ bắt buộc)',
          explanationVi: 'Cấu trúc biểu thị một việc bắt buộc phải làm theo quy tắc, bổn phận hoặc lẽ tự nhiên.',
          level: 'N4',
          tokenIds: [nakerebaTok.id, narimasenTok.id],
          source: 'local-rule'
        });
      }

      // 6. Trình tự thời gian: 〜てから
      const tekaraTok = tokens.find(t => t.surface === 'てから');
      if (tekaraTok) {
        grammarPoints.push({
          id: `gp_${grammarPoints.length}`,
          pattern: '〜てから',
          surface: 'てから',
          meaningVi: 'Sau khi làm V1 thì làm V2',
          explanationVi: 'Biểu thị trình tự thời gian rõ ràng: hành động V1 kết thúc hoàn toàn thì hành động V2 mới bắt đầu.',
          level: 'N5',
          tokenIds: [tekaraTok.id],
          source: 'local-rule'
        });
      }

      return grammarPoints;
    }

    /**
     * Nhóm các token thành các cụm ngữ nghĩa Bunsetsu / Mệnh đề (Semantic Chunk Builder)
     */
    buildLocalChunks(tokens, sentence) {
      if (!tokens || tokens.length === 0) return [];
      const nonPunctTokens = tokens.filter(t => !t.isPunctuation);
      if (nonPunctTokens.length === 0) return [];

      const chunks = [];
      let currentTokens = [];

      function flushChunk(role = 'Thành phần câu') {
        if (currentTokens.length === 0) return;
        const surf = currentTokens.map(t => t.surface).join('');
        const meaningParts = currentTokens.map(t => t.meaning).filter(m => m && m !== '—');
        const chunkMeaning = meaningParts.join(' • ');

        let determinedRole = role;
        const lastTok = currentTokens[currentTokens.length - 1];
        const firstTok = currentTokens[0];

        if (lastTok.surface === 'は' || lastTok.surface === 'が' || lastTok.surface === 'も') {
          determinedRole = 'Chủ đề / Chủ ngữ câu';
        } else if (lastTok.surface === 'を' || lastTok.surface === 'に' || lastTok.surface === 'へ') {
          determinedRole = 'Đối tượng tác động (Tân ngữ / Nơi đến)';
        } else if (surf.includes('なので') || surf.includes('ので') || surf.includes('から')) {
          determinedRole = 'Mệnh đề nguyên nhân, lý do';
        } else if (surf.includes('かもしれません') || surf.includes('思える') || surf.includes('でしょう')) {
          determinedRole = 'Vị ngữ phỏng đoán / Đánh giá';
        } else if (lastTok.pos && lastTok.pos.includes('Động từ')) {
          determinedRole = 'Hành động / Vị ngữ chính';
        } else if (firstTok.pos && firstTok.pos.includes('Phó từ')) {
          determinedRole = 'Bổ ngữ mức độ / Phó từ';
        }

        chunks.push({
          id: `chk_${chunks.length}`,
          surface: surf,
          start: currentTokens[0].start,
          end: currentTokens[currentTokens.length - 1].end,
          tokenIds: currentTokens.map(t => t.id),
          roleVi: determinedRole,
          meaningVi: chunkMeaning || surf,
          explanationVi: currentTokens.map(t => `${t.surface} (${t.meaning})`).join(' + '),
          source: 'local-rule'
        });
        currentTokens = [];
      }

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.isPunctuation) {
          flushChunk();
          continue;
        }

        currentTokens.push(tok);

        // Các điểm ngắt tự nhiên thành cụm:
        // 1. Gặp trợ từ cách (は, が, を, に, で, へ, も, と)
        if (tok.surface === 'は' || tok.surface === 'が' || tok.surface === 'を' || tok.surface === 'に' || tok.surface === 'で' || tok.surface === 'へ' || tok.surface === 'も') {
          flushChunk('Thành phần trợ từ');
          continue;
        }

        // 2. Gặp liên từ chỉ nguyên nhân (なので, ので, から)
        if (tok.surface === 'なので' || tok.surface === 'ので' || tok.surface === 'から') {
          flushChunk('Mệnh đề nguyên nhân');
          continue;
        }

        // 3. Token là phó từ đứng một mình (như あまり, とても, さらに)
        if (tok.partOfSpeech && tok.partOfSpeech.includes('Phó từ') && currentTokens.length === 1) {
          flushChunk('Bổ ngữ phó từ');
          continue;
        }
      }

      flushChunk('Vị ngữ cuối câu');
      return chunks;
    }

    /**
     * Xây dựng giải thích logic toàn câu và bản dịch cục bộ (Local Sentence Logic Builder)
     */
    buildLocalSentenceLogic(tokens, chunks, grammarPoints, sentence) {
      const topicChunk = chunks.find(c => c.roleVi && c.roleVi.includes('Chủ đề'));
      const reasonChunk = chunks.find(c => c.roleVi && c.roleVi.includes('nguyên nhân'));
      const objChunk = chunks.find(c => c.roleVi && c.roleVi.includes('Tân ngữ'));
      const predChunk = chunks.find(c => c.roleVi && (c.roleVi.includes('Vị ngữ') || c.roleVi.includes('Hành động')));

      let logicText = '• **Phân tích cấu trúc tổng thể**:\n';
      if (topicChunk) logicText += `  - **Chủ đề**: ${topicChunk.surface} (${topicChunk.meaningVi})\n`;
      if (reasonChunk) logicText += `  - **Nguyên nhân / Lý do**: ${reasonChunk.surface} (${reasonChunk.meaningVi})\n`;
      if (objChunk) logicText += `  - **Đối tượng**: ${objChunk.surface} (${objChunk.meaningVi})\n`;
      if (predChunk) logicText += `  - **Hành động / Vị ngữ**: ${predChunk.surface} (${predChunk.meaningVi})\n`;

      if (grammarPoints && grammarPoints.length > 0) {
        logicText += '• **Trọng tâm ngữ pháp**:\n';
        grammarPoints.forEach(gp => {
          logicText += `  - \`${gp.pattern}\`: ${gp.meaningVi} (${gp.explanationVi})\n`;
        });
      }

      // Tạo bản dịch sát nghĩa (literal)
      const literalParts = chunks.map(c => c.meaningVi.split(' • ')[0] || c.surface);
      const literalTranslation = literalParts.join(' ');

      return {
        sentenceLogic: logicText.trim(),
        literalTranslation: literalTranslation
      };
    }

    /**
     * Phân tích toàn diện câu và chuẩn bị đầy đủ thông tin trả về
     * Hỗ trợ cả 2 chế độ: 'local' (offline hoàn toàn) và 'local_ai' (bổ sung AI Explanation)
     */
    async analyze(sentence, options = {}) {
      await this.init();

      if (!sentence || !sentence.trim()) {
        return {
          success: false,
          error: 'Văn bản đầu vào trống'
        };
      }

      const cleanSentence = sentence.trim();

      if (cleanSentence.length > 500) {
        return {
          success: false,
          error: 'Câu quá dài (vượt quá 500 ký tự). Vui lòng chia nhỏ câu để phân tích chính xác nhất.'
        };
      }

      // 1. Phân tách hình thái học và nhận diện token chuẩn hóa data contract
      const tokens = this.tokenize(cleanSentence);

      // 2. Làm giàu nghĩa tiếng Việt cho các từ vựng chưa có nghĩa
      await this.enrichTokens(tokens);

      // 3. Tự động sinh phiên âm toàn câu & HTML Furigana Ruby
      const fullReading = this.generateFullSentenceReading(tokens);
      const furiganaHtml = this.generateFuriganaHtml(tokens);

      // 4. Nhận diện cấu trúc ngữ pháp và nhóm cụm Bunsetsu cục bộ (Local-first Engine)
      const localGrammarPoints = this.detectLocalGrammar(tokens, cleanSentence);
      const localChunks = this.buildLocalChunks(tokens, cleanSentence);
      const { sentenceLogic: localLogic, literalTranslation: localLiteral } = this.buildLocalSentenceLogic(tokens, localChunks, localGrammarPoints, cleanSentence);

      // 5. Kết quả phân tích thuần Local-First (100% Offline, bảo mật, không cần API Key)
      return {
        success: true,
        sentence: cleanSentence,
        reading: fullReading,
        furiganaHtml: furiganaHtml,
        tokens: tokens,
        tokenCount: tokens.filter(t => !t.isPunctuation).length,
        chunks: localChunks,
        grammarPoints: localGrammarPoints,
        sentenceLogic: localLogic,
        literalTranslation: localLiteral,
        naturalTranslation: '',
        notes: [],
        mode: 'local'
      };
    }
  }


  // Khởi tạo Singleton instance (100% Offline Local Engine)
  const instance = new SentenceAnalyzerEngine();
  instance.SentenceAnalyzerEngine = SentenceAnalyzerEngine;
  instance.toRomaji = instance.toRomaji.bind(instance);
  return instance;
});
