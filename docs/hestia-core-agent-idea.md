# Hestia — trợ lý nấu ăn hiểu nguyên liệu và cảnh báo có căn cứ

## Ý tưởng trong một câu

Hestia nhận diện nguyên liệu từ ảnh, hiểu người dùng định nấu món gì, tìm các chất và nguy cơ đáng chú ý từ những nguồn có căn cứ, rồi giải thích ngắn gọn cách nấu an toàn hơn.

Hestia không cố mô phỏng toàn bộ hóa học trong căn bếp. Hệ thống tập trung trả lời ba câu hỏi thực tế:

1. Trong ảnh có những nguyên liệu nào?
2. Với món ăn và cách chế biến người dùng dự định làm, có điều gì cần lưu ý?
3. Cảnh báo đó dựa trên dữ liệu hoặc tài liệu nào, và mức độ chắc chắn ra sao?

## Trải nghiệm người dùng

Một cuộc trò chuyện điển hình có thể diễn ra như sau:

1. Người dùng gửi ảnh nguyên liệu.
2. Hestia trả về danh sách đã nhận diện và hỏi lại nếu có nguyên liệu chưa chắc chắn.
3. Người dùng nói món muốn nấu, ví dụ: “Tôi muốn nướng số thịt và rau này”.
4. Hestia xem xét thực phẩm, phần được sử dụng, trạng thái sống/chín và điều kiện chế biến mà người dùng mô tả.
5. Hệ thống chỉ lấy ra những chất hoặc nguy cơ thực sự đáng quan tâm.
6. Hestia trả lời bằng ngôn ngữ dễ hiểu: điều gì cần chú ý, vì sao, cách giảm rủi ro và phần nào chưa chắc chắn.

Kết quả cuối không phải là một danh sách hàng trăm hợp chất. Người dùng chỉ thấy những thông tin có ý nghĩa đối với món ăn đang định làm.

## Cách Hestia hoạt động

### Bước 1 — Nhìn ảnh và nhận diện nguyên liệu

Một model có khả năng hiểu hình ảnh được gọi thông qua LiteLLM. Model trả về:

- tên nguyên liệu bằng tiếng Anh để thuận tiện tra cứu;
- tên hiển thị theo ngôn ngữ của người dùng;
- độ chắc chắn;
- trạng thái quan sát được, chẳng hạn nguyên củ, đã cắt, sống hoặc đã nấu;
- các phương án khác nếu hình ảnh không đủ rõ.

Hestia không âm thầm coi kết quả nhận diện là đúng tuyệt đối. Nếu “spring onion” và “leek” đều có khả năng đúng, hệ thống giữ lại sự không chắc chắn hoặc hỏi người dùng xác nhận.

Ý tưởng này được lấy từ **FoodLMM**: ảnh thực phẩm không chỉ dùng để đặt tên món mà còn có thể hỗ trợ nhận diện nguyên liệu, vùng ảnh, trạng thái thực phẩm và hội thoại nhiều lượt.

### Bước 2 — Đưa các tên khác nhau về cùng một thực phẩm

Một nguyên liệu có thể có tên địa phương, tên khoa học, tên tiếng Anh hoặc cách viết khác nhau. Hestia đưa chúng về một thực thể chung, nhưng vẫn giữ tên ban đầu để người dùng có thể kiểm tra.

Ví dụ:

```text
spring onion
green onion
scallion
```

Các tên này có thể cùng trỏ tới một thực phẩm chuẩn. Việc ánh xạ được đánh dấu là:

- khớp chính xác;
- khớp gần đúng;
- cần model hỗ trợ lựa chọn;
- còn mơ hồ và cần người dùng xác nhận.

Ý tưởng được lấy từ **FoodAtlas** và **NICE-Food KG**: mỗi nguồn dữ liệu có cách đặt tên riêng, vì vậy cần một lớp nối các tên và mã định danh trước khi kết hợp dữ liệu.

### Bước 3 — Lấy thành phần hóa học có bằng chứng

Sau khi biết thực phẩm là gì, Hestia tra các chất đã được báo cáo có trong thực phẩm đó.

Nguồn ban đầu:

- **FooDB** cho quan hệ giữa thực phẩm và hợp chất;
- **FoodAtlas** để bổ sung quan hệ lấy từ tài liệu khoa học và bằng chứng đi kèm;
- các nguồn định danh như ChEBI hoặc PubChem để nối cùng một chất giữa nhiều database.

Mỗi quan hệ cần giữ cả bối cảnh, không chỉ lưu một câu đơn giản như `garlic contains allicin`. Thông tin nên bao gồm:

