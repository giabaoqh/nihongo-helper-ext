const fs = require('fs');
const path = require('path');

// Từ điển dịch nghĩa & giải thích ngữ pháp tiếng Việt chuẩn hóa
const GRAMMAR_VI = {
  // N5
  'wa': {
    meaningVi: 'Thì, là (Trợ từ biểu thị chủ đề của câu)',
    formationVi: 'Danh từ + は',
    explanationVi: 'Được viết là は nhưng phát âm là "wa". Dùng để đưa ra chủ đề người nói muốn nhắc đến; thông tin quan trọng hoặc mới mẻ sẽ nằm ở phía sau.'
  },
  'ga-subject': {
    meaningVi: 'Trợ từ biểu thị chủ ngữ (Nhấn mạnh đối tượng thực hiện hoặc thông tin mới)',
    formationVi: 'Danh từ + が',
    explanationVi: 'Dùng để nhấn mạnh chủ ngữ thực hiện hành động. Từ để hỏi như だれ, 何 luôn đi với が khi làm chủ ngữ. Cũng đi với 好き, ほしい, 上手, わかる.'
  },
  'o': {
    meaningVi: 'Trợ từ tân ngữ (Chỉ đối tượng trực tiếp chịu tác động của hành động)',
    formationVi: 'Danh từ + を + Động từ tha động từ',
    explanationVi: 'Chỉ đối tượng trực tiếp của hành động. Cũng dùng để chỉ không gian mà người/vật đi qua hoặc rời khỏi (vd: công viên, cây cầu).'
  },
  'ni-time': {
    meaningVi: 'Vào lúc, vào ngày (Chỉ mốc thời gian cụ thể)',
    formationVi: 'Danh từ thời gian có số cụ thể + に',
    explanationVi: 'Dùng sau các mốc thời gian có con số cụ thể (7 giờ, ngày 5, tháng 4...). Không dùng với thời gian tương đối như hôm nay, ngày mai, mỗi ngày.'
  },
  'ni-destination': {
    meaningVi: 'Đến, tới (Chỉ đích đến của chuyển động)',
    formationVi: 'Danh từ địa điểm + に + 行く / 来る / 帰る',
    explanationVi: 'Chỉ điểm đích mà hành động hướng tới khi di chuyển (tương tự như へ).'
  },
  'ni-location': {
    meaningVi: 'Ở, tại (Chỉ nơi tồn tại của người hoặc vật)',
    formationVi: 'Danh từ địa điểm + に + あります / います',
    explanationVi: 'Chỉ vị trí tồn tại của người/động vật (います) hoặc đồ vật/thực vật (あります).'
  },
  'ni-indirect-object': {
    meaningVi: 'Cho, với, tới (Chỉ đối tượng tiếp nhận hành động)',
    formationVi: 'Danh từ (người tiếp nhận) + に + Động từ',
    explanationVi: 'Chỉ người hoặc đối tượng nhận lấy hành động (tặng quà cho bạn, gọi điện cho mẹ, hỏi thầy giáo...).'
  },
  'ni-frequency': {
    meaningVi: 'Trong... (Chỉ tần suất trong một khoảng thời gian)',
    formationVi: 'Khoảng thời gian + に + Số lần',
    explanationVi: 'Chỉ tần suất lặp lại của hành động (vd: 1 tuần 2 lần, 1 ngày 3 lần).'
  },
  'e': {
    meaningVi: 'Hướng về, tới (Chỉ phương hướng chuyển động)',
    formationVi: 'Danh từ địa điểm / phương hướng + へ',
    explanationVi: 'Viết là へ nhưng phát âm là "e". Nhấn mạnh vào phương hướng di chuyển.'
  },
  'de-place': {
    meaningVi: 'Tại, ở (Chỉ địa điểm diễn ra hành động)',
    formationVi: 'Danh từ địa điểm + で + Động từ hành động',
    explanationVi: 'Chỉ nơi chốn mà một hành động cụ thể diễn ra (ăn cơm ở nhà hàng, học bài ở thư viện...).'
  },
  'de-means': {
    meaningVi: 'Bằng, bằng cách (Chỉ phương tiện, công cụ, vật liệu, ngôn ngữ)',
    formationVi: 'Danh từ công cụ/phương tiện + で',
    explanationVi: 'Chỉ phương tiện đi lại (bằng xe buýt), công cụ (bằng đũa), ngôn ngữ (bằng tiếng Nhật).'
  },
  'to-and': {
    meaningVi: 'Và, với (Liệt kê toàn bộ các danh từ)',
    formationVi: 'Danh từ 1 + と + Danh từ 2',
    explanationVi: 'Dùng để nối các danh từ với nhau theo cách liệt kê đầy đủ tất cả các thành phần.'
  },
  'to-with': {
    meaningVi: 'Cùng với (Chỉ đối tượng cùng thực hiện hành động)',
    formationVi: 'Danh từ (người/động vật) + と + Động từ',
    explanationVi: 'Chỉ người hoặc bạn đồng hành cùng thực hiện một hành động (đi chơi cùng bạn, ăn cơm với gia đình).'
  },
  'ya': {
    meaningVi: 'Và, như là (Liệt kê tiêu biểu, không đầy đủ)',
    formationVi: 'Danh từ 1 + や + Danh từ 2 (+ など)',
    explanationVi: 'Dùng để liệt kê một vài đại diện tiêu biểu trong số nhiều thứ khác.'
  },
  'ka-or': {
    meaningVi: 'Hoặc, hay là (Lựa chọn giữa các danh từ hoặc vế câu)',
    formationVi: 'Danh từ 1 + か + Danh từ 2',
    explanationVi: 'Dùng để nối hai hay nhiều danh từ thể hiện sự lựa chọn một trong số đó.'
  },
  'mo': {
    meaningVi: 'Cũng (Biểu thị sự đồng nhất hoặc tương tự)',
    formationVi: 'Danh từ + も',
    explanationVi: 'Thay thế cho は, が, を để chỉ sự đồng nhất với điều đã nói trước đó ("Tôi cũng là sinh viên").'
  },
  'no': {
    meaningVi: 'Của, thuộc về (Trợ từ sở hữu, quan hệ hoặc bổ nghĩa danh từ)',
    formationVi: 'Danh từ 1 + の + Danh từ 2',
    explanationVi: 'Kết nối hai danh từ, thể hiện quan hệ sở hữu, nguồn gốc, vị trí hoặc chủng loại.'
  },
  'kara-from': {
    meaningVi: 'Từ (Chỉ điểm xuất phát trong không gian hoặc thời gian)',
    formationVi: 'Danh từ thời gian / địa điểm + から',
    explanationVi: 'Chỉ mốc thời gian bắt đầu (từ 9 giờ) hoặc điểm xuất phát (từ Hà Nội).'
  },
  'made': {
    meaningVi: 'Đến, cho đến (Chỉ điểm kết thúc trong không gian hoặc thời gian)',
    formationVi: 'Danh từ thời gian / địa điểm + まで',
    explanationVi: 'Chỉ mốc thời gian kết thúc hoặc điểm đến cuối cùng của hành trình.'
  },
  'ka-question': {
    meaningVi: 'Phải không? Có... không? (Trợ từ nghi vấn cuối câu)',
    formationVi: 'Câu khẳng định + か',
    explanationVi: 'Đặt ở cuối câu để biến câu khẳng định thành câu hỏi.'
  },
  'ne': {
    meaningVi: 'Nhỉ, nhé (Tìm kiếm sự đồng tình hoặc xác nhận nhẹ nhàng)',
    formationVi: 'Cuối câu + ね',
    explanationVi: 'Dùng khi người nói nghĩ người nghe cũng có cùng quan điểm hoặc muốn xác nhận thân thiện.'
  },
  'yo': {
    meaningVi: 'Đấy, nhé (Cung cấp thông tin mới hoặc quả quyết)',
    formationVi: 'Cuối câu + よ',
    explanationVi: 'Dùng khi người nói cung cấp thông tin mà người nghe có thể chưa biết hoặc để nhắc nhở.'
  },
  'yori': {
    meaningVi: 'Hơn (Dùng trong câu so sánh)',
    formationVi: 'Danh từ + より',
    explanationVi: 'Chỉ đối tượng làm mốc so sánh (A hơn B).'
  },
  'no-hou-ga-yori': {
    meaningVi: '... thì hơn ... (Cấu trúc so sánh hơn)',
    formationVi: 'A の ほうが B より + Tính từ です',
    explanationVi: 'Cấu trúc so sánh hơn giữa hai đối tượng A và B.'
  },
  'to-to-dochira-ga': {
    meaningVi: 'Giữa A và B thì cái nào... hơn? (Hỏi so sánh giữa 2 vật)',
    formationVi: 'A と B と どちらが + Tính từ ですか',
    explanationVi: 'Dùng để hỏi người nghe lựa chọn so sánh giữa hai đối tượng cụ thể.'
  },
  'no-naka-de-ga-ichiban': {
    meaningVi: 'Trong số... thì... là nhất (So sánh nhất)',
    formationVi: 'Nhóm danh từ + の中で [đối tượng] が一番 + Tính từ です',
    explanationVi: 'Dùng để diễn tả đối tượng đứng vị trí số một trong một tập hợp.'
  },
  'desu': {
    meaningVi: 'Là, thì (Trợ động từ khẳng định lịch sự)',
    formationVi: 'Danh từ / Tính từ + です',
    explanationVi: 'Đứng sau danh từ hoặc tính từ để tạo thành câu khẳng định lịch sự ở hiện tại/tương lai.'
  },
  'da': {
    meaningVi: 'Là (Thể thông thường / suồng sã của です)',
    formationVi: 'Danh từ / Tính từ đuôi な + だ',
    explanationVi: 'Dùng trong văn nói thân mật hoặc suy nghĩ cá nhân, bổ nghĩa cho danh từ.'
  },
  'de-wa-arimasen-ja-nai': {
    meaningVi: 'Không phải là... (Phủ định của です / だ)',
    formationVi: 'Danh từ / Tính từ đuôi な + ではありません / じゃないです',
    explanationVi: 'Thể phủ định lịch sự hoặc thông thường của danh từ và tính từ đuôi な.'
  },
  'deshita': {
    meaningVi: 'Đã là... (Quá khứ khẳng định lịch sự của です)',
    formationVi: 'Danh từ / Tính từ đuôi な + でした',
    explanationVi: 'Biểu thị sự việc trong quá khứ đối với danh từ hoặc tính từ đuôi な.'
  },
  'masu': {
    meaningVi: 'Làm... (Đuôi động từ khẳng định lịch sự hiện tại/tương lai)',
    formationVi: 'Động từ thể ます (V-masu)',
    explanationVi: 'Cách nói lịch sự phổ biến diễn tả thói quen, chân lý hoặc hành động tương lai.'
  },
  'masen': {
    meaningVi: 'Không làm... (Phủ định lịch sự của động từ)',
    formationVi: 'Động từ thể ません (V-masen)',
    explanationVi: 'Biểu thị hành động không thực hiện ở hiện tại hoặc tương lai.'
  },
  'mashita': {
    meaningVi: 'Đã làm... (Quá khứ khẳng định lịch sự của động từ)',
    formationVi: 'Động từ thể ました (V-mashita)',
    explanationVi: 'Diễn tả hành động đã hoàn tất trong quá khứ.'
  },
  'masen-deshita': {
    meaningVi: 'Đã không làm... (Quá khứ phủ định lịch sự của động từ)',
    formationVi: 'Động từ thể ませんでした',
    explanationVi: 'Diễn tả hành động đã không xảy ra trong quá khứ.'
  },
  'nai': {
    meaningVi: 'Không làm... (Thể phủ định ngắn / thông thường của động từ)',
    formationVi: 'Động từ thể ない (V-nai)',
    explanationVi: 'Thể ngắn của ません, dùng trong câu thân mật hoặc làm thành phần câu phụ.'
  },
  'ta': {
    meaningVi: 'Đã làm... (Thể quá khứ ngắn / thông thường của động từ)',
    formationVi: 'Động từ thể た (V-ta)',
    explanationVi: 'Thể ngắn của ました, dùng trong giao tiếp thân mật hoặc bổ nghĩa danh từ.'
  },
  'mashou': {
    meaningVi: 'Chúng ta cùng làm... nhé! (Đề nghị hoặc rủ rê lịch sự)',
    formationVi: 'Động từ thể ます bỏ ます + ましょう',
    explanationVi: 'Dùng khi người nói chủ động đề xuất hoặc rủ người nghe cùng làm một việc gì đó.'
  },
  'mashou-ka': {
    meaningVi: 'Tôi làm giúp bạn... nhé? / Chúng ta cùng... nhé?',
    formationVi: 'Động từ thể ます bỏ ます + ましょうか',
    explanationVi: 'Đề nghị giúp đỡ người khác một cách nhã nhặn hoặc hỏi ý kiến rủ rê.'
  },
  'masen-ka': {
    meaningVi: 'Bạn có muốn cùng làm... không? (Lời mời mọc lịch sự)',
    formationVi: 'Động từ thể ません + か',
    explanationVi: 'Lời mời mang tính lịch sự cao, tôn trọng quyết định của người nghe.'
  },
  'tai': {
    meaningVi: 'Muốn làm... (Diễn tả nguyện vọng của bản thân)',
    formationVi: 'Động từ thể ます bỏ ます + たい (です)',
    explanationVi: 'Chỉ dùng để diễn tả mong muốn của bản thân ngôi thứ nhất (hoặc hỏi trực tiếp ngôi thứ hai).'
  },
  'ga-hoshii': {
    meaningVi: 'Muốn có... (Diễn tả mong muốn sở hữu một vật)',
    formationVi: 'Danh từ + が + ほしい (です)',
    explanationVi: 'Dùng khi muốn có một đồ vật hoặc trạng thái cụ thể.'
  },
  'o-kudasai': {
    meaningVi: 'Xin hãy cho tôi... (Yêu cầu nhận vật phẩm)',
    formationVi: 'Danh từ + を + ください',
    explanationVi: 'Dùng khi gọi món ở nhà hàng hoặc mua hàng tại cửa tiệm.'
  },
  'te-kudasai': {
    meaningVi: 'Xin hãy làm... (Yêu cầu hoặc nhờ vả lịch sự)',
    formationVi: 'Động từ thể て + ください',
    explanationVi: 'Cách nhờ vả hoặc đưa ra chỉ dẫn cơ bản trong tiếng Nhật.'
  },
  'naide-kudasai': {
    meaningVi: 'Xin đừng làm... (Khuyên nhủ hoặc yêu cầu không làm gì)',
    formationVi: 'Động từ thể ない + でください',
    explanationVi: 'Yêu cầu người khác không thực hiện hành động nào đó một cách lịch sự.'
  },
  'te-mo-ii': {
    meaningVi: 'Được phép làm... / Làm... cũng được (Xin phép hoặc cho phép)',
    formationVi: 'Động từ thể て + もいい (です / ですか)',
    explanationVi: 'Dùng để hỏi xin phép người khác hoặc cho phép ai làm gì.'
  },
  'te-wa-ikenai': {
    meaningVi: 'Không được phép làm... (Cấm đoán nhẹ nhàng)',
    formationVi: 'Động từ thể て + はいけない / はいけません',
    explanationVi: 'Biểu thị điều cấm kỵ theo quy tắc, luật lệ hoặc người lớn nói với trẻ nhỏ.'
  },
  'nakereba-naranai-nakute-wa-ikenai': {
    meaningVi: 'Phải làm... (Bắt buộc phải làm)',
    formationVi: 'Động từ thể ない bỏ い + ければならない / くてはいけない',
    explanationVi: 'Diễn tả nghĩa vụ hoặc điều cần thiết phải làm, không thể tránh khỏi.'
  },
  'nakute-mo-ii': {
    meaningVi: 'Không cần làm... cũng được (Không bắt buộc)',
    formationVi: 'Động từ thể ない bỏ い + くてもいい (です)',
    explanationVi: 'Diễn tả sự không bắt buộc, làm hay không làm tùy ý.'
  },
  'te-iru': {
    meaningVi: 'Đang làm... / Đang trong trạng thái... (Tiếp diễn hoặc trạng thái kết quả)',
    formationVi: 'Động từ thể て + いる / います',
    explanationVi: 'Chỉ hành động đang diễn ra tại thời điểm nói hoặc trạng thái duy trì sau hành động (kết hôn, sống, biết...).'
  },
  'te': {
    meaningVi: 'Và, rồi... (Nối các động từ hoặc tính từ theo chuỗi liên tiếp)',
    formationVi: 'Động từ thể て / Tính từ đuôi い: くて / Tính từ đuôi な: で',
    explanationVi: 'Dùng để kết nối các hành động xảy ra theo trình tự thời gian.'
  },
  'te-kara': {
    meaningVi: 'Sau khi làm... thì... (Nhấn mạnh trình tự sau trước)',
    formationVi: 'Động từ thể て + から',
    explanationVi: 'Nhấn mạnh hành động thứ hai chỉ bắt đầu sau khi hành động thứ nhất đã hoàn tất.'
  },
  'tari-tari-suru': {
    meaningVi: 'Lúc thì làm..., lúc thì làm... (Liệt kê hành động tiêu biểu)',
    formationVi: 'V1-tari + V2-tari + する',
    explanationVi: 'Liệt kê vài hành động tiêu biểu không theo thứ tự thời gian.'
  },
  'ta-koto-ga-aru': {
    meaningVi: 'Đã từng làm... (Diễn tả trải nghiệm trong quá khứ)',
    formationVi: 'Động từ thể た + ことがある / あります',
    explanationVi: 'Chỉ trải nghiệm từng làm một việc gì đó ít nhất một lần trong đời.'
  },
  'mae-ni': {
    meaningVi: 'Trước khi làm...',
    formationVi: 'Động từ thể từ điển / Danh từ + の + まえに',
    explanationVi: 'Chỉ hành động xảy ra trước một sự kiện hoặc mốc thời gian khác.'
  },
  'ato-de': {
    meaningVi: 'Sau khi làm...',
    formationVi: 'Động từ thể た / Danh từ + の + あとで',
    explanationVi: 'Chỉ hành động diễn ra sau khi sự việc kia hoàn tất.'
  },
  'nagara': {
    meaningVi: 'Vừa làm... vừa làm... (Hai hành động diễn ra song song)',
    formationVi: 'Động từ thể ます bỏ ます + ながら',
    explanationVi: 'Cùng một chủ ngữ thực hiện hai hành động cùng lúc, hành động ở vế sau là chính.'
  },
  'ni-iku': {
    meaningVi: 'Đi đến đâu để làm gì (Chỉ mục đích của việc đi lại)',
    formationVi: 'Địa điểm + へ / に + V-masu bỏ ます + に行く / 来る',
    explanationVi: 'Diễn tả mục đích di chuyển đến một nơi nào đó.'
  },
  'ga-suki-ga-kirai': {
    meaningVi: 'Thích... / Ghét... (Sở thích cá nhân)',
    formationVi: 'Danh từ + が + 好き / 嫌い (です)',
    explanationVi: 'Đi kèm trợ từ が để chỉ đối tượng được thích hoặc ghét.'
  },
  'ga-jouzu-ga-heta': {
    meaningVi: 'Giỏi về... / Kém về... (Kỹ năng, sở trường)',
    formationVi: 'Danh từ + が + 上手 / 下手 (です)',
    explanationVi: 'Chỉ năng lực làm một việc gì đó. Thường không dùng 上手 để tự khen mình.'
  },
  'ga-aru-ga-iru': {
    meaningVi: 'Có... ở... (Sự tồn tại của người hoặc vật)',
    formationVi: 'Địa điểm + に + Danh từ + が + ある (vật) / いる (người, động vật)',
    explanationVi: 'Biểu thị sự tồn tại hoặc sở hữu.'
  },
  'kara-reason': {
    meaningVi: 'Vì... nên... (Chỉ lý do mang tính chủ quan)',
    formationVi: 'Mệnh đề nguyên nhân + から, Mệnh đề kết quả',
    explanationVi: 'Nêu lý do, nguyên nhân dẫn đến kết quả hoặc hành động phía sau.'
  },
  'ga-but': {
    meaningVi: 'Nhưng, tuy nhiên (Nối hai vế đối lập)',
    formationVi: 'Mệnh đề 1 + が, Mệnh đề 2',
    explanationVi: 'Dùng để nối hai câu mang nghĩa trái ngược hoặc dùng làm tiền đề mở đầu câu.'
  },
  'deshou': {
    meaningVi: 'Chắc là... / Có lẽ là... (Phỏng đoán lịch sự)',
    formationVi: 'Thể thông thường / Danh từ + でしょう',
    explanationVi: 'Diễn tả sự suy đoán của người nói với mức độ chắc chắn vừa phải.'
  },
  'ku-naru-ni-naru': {
    meaningVi: 'Trở nên, trở thành... (Chỉ sự biến đổi trạng thái)',
    formationVi: 'Tính từ đuôi い bỏ い + くなる / Tính từ đuôi な / Danh từ + になる',
    explanationVi: 'Diễn tả sự thay đổi của người hoặc vật sang một trạng thái mới.'
  },
  'ni-suru': {
    meaningVi: 'Quyết định chọn...',
    formationVi: 'Danh từ + にする / にします',
    explanationVi: 'Dùng khi đưa ra quyết định chọn món ăn, đồ vật trong số các lựa chọn.'
  },
  'mada-te-inai': {
    meaningVi: 'Vẫn chưa làm...',
    formationVi: 'まだ + Động từ thể て + いません',
    explanationVi: 'Chỉ một hành động theo dự kiến nhưng hiện tại vẫn chưa hoàn thành.'
  },
  'mou-ta': {
    meaningVi: 'Đã làm... rồi',
    formationVi: 'もう + Động từ thể ました',
    explanationVi: 'Nhấn mạnh hành động đã xảy ra xong trước thời điểm nói.'
  },
  'amari-nai': {
    meaningVi: 'Không... lắm (Phủ định một phần)',
    formationVi: 'あまり + Động từ / Tính từ phủ định',
    explanationVi: 'Dùng trong câu phủ định để giảm mức độ ("không ngon lắm", "không hay xem phim lắm").'
  },
  'zenzen-nai': {
    meaningVi: 'Hoàn toàn không...',
    formationVi: '全然 + Động từ / Tính từ phủ định',
    explanationVi: 'Dùng để phủ định tuyệt đối 100% ("hoàn toàn không hiểu").'
  },
  'dake': {
    meaningVi: 'Chỉ... (Giới hạn duy nhất)',
    formationVi: 'Danh từ / Số lượng + だけ',
    explanationVi: 'Biểu thị sự giới hạn, chỉ có bấy nhiêu đó không thêm.'
  },
  'kurai-gurai': {
    meaningVi: 'Khoảng, chừng (Ước lượng số lượng hoặc thời gian)',
    formationVi: 'Lượng từ + くらい / ぐらい',
    explanationVi: 'Chỉ mức độ hoặc lượng ước chừng không chính xác tuyệt đối.'
  },
  'goro': {
    meaningVi: 'Vào khoảng... (Mốc thời gian ước lượng)',
    formationVi: 'Mốc thời gian + ごろ',
    explanationVi: 'Chỉ dùng cho mốc thời gian (khoảng 3 giờ, khoảng tháng 5).'
  },
  'nani-mo-nai-dare-mo-nai': {
    meaningVi: 'Không có gì / Không có ai (Phủ định hoàn toàn với từ để hỏi)',
    formationVi: 'Từ để hỏi + も + Động từ phủ định',
    explanationVi: 'Kết hợp từ để hỏi với も và phủ định để mang nghĩa "không ai", "không gì cả", "không đâu cả".'
  },
  'nani-ka-dare-ka-doko-ka': {
    meaningVi: 'Cái gì đó / Ai đó / Đâu đó (Bất định)',
    formationVi: 'Từ để hỏi + か',
    explanationVi: 'Chỉ một đối tượng không xác định rõ ràng ("uống cái gì đó đi", "có ai ở đó không?").'
  },
  'kore-sore-are-dore': {
    meaningVi: 'Cái này / Cái đó / Cái kia / Cái nào (Đại từ chỉ định)',
    formationVi: 'これ / それ / あれ / どれ',
    explanationVi: 'Đại từ chỉ định đồ vật theo khoảng cách tới người nói và người nghe.'
  },
  'kono-sono-ano-dono': {
    meaningVi: '... này / ... đó / ... kia / ... nào (Từ chỉ định bổ nghĩa danh từ)',
    formationVi: 'この / その / あの / どの + Danh từ',
    explanationVi: 'Đứng trực tiếp trước danh từ để xác định vật/người cụ thể.'
  },
  'koko-soko-asoko-doko': {
    meaningVi: 'Chỗ này / Chỗ đó / Chỗ kia / Chỗ nào (Chỉ vị trí, nơi chốn)',
    formationVi: 'ここ / そこ / あそこ / どこ',
    explanationVi: 'Chỉ nơi chốn dựa trên khoảng cách với người nói và người nghe.'
  },
  'ku-nai-katta-ku-nakatta': {
    meaningVi: 'Chia thể tính từ đuôi い (Phủ định, quá khứ)',
    formationVi: '〜くない (phủ định) / 〜かった (quá khứ) / 〜くなかった (quá khứ phủ định)',
    explanationVi: 'Quy tắc biến đổi đuôi của tính từ đuôi い.'
  },
  'na-na-adjective': {
    meaningVi: 'Tính từ đuôi な (Cách dùng bổ nghĩa danh từ)',
    formationVi: 'Tính từ đuôi な + な + Danh từ',
    explanationVi: 'Khi đứng trước danh từ để bổ nghĩa, bắt buộc phải có chữ な (vd: きれいな花).'
  },
  'kute-de': {
    meaningVi: 'Vừa... lại vừa... (Nối tính từ)',
    formationVi: 'Tính từ đuôi い: くて / Tính từ đuôi な: で',
    explanationVi: 'Nối hai tính từ có cùng tính chất hoặc diễn tả nhiều đặc điểm.'
  },
  'to-iu-named': {
    meaningVi: 'Có tên là, gọi là...',
    formationVi: 'Tên gọi + という + Danh từ',
    explanationVi: 'Dùng khi giới thiệu tên của một người, địa danh, cuốn sách mà người nghe có thể chưa biết.'
  }
};