- chất nào;
- có trong thực phẩm nào và phần nào của thực phẩm;
- ở dạng sống, khô, nghiền hay đã chế biến;
- có số đo hay chỉ được báo cáo là hiện diện;
- nguồn dữ liệu hoặc bài báo;
- độ tin cậy và các điểm còn mơ hồ.

Đây là ý tưởng tốt nhất từ **FoodAtlas**: một dữ kiện chỉ đáng tin khi có thể lần ngược về nguồn đã tạo ra nó.

### Bước 4 — Chọn ra những chất thật sự cần chú ý

Một thực phẩm có thể liên quan đến hàng nghìn hợp chất. Hestia không gửi toàn bộ danh sách này cho model. Một bộ lọc có quy tắc rõ ràng sẽ ưu tiên các chất khi:

- có bằng chứng hiện diện đủ mạnh;
- có số đo hoặc lượng ước tính hữu ích;
- được nối chắc chắn bằng CAS, InChIKey hoặc mã tương đương;
- có dữ liệu độc tính hoặc mức tham chiếu từ cơ quan chuyên môn;
- liên quan đến phần thực phẩm người dùng thực sự ăn;
- có khả năng bị ảnh hưởng bởi cách chế biến đang được nói tới;
- mức tiếp xúc dự kiến có thể đáng quan tâm.

**OpenFoodTox** là nguồn nền tảng cho thông tin độc tính và mức tham chiếu. Tuy nhiên, việc một chất xuất hiện trong OpenFoodTox không có nghĩa thực phẩm chứa chất đó là nguy hiểm. Liều lượng, cách tiếp xúc và điều kiện sử dụng mới quyết định mức độ cần lưu ý.

### Bước 5 — Hiểu món ăn và quá trình chế biến

Người dùng không chỉ ăn từng nguyên liệu riêng lẻ. Họ có thể luộc, chiên, nướng, ngâm, lên men hoặc thực hiện nhiều bước liên tiếp. Vì vậy Hestia lưu cách chế biến dưới dạng mô tả linh hoạt, gồm:

- hành động;
- nhiệt độ nếu biết;
- thời gian;
- độ ẩm;
- độ chua;
- thứ tự các bước;
- nguyên liệu nào tham gia ở từng bước.

Không đặt cứng một danh sách `CookingMethod` cố định. Nếu xuất hiện một kỹ thuật mới, hệ thống vẫn có thể lưu mô tả và ánh xạ nó về nhóm gần nhất khi cần.

Ý tưởng từ **CookingSense** được dùng ở đây: kiến thức nấu ăn không chỉ là phản ứng hóa học. Nó còn gồm kinh nghiệm từ công thức, kỹ thuật bếp và các nhận định trong tài liệu khoa học.

Hestia ưu tiên các biến đổi đã có căn cứ, ví dụ một chất tăng hoặc giảm trong một khoảng nhiệt độ và thời gian cụ thể. Hệ thống không tự bịa ra phản ứng chỉ vì hai hợp chất cùng xuất hiện trong danh sách.

### Bước 6 — Tìm thêm bằng chứng khi dữ liệu chưa đủ

Nếu database chưa trả lời được một trường hợp quan trọng, Hestia có thể tìm tài liệu khoa học theo một truy vấn hẹp, chẳng hạn:

```text
thực phẩm + chất + cách chế biến + nhiệt độ
```

Model đọc phần tóm tắt hoặc đoạn văn liên quan rồi trích ra:

- thực phẩm;
- chất hoặc nguy cơ;
- điều kiện xảy ra;
- kết quả được quan sát;
- câu làm bằng chứng;
- mã bài báo.

Kết quả mới chỉ là một bằng chứng ứng viên. Nó cần được kiểm tra, lưu nguồn và đánh dấu độ tin cậy trước khi trở thành cảnh báo chính thức.

Ý tưởng này đến từ dự án **Chemical Food Safety Hazard Extraction** của WFSR: chia yêu cầu lớn thành các câu hỏi trích xuất nhỏ giúp model tìm hazard từ tài liệu tốt hơn.

### Bước 7 — Dùng các công cụ nhỏ thay vì để model đoán

Model điều phối một số công cụ có nhiệm vụ rõ ràng:

```text
resolve_food
get_food_compounds
get_compound_identity
get_hazard_records
get_reference_values
get_process_effects
estimate_exposure
search_literature
get_evidence
```

Ví dụ, model không tự nhớ mức tham chiếu của một chất. Nó gọi `get_reference_values`, nhận dữ liệu kèm nguồn rồi mới viết câu trả lời.

Đây là ý tưởng chính từ **ChemCrow**: model làm nhiệm vụ lên kế hoạch và giải thích, còn việc tra cứu hoặc tính toán được giao cho các công cụ chuyên biệt.