// N4 mẫu chính
const GRAMMAR_N4_VI = {
  'ageru-kureru-morau': {
    meaningVi: 'Cho / Tặng / Nhận (Động từ chỉ hành vi cho nhận đồ vật)',
    formationVi: 'Người cho + が + Người nhận + に + Vật + を + あげる / くれる / もらう',
    explanationVi: 'あげる: Cho người khác; くれる: Người khác cho mình; もらう: Mình nhận từ người khác.'
  },
  'te-ageru': {
    meaningVi: 'Làm việc gì giúp cho ai đó',
    formationVi: 'Động từ thể て + あげる',
    explanationVi: 'Người nói làm một việc gì đó mang lại lợi ích cho người khác.'
  },
  'te-kureru': {
    meaningVi: 'Ai đó làm giúp việc gì cho mình (hoặc người phe mình)',
    formationVi: 'Động từ thể て + くれる',
    explanationVi: 'Bày tỏ lòng biết ơn khi có ai đó làm việc tốt cho mình.'
  },
  'te-morau': {
    meaningVi: 'Được ai đó làm giúp việc gì / Nhờ ai đó làm giúp',
    formationVi: 'Động từ thể て + もらう',
    explanationVi: 'Chủ ngữ nhận được sự giúp đỡ từ người khác sau khi yêu cầu hoặc nhờ cậy.'
  },
  'te-kudasaru-te-itadaku': {
    meaningVi: 'Kính ngữ của cho nhận hành động (Được bề trên làm giúp / Nhận từ bề trên)',
    formationVi: 'Động từ thể て + くださる / いただく',
    explanationVi: 'Cách nói kính trọng khi người làm giúp là cấp trên, thầy cô giáo hoặc người lớn tuổi.'
  },
  'te-iku': {
    meaningVi: 'Làm gì rồi đi / Tiếp tục diễn tiến từ nay về tương lai',
    formationVi: 'Động từ thể て + いく',
    explanationVi: 'Diễn tả hành động di chuyển ra xa người nói, hoặc sự biến đổi tiếp diễn về tương lai.'
  },
  'te-kuru': {
    meaningVi: 'Làm gì rồi quay lại / Diễn tiến từ quá khứ đến hiện tại / Bắt đầu xuất hiện',
    formationVi: 'Động từ thể て + くる',
    explanationVi: 'Di chuyển lại gần người nói, hoặc sự biến đổi từ quá khứ tới nay, hoặc cảm giác chợt đến.'
  },
  'te-shimau-chau': {
    meaningVi: 'Lỡ làm gì (hối tiếc) / Đã làm xong hoàn toàn',
    formationVi: 'Động từ thể て + しまう (Văn nói: 〜ちゃう / 〜じゃう)',
    explanationVi: 'Biểu thị sự nuối tiếc, ân hận vì một sự việc ngoài ý muốn, hoặc việc hoàn thành trọn vẹn.'
  },
  'te-oku': {
    meaningVi: 'Làm sẵn trước để chuẩn bị / Cứ để nguyên như vậy',
    formationVi: 'Động từ thể て + おく (Văn nói: 〜とく)',
    explanationVi: 'Thực hiện hành động trước để phục vụ cho mục đích tương lai, hoặc giữ nguyên trạng thái.'
  },
  'te-miru': {
    meaningVi: 'Thử làm việc gì xem sao',
    formationVi: 'Động từ thể て + みる',
    explanationVi: 'Thực hiện một hành động để trải nghiệm, kiểm tra kết quả.'
  },
  'te-aru': {
    meaningVi: 'Đang được làm sẵn (Trạng thái kết quả của tha động từ có chủ ý)',
    formationVi: 'Tha động từ thể て + ある',
    explanationVi: 'Diễn tả một trạng thái tồn tại do ai đó đã cố ý làm từ trước nhằm mục đích nào đó.'
  },
  'toki': {
    meaningVi: 'Khi, lúc...',
    formationVi: 'Động từ (辞書形/た形/ない形) / Tính từ / Danh từ の + とき',
    explanationVi: 'Chỉ thời điểm diễn ra một hành động hoặc trạng thái.'
  },
  'aida-aida-ni': {
    meaningVi: 'Trong suốt khi... (あいだ) / Trong khi... có việc xảy ra (あいだに)',
    formationVi: 'Mệnh đề trạng thái + 間 / 間に',
    explanationVi: 'あいだ chỉ hành động kéo dài liên tục; あいだに chỉ hành động khoảnh khắc diễn ra xen vào.'
  },
  'sou-da-appearance': {
    meaningVi: 'Trông có vẻ... / Sắp...',
    formationVi: 'V-masu bỏ ます / Tính từ bỏ い, bỏ な + そうだ / そうです',
    explanationVi: 'Phán đoán dựa trên ấn tượng thị giác trực tiếp.'
  },
  'sou-da-hearsay': {
    meaningVi: 'Nghe nói là... (Truyền đạt lại thông tin nghe được)',
    formationVi: 'Thể thông thường (普) + そうだ / そうです',
    explanationVi: 'Dùng để truyền đạt lại thông tin tiếp nhận từ nguồn khác mà không thêm bớt suy đoán.'
  },
  'rashii': {
    meaningVi: 'Dường như, có vẻ như... / Đậm chất, ra dáng...',
    formationVi: 'Thể thông thường / Danh từ + らしい',
    explanationVi: 'Dựa trên thông tin khách quan để phán đoán, hoặc diễn tả đặc trưng tiêu biểu của danh từ.'
  },
  'you-da': {
    meaningVi: 'Hình như là... / Giống như là...',
    formationVi: 'Thể thông thường / Danh từ の + ようだ / ように',
    explanationVi: 'Phán đoán dựa trên cảm nhận của các giác quan, hoặc dùng để so sánh ví von.'
  },
  'mitai': {
    meaningVi: 'Hình như... / Giống như... (Văn nói của ようだ)',
    formationVi: 'Thể thông thường / Danh từ + みたいだ',
    explanationVi: 'Cách nói thân mật của ようだ trong đời sống hằng ngày.'
  },
  'sugiru': {
    meaningVi: 'Quá... (Vượt quá mức bình thường, mang hàm ý tiêu cực)',
    formationVi: 'V-masu bỏ ます / Tính từ bỏ い, bỏ な + すぎる',
    explanationVi: 'Diễn tả mức độ vượt quá giới hạn cho phép hoặc mong muốn.'
  },
  'kata': {
    meaningVi: 'Cách làm...',
    formationVi: 'V-masu bỏ ます + 方 (かた)',
    explanationVi: 'Biến động từ thành danh từ mang ý nghĩa phương pháp, cách thức thực hiện.'
  },
  'tsumori': {
    meaningVi: 'Dự định làm... / Không có ý định làm...',
    formationVi: 'Động từ thể từ điển / thể ない + つもりだ',
    explanationVi: 'Thể hiện ý chí, dự định chắc chắn của người nói về việc sẽ làm hoặc không làm.'
  },
  'yotei': {
    meaningVi: 'Theo kế hoạch là...',
    formationVi: 'Động từ thể từ điển / Danh từ の + 予定だ',
    explanationVi: 'Chỉ lịch trình, kế hoạch đã được ấn định trước.'
  },
  'koto-ni-suru': {
    meaningVi: 'Quyết định làm... (Quyết định của chính bản thân)',
    formationVi: 'Động từ thể từ điển / thể ない + ことにする',
    explanationVi: 'Chỉ quyết định xuất phát từ ý chí chủ quan của người nói.'
  },
  'koto-ni-naru': {
    meaningVi: 'Được quyết định là... (Quy định tập thể hoặc hoàn cảnh đưa đẩy)',
    formationVi: 'Động từ thể từ điển / thể ない + ことになる',
    explanationVi: 'Chỉ kết quả được quyết định bởi tổ chức, ngoại cảnh chứ không phải do bản thân tự quyết.'
  },
  'koto-ga-dekiru': {
    meaningVi: 'Có thể làm... (Năng lực hoặc khả năng cho phép)',
    formationVi: 'Động từ thể từ điển + ことができる',
    explanationVi: 'Cách diễn đạt năng lực làm việc gì đó ở dạng dài trang trọng.'
  },
  'eru-rareru-potential': {
    meaningVi: 'Thể khả năng (Có thể làm...)',
    formationVi: 'Động từ biến đổi sang thể khả năng (可能形)',
    explanationVi: 'Nhóm 1 đổi đuôi u thành eru; Nhóm 2 đổi ru thành rareru; する thành できる; くる thành こられる.'
  },
  'reru-rareru-passive': {
    meaningVi: 'Thể bị động (Bị, được...)',
    formationVi: 'Động từ biến đổi sang thể bị động (受身形)',
    explanationVi: 'Diễn tả chủ ngữ nhận hành động từ người khác. Cũng dùng chỉ bị động phiền toái (quấy rầy).'
  },
  'seru-saseru': {
    meaningVi: 'Thể sai khiến (Bắt làm, cho phép làm...)',
    formationVi: 'Động từ biến đổi sang thể sai khiến (使役形)',
    explanationVi: 'Người bề trên ra lệnh cho cấp dưới làm, hoặc người lớn cho phép trẻ em làm việc gì.'
  },
  'serareru-saserareru': {
    meaningVi: 'Thể bị động sai khiến (Bị bắt buộc phải làm...)',
    formationVi: 'Động từ thể bị động sai khiến (使役受身形)',
    explanationVi: 'Diễn tả sự miễn cưỡng, bị người khác ép buộc làm điều mình không muốn.'
  },
  'ou-you': {
    meaningVi: 'Thể ý chí (Chúng ta hãy... / Tôi sẽ...)',
    formationVi: 'Động từ thể ý chí (意向形)',
    explanationVi: 'Cách nói thân mật của ましょう, hoặc dùng để biểu thị quyết tâm của người nói.'
  },
  'you-to-omou': {
    meaningVi: 'Đang định làm...',
    formationVi: 'Động từ thể ý chí + と思う / と思っている',
    explanationVi: 'Diễn tả ý định vừa nảy ra (と思う) hoặc đã ấp ủ từ trước (と思っている).'
  },
  'ba': {
    meaningVi: 'Nếu... thì... (Câu điều kiện thể ば)',
    formationVi: 'Động từ thể ば / Tính từ đuôi い: ければ / Tính từ đuôi な, Danh từ: なら',
    explanationVi: 'Điều kiện cần thiết để vế sau xảy ra. Không dùng cho mệnh lệnh nếu vế trước là hành động có chủ ý.'
  },
  'tara': {
    meaningVi: 'Nếu... / Sau khi... thì... (Câu điều kiện thể たら)',
    formationVi: 'Động từ thể た + ら',
    explanationVi: 'Dạng điều kiện thông dụng nhất trong giao tiếp, vế sau có thể dùng mệnh lệnh, rủ rê, nhờ vả.'
  },
  'nara': {
    meaningVi: 'Nếu là... thì... (Đưa ra lời khuyên hoặc chủ đề dựa trên thông tin người nghe nói)',
    formationVi: 'Danh từ / Thể thông thường + なら',
    explanationVi: 'Tiếp nhận chủ đề từ đối phương để đưa ra gợi ý, lời khuyên.'
  },
  'to': {
    meaningVi: 'Hễ... là... / Cứ hễ... (Điều kiện tự nhiên, tất yếu)',
    formationVi: 'Động từ thể từ điển / thể ない + と',
    explanationVi: 'Hễ vế trước xảy ra thì vế sau tự nhiên xảy ra theo quy luật tự nhiên, máy móc hoặc chỉ đường.'
  },
  'te-mo-de-mo': {
    meaningVi: 'Dù cho... thì vẫn... (Điều kiện nhượng bộ)',
    formationVi: 'Động từ thể て + も / Tính từ đuôi い: くても / Tính từ đuôi な, Danh từ: でも',
    explanationVi: 'Dù hoàn cảnh có thế nào thì kết quả ở vế sau vẫn không thay đổi.'
  },
  'noni-although': {
    meaningVi: 'Thế mà, mặc dù... (Biểu thị sự bất ngờ, thất vọng hoặc oán trách)',
    formationVi: 'Thể thông thường / Danh từ, Tính từ đuôi な + な + のに',
    explanationVi: 'Kết quả vế sau trái ngược với kỳ vọng ở vế trước, thường mang cảm xúc tiếc nuối, bực bội.'
  },
  'node': {
    meaningVi: 'Bởi vì... (Chỉ lý do mang tính khách quan, lịch sự)',
    formationVi: 'Thể thông thường / Danh từ, Tính từ đuôi な + な + ので',
    explanationVi: 'Lý do khách quan hơn から, thường dùng khi giải thích lý do để xin phép hoặc xin lỗi lịch sự.'
  },
  'kamo-shirenai': {
    meaningVi: 'Có thể là... / Không chừng là... (Khả năng khoảng 50%)',
    formationVi: 'Thể thông thường / Danh từ, Tính từ đuôi な bỏ だ + かもしれない',
    explanationVi: 'Phỏng đoán về một khả năng có thể xảy ra nhưng người nói không dám chắc.'
  },
  'hazu-da': {
    meaningVi: 'Chắc chắn là... (Dựa trên căn cứ hợp lý)',
    formationVi: 'Thể thông thường / Danh từ の + はずだ',
    explanationVi: 'Người nói tin chắc một việc sẽ xảy ra dựa trên lý do xác thực.'
  },
  'n-desu-no-desu': {
    meaningVi: 'Là vì... / Nhấn mạnh lời giải thích',
    formationVi: 'Thể thông thường / Danh từ, Tính từ đuôi な + な + んです',
    explanationVi: 'Dùng để giải thích lý do, biểu thị sự tò mò muốn biết thêm, hoặc mở đầu câu chuyện.'
  },
  'yasui-nikui': {
    meaningVi: 'Dễ làm... / Khó làm...',
    formationVi: 'V-masu bỏ ます + やすい / にくい',
    explanationVi: 'やすい: Dễ thực hiện hoặc có xu hướng dễ bị; にくい: Khó thực hiện hoặc khó chịu đựng.'
  },
  'hajimeru-owaru-tsuzukeru': {
    meaningVi: 'Bắt đầu làm... / Làm xong... / Tiếp tục làm...',
    formationVi: 'V-masu bỏ ます + 始める / 終わる / 続ける',
    explanationVi: 'Động từ ghép chỉ các giai đoạn khởi đầu, kết thúc hoặc duy trì của hành động.'
  },
  'hou-ga-ii': {
    meaningVi: 'Nên làm... / Không nên làm... (Đưa ra lời khuyên)',
    formationVi: 'V-ta + ほうがいい (nên) / V-nai + ほうがいい (không nên)',
    explanationVi: 'Khuyên nhủ đối phương nên hoặc không nên làm điều gì có lợi cho họ.'
  }
};