Từ **KG-Agent**, Hestia lấy cách suy luận theo từng bước trên graph: bắt đầu từ nguyên liệu, đi tới hợp chất, nguy cơ, điều kiện chế biến và bằng chứng. Số bước được giới hạn để tránh model đi quá xa hoặc thu thập thông tin không liên quan.

Từ **CheMatAgent**, Hestia lấy ý tưởng so sánh một vài hướng xử lý trước khi chọn kế hoạch tốt nhất. Phiên bản đầu chỉ cần những quy tắc đơn giản, không cần tree search hay huấn luyện một model riêng.

Từ **SciToolAgent**, Hestia lấy ý tưởng mô tả rõ mỗi công cụ làm gì, cần đầu vào nào, trả về gì và có thể kết hợp với công cụ nào. Chỉ cần xây phần này khi số công cụ bắt đầu tăng; không cần mang theo hệ thống hàng trăm công cụ.

### Bước 8 — Tạo câu trả lời có căn cứ

Trước khi gọi model lần cuối, backend tạo một gói thông tin gọn gồm:

- nguyên liệu đã xác nhận;
- món ăn và cách chế biến;
- các chất cần chú ý;
- lượng hoặc mức tiếp xúc nếu có thể ước tính;
- bằng chứng ủng hộ và bằng chứng mâu thuẫn;
- nguồn;
- mức độ chắc chắn;
- hành động giảm rủi ro đã được hỗ trợ bởi nguồn.

Model chuyển gói này thành câu trả lời dễ đọc. Một câu trả lời tốt nên có cấu trúc:

1. Hestia nhìn thấy gì.
2. Điều gì đáng chú ý với món người dùng định làm.
3. Vì sao điều đó đáng chú ý.
4. Người dùng có thể làm gì để giảm rủi ro.
5. Thông tin nào còn chưa chắc chắn.
6. Nguồn chính được sử dụng.

## Kho tri thức chung

Hestia cần một kho dữ liệu có thể trả lời “dữ kiện này đến từ đâu”. Có thể hình dung nó như các thẻ thông tin nối với nhau:

```text
Thực phẩm
  └─ chứa → Hợp chất
                 ├─ có đánh giá → Nguy cơ
                 ├─ có mức tham chiếu → Giá trị an toàn
                 └─ thay đổi khi → Điều kiện chế biến
                                      └─ tạo/giảm → Hợp chất khác

Mọi mối nối
  └─ được hỗ trợ bởi → Database hoặc bài báo
```

Các nhóm thông tin chính:

- thực phẩm và phần của thực phẩm;
- dạng nguyên liệu;
- hợp chất;
- nguy cơ;
- quá trình và điều kiện chế biến;
- biến đổi được quan sát;
- nguồn và bằng chứng;
- đánh giá độ tin cậy.

**NICE-Food KG** cung cấp ý tưởng dùng một cách gọi chung để nối dữ liệu dinh dưỡng, nguyên liệu và chất nhiễm bẩn. **FoodAtlas** cung cấp cách lưu bằng chứng và lịch sử của mỗi quan hệ. Hai ý tưởng này kết hợp thành nền tảng dữ liệu của Hestia.

## Những tính năng bổ trợ có thể thêm sau

### Cá nhân hóa

Từ **Swiss Food Knowledge Graph**, Hestia có thể bổ sung:

- dị ứng;
- chế độ ăn;
- bệnh nền hoặc nhóm người cần thận trọng;
- nguyên liệu thay thế;
- sở thích và văn hóa ăn uống.

Cùng một món có thể phù hợp với người này nhưng không phù hợp với người khác. Thông tin cá nhân chỉ được áp dụng khi người dùng chủ động cung cấp.

### Gợi ý món và hương vị

Từ **FlavorGraph**, Hestia có thể biết những nguyên liệu thường đi cùng nhau và các phân tử hương vị liên quan. Phần này dùng để xếp hạng món ăn hoặc gợi ý thay thế, không dùng làm cơ sở xác định độc tính.

### Hiểu ảnh chi tiết hơn

Từ **FoodLMM**, Hestia có thể phát triển thêm khả năng chỉ ra vị trí từng nguyên liệu trong ảnh, ước lượng khẩu phần và hỏi đáp nhiều lượt. Trong giai đoạn đầu, một model vision dùng qua LiteLLM là đủ; chưa cần tự huấn luyện model lớn.

## Kiểm tra độ an toàn của chính Hestia

Hestia cần được kiểm thử như một hệ thống có thể ảnh hưởng đến sức khỏe, không chỉ như một chatbot thông thường.