function enrichCategory(category) {
  const dir = path.join(__dirname, '..', 'JPEX', 'data', 'jlpt', category);
  const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];
  let totalProcessed = 0;
  let verifiedCount = 0;
  let needsReviewCount = 0;

  for (const lvl of levels) {
    const file = path.join(dir, lvl + '.json');
    if (!fs.existsSync(file)) continue;
    const items = JSON.parse(fs.readFileSync(file, 'utf8'));

    const enriched = items.map(item => {
      let meaningVi = '';
      let formationVi = '';
      let explanationVi = '';
      let status = 'needs_review';

      if (category === 'grammar') {
        const viInfo = (lvl === 'n5' ? GRAMMAR_VI[item.id] : (lvl === 'n4' ? GRAMMAR_N4_VI[item.id] : null));
        if (viInfo) {
          meaningVi = viInfo.meaningVi;
          formationVi = viInfo.formationVi;
          explanationVi = viInfo.explanationVi;
          status = 'verified';
          verifiedCount++;
        } else {
          // Xử lý tạo nghĩa tiếng Việt có cấu trúc cho N3, N2, N1
          meaningVi = 'Ý nghĩa ngữ pháp: ' + item.pattern;
          formationVi = item.formation ? item.formation.replace(/Noun/g, 'Danh từ').replace(/Verb/g, 'Động từ').replace(/Adjective/g, 'Tính từ') : '';
          explanationVi = item.notes || 'Điểm ngữ pháp cấp độ ' + lvl.toUpperCase() + '.';
          status = 'needs_review';
          needsReviewCount++;
        }

        const examples = (item.examples || []).map(ex => {
          return {
            ja: ex.ja || '',
            furigana: ex.furigana || '',
            vi: ex.vi || '',
            en: ex.en || ''
          };
        });

        return {
          id: item.id,
          pattern: item.pattern,
          romaji: item.romaji || '',
          meaningVi: meaningVi,
          originalMeaning: item.meaning || '',
          formation: item.formation || '',
          formationVi: formationVi,
          explanationVi: explanationVi,
          originalNotes: item.notes || '',
          examples: examples,
          tags: item.tags || [],
          translationStatus: status,
          level: lvl.toUpperCase(),
          source: 'OpenJLPT (CC BY-SA 4.0)'
        };
      }
      return item;
    });

    totalProcessed += enriched.length;
    fs.writeFileSync(file, JSON.stringify(enriched, null, 2), 'utf8');
    console.log(`Enriched ${category}/${lvl}.json: ${enriched.length} items.`);
  }

  console.log(`Finished ${category}: Total ${totalProcessed}, Verified: ${verifiedCount}, Needs Review: ${needsReviewCount}`);
}

enrichCategory('grammar');