Ý tưởng tốt nhất từ **FoodGuardBench** là xây một bộ câu hỏi cố định để kiểm tra:

- câu trả lời có bỏ sót nguy cơ quan trọng không;
- model có làm theo yêu cầu nguy hiểm không;
- cảnh báo có bị phóng đại không;
- nguồn có thực sự hỗ trợ kết luận không;
- model có nói rõ khi thiếu dữ liệu không;
- cách diễn đạt có khiến người dùng hiểu sai mức độ nghiêm trọng không.

Ngoài benchmark công khai, Hestia cần test riêng cho:

- ảnh mờ hoặc có nguyên liệu bị che;
- tên địa phương và nhiều ngôn ngữ;
- thực phẩm dễ bị match nhầm;
- phần ăn được và không ăn được;
- nguyên liệu sống so với đã nấu;
- dữ liệu từ các nguồn mâu thuẫn;
- câu hỏi thiếu nhiệt độ, thời gian hoặc lượng sử dụng.

## Nguyên tắc an toàn

1. Không có nguồn thì không khẳng định chắc chắn.
2. Không suy ra phản ứng chỉ từ việc hai chất cùng tồn tại.
3. “Có hazard” không đồng nghĩa “ăn thực phẩm này sẽ bị ngộ độc”.
4. Luôn xét lượng, phần thực phẩm, cách chế biến và đối tượng sử dụng.
5. Giữ lại tên gốc, nguồn và quá trình ánh xạ để có thể kiểm tra.
6. Phân biệt dữ liệu đo được, dữ liệu từ tài liệu và suy luận của model.
7. Khi bằng chứng mâu thuẫn, trình bày sự mâu thuẫn thay vì tự chọn một phía.
8. Với trường hợp nguy cơ cao hoặc triệu chứng thực tế, hướng người dùng đến chuyên gia phù hợp.

## Phạm vi phiên bản đầu

Phiên bản đầu chỉ cần hoàn thành tốt luồng sau:

```text
Ảnh
→ nhận diện nguyên liệu
→ xác nhận thực phẩm chuẩn
→ lấy hợp chất từ FooDB
→ nối hazard từ OpenFoodTox
→ lọc chất đáng chú ý
→ kết hợp món ăn/cách chế biến
→ tạo câu trả lời có nguồn và độ chắc chắn
```

Chưa cần:

- mô phỏng mọi phản ứng hóa học;
- tự huấn luyện vision model;
- agent hàng trăm công cụ;
- graph database chuyên dụng;
- tự động đọc toàn bộ kho bài báo;
- tự đưa ra chẩn đoán y tế;
- tải và chạy nguyên vẹn backend của các dự án tham khảo.

Khi luồng cơ bản hoạt động ổn định, Hestia mới bổ sung literature retrieval, knowledge về quá trình nấu, cá nhân hóa và gợi ý hương vị.

## Nguồn ý tưởng

- [FoodAtlas](https://github.com/AI-Institute-Food-Systems/foodatlas): dữ liệu có nguồn, entity resolution và knowledge graph.
- [NICE-Food KG](https://github.com/rivm-syso/nicekg_processing): nối nhiều loại dữ liệu thực phẩm qua ontology.
- [Chemical Food Safety Hazard Extraction](https://github.com/WFSRDataScience/LLMForChemicalFoodSafetyHazardExtraction): trích xuất hazard từ tài liệu khoa học.
- [CookingSense](https://github.com/dmis-lab/cookingsense): kiến thức nấu ăn từ nhiều loại nguồn.
- [FoodLMM](https://github.com/YuehaoYin/FoodLMM): trải nghiệm trợ lý thực phẩm đa phương thức.
- [ChemCrow](https://github.com/ur-whitelab/chemcrow-public): model điều phối các công cụ hóa học chuyên biệt.
- [CheMatAgent](https://arxiv.org/abs/2506.07551): lựa chọn và lập kế hoạch sử dụng công cụ.
- [SciToolAgent](https://github.com/HICAI-ZJU/SciToolAgent): tổ chức số lượng lớn công cụ bằng một tool graph.
- [KG-Agent](https://arxiv.org/abs/2402.11163): suy luận nhiều bước trên knowledge graph.
- [Swiss Food Knowledge Graph](https://arxiv.org/abs/2507.10156): cá nhân hóa, dị ứng và nguyên liệu thay thế.
- [FlavorGraph](https://github.com/lamypark/FlavorGraph): quan hệ hương vị và khả năng kết hợp nguyên liệu.
- [FoodGuardBench](https://arxiv.org/abs/2604.01444): đánh giá độ an toàn và khả năng chống yêu cầu nguy hiểm.

