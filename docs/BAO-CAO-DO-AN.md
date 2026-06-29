# Báo cáo đồ án CATAROT (bản chi tiết)

Phần này đi sâu vào ba mặt của hệ thống là kiến trúc, công nghệ và chức năng, kèm lý do đứng sau từng quyết định.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Danh mục chức năng chi tiết](#3-danh-mục-chức-năng-chi-tiết)
4. [Kiến trúc Backend](#4-kiến-trúc-backend)
5. [Pipeline AI đa phương thức (đào sâu)](#5-pipeline-ai-đa-phương-thức-đào-sâu)
6. [Tầng dữ liệu](#6-tầng-dữ-liệu)
7. [Tác vụ nền (schedulers)](#7-tác-vụ-nền-schedulers)
8. [Kiến trúc Frontend](#8-kiến-trúc-frontend)
9. [Công nghệ & lý do lựa chọn](#9-công-nghệ--lý-do-lựa-chọn)
10. [Bảo mật](#10-bảo-mật)
11. [Triển khai (Deploy)](#11-triển-khai-deploy)
12. [Kiểm thử & chất lượng mã](#12-kiểm-thử--chất-lượng-mã)
13. [Hạn chế đã biết & hướng phát triển](#13-hạn-chế-đã-biết--hướng-phát-triển)

---

## 1. Tổng quan dự án

**Tên hệ thống:** CATAROT. API tự đặt tiêu đề là `Tarot Multimodal API`, phiên bản `0.2.0`.

**Mô tả:** Đây là ứng dụng web cho người dùng đặt câu hỏi theo ba cách: gõ văn bản, nói bằng giọng nói, hoặc chụp ảnh lá bài thật. Hệ thống nhận diện lá bài, tra ý nghĩa rồi dùng mô hình ngôn ngữ lớn (LLM) viết ra luận giải tiếng Việt. Nếu muốn, người dùng còn có thể nghe luận giải bằng giọng đọc tiếng Việt (TTS). Quanh luồng đọc bài chính, nhóm xây thêm một loạt tính năng để giữ chân và tăng tương tác: lá bài hằng ngày kèm streak, viên nang thời gian, nhật ký giấc mơ, đọc bài đôi thời gian thực, phòng cộng đồng có kiểm duyệt kèm bot tự động, hồ sơ nguyên mẫu (archetype), báo cáo Oracle định kỳ, thông báo và phân tích hành vi.

**Triết lý sản phẩm:** toàn bộ hệ thống chạy miễn phí trên hạ tầng free tier, đây là lựa chọn hợp lý cho một đồ án sinh viên. Một điều nhóm theo đuổi là hệ thống không nên trả lỗi 500 chỉ vì thiếu model hay API key, nên mỗi tầng AI đều có sẵn cơ chế suy biến an toàn (graceful degradation).

**Quy mô:** khoảng 12.400 dòng Python trong `backend/src` và khoảng 24.900 dòng JS, JSX và CSS trong `frontend/src`; 63 endpoint REST cùng 1 WebSocket; cơ sở dữ liệu 24 bảng quan hệ; bộ kiểm thử gồm 174 hàm test trải trên 26 file.

---

## 2. Kiến trúc tổng thể

Hệ thống đi theo kiến trúc client-server tách rời (decoupled SPA cộng API) và được triển khai trên ba hạ tầng độc lập.

![Sơ đồ kiến trúc tổng thể: frontend trên Cloudflare, backend FastAPI trên Hugging Face, cơ sở dữ liệu trên Neon](images/01-kien-truc-tong-the.png)

Hệ thống bám theo bốn nguyên tắc kiến trúc:

1. **Tách rời FE và BE.** Hai bên chỉ nói chuyện qua API JSON và JWT, không có server-side rendering. Nhờ vậy mỗi bên deploy riêng, scale riêng, và sửa một bên thì bên kia không bị động chạm.
2. **Phân tầng rõ ở backend.** `main.py` lo phần HTTP và route, giữ cho mỏng; tầng `advanced` và `pipeline` chứa business logic; còn `db` lo truy cập dữ liệu. Route chỉ nhận request, validate, rồi đẩy việc xuống tầng service.
3. **Suy biến an toàn (graceful degradation).** Mỗi tầng AI (ASR, Vision, RAG, LLM) và mỗi điểm phụ thuộc bên ngoài đều có phương án dự phòng nhiều lớp.
4. **Bảo mật theo mặc định.** JWT fail-fast ở production, không tin `user_id` do client khai, chống IDOR, rate limit, chống dò email, và che API key trong log.

---

## 3. Danh mục chức năng chi tiết

Phần này mô tả giá trị nghiệp vụ và cách hoạt động của từng nhóm chức năng, kèm endpoint tiêu biểu.

### 3.1. Đọc bài lõi (Reading)

- **Đa phương thức:** `POST /api/ask` (JSON text), `POST /api/ask_with_image` (multipart, tối đa 3 ảnh), `POST /api/ask_with_media` (ảnh cộng audio). Tất cả chạy qua pipeline bốn tầng AI ở mục 5.
- **Hai chế độ rút bài:** nhận diện từ ảnh thật, hoặc rút ngẫu nhiên (`random_draw`) khi người dùng không có bài vật lý. Mọi quẻ đều chuẩn hóa về kiểu trải "three" gồm Quá khứ, Hiện tại và Tương lai.
- **Hỏi bằng giọng nói:** trường `question` để tùy chọn (`Form("")`) ở `ask_with_media` và `ask_with_image`. Khi người dùng chỉ ghi âm mà không gõ chữ, câu hỏi nằm trong audio; transcript do ASR nhận ra được ghép vào truy vấn rồi hiển thị lại trên giao diện kèm một biểu tượng micro để người dùng thấy hệ thống đã nghe đúng ý.
- **`user_id` lấy từ JWT, không tin body.** Cách này chống giả mạo và tránh ghi đè lịch sử của người khác.
- **Nghe luận giải (TTS):** `POST /api/tts` đọc văn bản luận giải thành giọng nói tiếng Việt bằng `facebook/mms-tts-vie` (VITS, chạy qua `transformers` có sẵn nên không phải thêm dependency), trả về `audio/wav`. Văn bản dài quá 1.200 ký tự sẽ bị cắt bớt, kèm cảnh báo qua header `X-TTS-Warnings` (phải percent-encode vì header HTTP chỉ nhận latin-1). Phần này tổng hợp theo yêu cầu, không chen vào pipeline đọc bài; nếu TTS tắt hoặc lỗi thì trả 503 kèm thông điệp, còn phần chữ vẫn dùng được bình thường.
- **Chấm điểm:** `POST /api/readings/{session_id}/rating`, thang 1 đến 5 sao.

### 3.2. Hội thoại tiếp nối (Follow-up conversation)

- `POST /api/sessions/{id}/followup` để hỏi sâu thêm trong cùng phiên đọc; `GET /api/sessions/{id}/conversation` để lấy lịch sử chat.
- **Quản lý cửa sổ ngữ cảnh:** hệ thống giữ nguyên tối đa 8 lượt gần nhất (`MAX_RECENT_TURNS = 8`), còn các lượt cũ hơn được tóm tắt tất định bằng cách nối nội dung đã cắt gọn, không tốn lượt gọi LLM. Khi sinh câu trả lời, LLM nhận đủ bộ: ngữ cảnh phiên gốc (câu hỏi, lá bài, cảm xúc, đáp án cũ), bản tóm tắt, 8 lượt gần nhất, và câu hỏi mới.
- Mỗi follow-up tạo ra 2 lượt (`user` rồi `assistant`), với `turn_index` lấy theo `MAX(turn_index) + 1`. Để chống đua khi hai follow-up cùng phiên chạy song song, bảng `conversation_turns` có ràng buộc duy nhất trên cặp `(session_id, turn_index)`, và đoạn ghi sẽ thử lại nếu vướng `IntegrityError`.

### 3.3. Lịch sử (History)

- `GET /api/sessions` (phân trang mới nhất trước), `GET /api/sessions/{id}` (chi tiết gồm lá và đáp án cuối).
- Frontend có thêm cache offline (`sessionCache.js`): khi API lỗi, danh sách phiên vẫn hiện ra từ localStorage.

### 3.4. Xác thực (Auth)

- `POST /api/auth/register` (luôn tạo role `member`), `/login` (đăng nhập bằng username hoặc email), `/forgot-password`, `/reset-password`, `/google` (OAuth), `GET /api/auth/me`.
- Chi tiết kỹ thuật ở mục 4.3.

### 3.5. Hồ sơ (Profile)

- `GET /api/profile/me`, `PATCH` hoặc `POST /api/profile/me` để cập nhật `avatar_url`, `bio`, `display_name`, `username` (trùng username thì trả 409).

### 3.6. Daily Card và Streak (gamification)

- `GET /api/daily-card` (một chạm: lấy hoặc tạo lá hôm nay kèm streak), `POST /api/daily-card/draw`, `POST /api/daily-card/{id}/reflect` (mood và chiêm nghiệm), `GET /api/daily-card/streak`, `GET /api/daily-card/history`, `GET /api/daily-card/{date}/image` (ảnh PNG chia sẻ).
- **Cách hoạt động:** mỗi người dùng rút đúng 1 lá mỗi ngày theo lịch địa phương. Lá được chọn ngẫu nhiên (`random.choice` trên toàn bộ `TarotCard` cộng với chiều ngẫu nhiên), không tính tất định theo người dùng và ngày.
- **Streak:** đếm số ngày liên tiếp, mỗi ngày cách nhau đúng một ngày tính từ hôm nay hoặc hôm qua; song song đó hệ thống quét toàn lịch sử để tính `longest_streak`.
- **Idempotent và chống đua:** chỗ này dựa vào `UniqueConstraint(user_id, draw_date)`. Nếu hai request cùng ngày chạy song song, request thua sẽ bắt `IntegrityError`, rollback rồi đọc lại bản ghi đã có.
- **Affirmation tất định:** đi kèm mỗi lá là một câu khẳng định sinh tất định, lấy hash SHA-1 của chuỗi `lá|chiều|ngày` rồi chọn template, nên cùng lá, cùng chiều, cùng ngày sẽ luôn cho cùng một câu mà không tốn LLM.
- **Luận giải sâu theo chủ đề (RAG cộng LLM):** `POST /api/daily-card/deep-reading` cho người dùng gõ chủ đề tự do như "chuyện chuyển việc" hay "sức khỏe tinh thần". LLM (qua chuỗi fallback) sinh ra bốn mục cố định là Tổng quan, Lời khuyên, Một việc nên làm và Một điều nên tránh, kèm bản dự phòng tất định khi mất mạng. Chủ đề tự do được `_detect_theme()` suy ra nhóm để phục vụ phần dự phòng. Kết quả được cache theo bộ ba (người dùng, ngày, chủ đề) trong bảng `daily_deep_readings` (có unique constraint), nên bấm lại cùng chủ đề trong ngày sẽ không gọi LLM lần nữa.

### 3.7. Time Capsule (viên nang thời gian)

- `POST /api/time-capsules`, `GET /api/time-capsules`, `GET /api/time-capsules/{id}`, `POST .../reveal`, `POST .../verdict`.
- **Cách hoạt động:** người dùng niêm phong một lời tiên đoán kèm ngày mở (`reveal_at`, ràng buộc tối thiểu 6 giờ và tối đa 3 năm). Vòng đời của capsule đi từ `sealed` sang `revealed` rồi `verified`. Khi chưa tới hạn, nội dung bị giấu đi, chỉ trả về metadata và lời niêm phong.
- Độ chính xác do chính người dùng chấm, thang 1 đến 5 sao, không có thuật toán tự động nào ở đây.
- Người dùng cũng có thể tạo capsule từ một phiên đọc cũ; lúc đó hệ thống lấy lại lá và câu hỏi từ `ReadingSession`, có lọc `user_id` để chống IDOR.

### 3.8. Dream Journal (nhật ký giấc mơ)

- `POST /api/dreams` (text và/hoặc audio), `GET /api/dreams`, `GET /api/dreams/{id}`.
- **Cách hoạt động:** nhận giấc mơ vào, nếu có audio thì chuyển giọng thành text trước, rồi trích biểu tượng qua hai tầng. Tầng đầu ưu tiên để LLM trả về một mảng JSON gồm 3 đến 7 biểu tượng kèm lá bài và câu ý nghĩa; nếu mảng đó rỗng thì rơi về luật khớp chuỗi con từ `dream_symbol_map.json`. Tiếp theo, hệ thống ánh xạ sang lá Tarot (arcana) rồi đối chiếu chéo với các phiên đọc bài của người dùng trong 7 ngày gần nhất.
- **Diễn giải tổng hợp (nâng cấp mới):** ngoài biểu tượng và lá bài, LLM (qua chuỗi fallback) còn sinh thêm `summary_interpretation` (giấc mơ nói gì về mình), `main_theme`, `emotional_tone`, `recent_reading_connections` (liên hệ với phiên đọc trong 7 ngày, có lọc bỏ những `session_id` mà LLM bịa ra), `reflection_questions` (2 đến 3 câu phản tư) và `suggested_action` (một việc nhỏ nên làm). Khi LLM lỗi vẫn có bản dự phòng tất định; toàn bộ phần này lưu ở cột `interpretation_json`. Cột này cho phép NULL nên giấc mơ cũ không bị ảnh hưởng, và frontend tự ẩn các mục mới.

### 3.9. Duo Reading (đọc bài đôi thời gian thực)

- `POST /api/duo/sessions`, `.../join`, `.../join_by_invite`, `.../card` (nộp ảnh lá), `GET .../{id}`, và WebSocket `WS /ws/duo/{id}`.
- **Cách hoạt động:** hai người vào chung một phòng (mời nhau qua `invite_code` 8 ký tự sinh bằng `secrets`), mỗi người nộp một lá; khi đủ hai lá thì hệ thống gộp lại thành một luận giải tương hợp. Phòng đi qua các trạng thái `waiting_partner`, `waiting_cards`, `generating` rồi `completed`.
- **Realtime:** backend có `DuoWsManager` quản lý kết nối WebSocket theo phòng và phát trạng thái (`duo_created`, `snapshot`, heartbeat `ping`/`pong`). Tuy nhiên, frontend hiện cập nhật trạng thái bằng cách gọi lại `getDuoSession` (polling REST) chứ chưa nối WebSocket phía client, nên đây là điểm còn có thể nâng cấp.
- **Tối ưu khóa DB:** lệnh gọi LLM (khoảng 120 giây) được tách hẳn ra ngoài transaction, để không giữ write-lock suốt thời gian sinh nội dung.

### 3.10. Community (cộng đồng có kiểm duyệt)

- Người dùng: `POST /api/community/posts`, `GET /api/community/feed`, `POST .../interpretations`, `.../vote`, `.../resonate`.
- Admin: `GET /api/admin/community/moderation_queue`, `.../approve`, `.../reject`.
- **Cách hoạt động:** người dùng đăng câu hỏi hoặc quẻ bài dưới một bí danh ẩn danh (`Seeker-{id:04d}`, suy ra từ ID nên không lộ tài khoản thật); người khác vào luận giải hộ, vote, và chủ bài có thể đánh dấu đồng cảm (resonate). Bài chỉ hiển thị công khai khi đã `approved`, theo luồng `pending` sang `approved` hoặc `rejected`.
- **Điểm kỹ thuật:** feed tránh truy vấn N cộng 1 bằng cách gom toàn bộ interpretation vào một query `IN (...)`; vote vừa chống đua vừa tự chữa lệch đếm (bắt `IntegrityError`, sau đó đếm lại số vote thật từ bảng thay vì tin cột counter); trường lá bài được sanitize theo whitelist để chống nhồi dữ liệu.

### 3.11. Auto-moderation bot (opt-in, ưu tiên an toàn)

- `POST /api/admin/community/automod/run` (có `dry_run`), `GET .../automod/preview`.
- **Cách hoạt động:** bot quét các bài `pending` rồi phân loại thành approve, reject hoặc escalate, theo kiến trúc hai lớp. Lớp đầu là tiền lọc bằng luật: kiểm độ dài, từ cấm hard-block, URL, PII, quảng cáo, và có chuẩn hóa để chống lách bộ lọc kiểu chèn dấu chấm giữa chữ. Lớp sau dùng Gemini phân loại với JSON schema, `temperature=0`, và chống prompt injection bằng cách bọc dữ liệu trong khối `<<<DATA>>>`.
- **Triết lý an toàn:** bot mặc định tắt (opt-in qua `COMMUNITY_AUTOMOD_ENABLED`). Mọi trường hợp nghi ngờ hoặc LLM lỗi đều escalate cho người, không tự approve; bot chỉ tự `reject` khi bật thêm `COMMUNITY_AUTOMOD_AUTOREJECT`. Nó cũng không ghi đè quyết định của admin thật, tức là idempotent khi bài đã rời `pending`.

### 3.12. Gợi ý và phân tích người dùng

- **Gợi ý câu hỏi** `GET /api/question_suggestions` chạy theo luật, không dùng LLM: dựa vào pha trăng (tính bằng toán thiên văn từ chu kỳ 29,53 ngày), thứ trong tuần, và lá bài gần nhất; mỗi gợi ý đều kèm `reason` minh bạch.
- **Gợi ý trải bài** `POST /api/spread/recommend` cũng chạy theo luật: phân loại chủ đề và độ khẩn từ từ khóa rồi đề xuất kiểu trải; có cờ `can_run_with_current_backend` (thực tế backend hiện chỉ chạy trải 3 lá).
- **Hồ sơ archetype** `GET /api/users/{id}/archetype_profile` tổng hợp lịch sử khi có từ 5 phiên trở lên: lá hay gặp nhất thành Soul Card, top từ khóa rút ra từ câu hỏi, cảm xúc thường gặp. Phần này không dùng LLM.
- **Oracle report** `GET /api/users/{id}/oracle_reports[/latest]` là thư tổng kết tháng do LLM viết (có fallback tất định) rồi gửi qua email.
- **Affirmations** `GET /api/affirmations/{card_name}` không cần auth và chạy tất định.
- **Notifications** `GET /api/notifications`, `.../read`, `GET` hoặc `PUT /api/notification-preferences`.
- **Analytics (admin)** `GET /api/admin/analytics/funnel` đếm sự kiện và tính retention D1 và D7.

---

## 4. Kiến trúc Backend

### 4.1. Tầng HTTP với FastAPI (`src/main.py`)

- **Điểm vào:** nơi đăng ký toàn bộ 63 endpoint REST và 1 WebSocket (`/ws/duo/{id}`).
- **Middleware:**
  - `request_id_middleware` gắn `x-request-id` (lấy từ header hoặc sinh `uuid4`) cho mỗi request rồi echo lại trên response, phục vụ truy vết log.
  - `CORSMiddleware` đọc origin từ env `API_ALLOWED_ORIGINS`.
  - Một exception handler tổng biến mọi lỗi không lường trước thành JSON `500 {detail, request_id}` và không để lộ stack trace ra client.
- **Lifespan lúc startup:** khởi tạo DB kèm seed bài Tarot, kiểm `JWT_SECRET_KEY` theo kiểu fail-fast (chặn boot nếu ở production mà secret yếu hoặc thiếu), rồi bật các scheduler (rating, analytics, automod opt-in, notification opt-in). Lúc shutdown thì dừng scheduler theo thứ tự ngược lại.
- **Validation:** mọi request body đều qua Pydantic: `password` tối thiểu 6, `username` 3 đến 64, `score` 1 đến 5, `daily_card_hour` 0 đến 23, phân trang ràng buộc bằng `Query(ge=…, le=…)`, và nhiều ràng buộc khác.
- **Upload chặt:** whitelist đuôi file (ảnh và âm thanh), giới hạn 25MB, đặt tên file ngẫu nhiên bằng `uuid4`, đọc theo chunk 1MB, và xóa file tạm trong `finally` kể cả khi gặp lỗi.

### 4.2. Pipeline (tóm tắt, chi tiết ở mục 5)

`src/pipeline/tarot_pipeline.py` đóng vai bộ điều phối, gọi 5 module con theo trình tự ASR, cảm xúc, Vision hoặc Random, RAG, rồi LLM. Bản thân nó không chứa AI; thay vì ném lỗi, nó gom các cảnh báo (`warnings`) lại, nên một tầng hỏng không kéo sập cả phiên đọc.

### 4.3. Xác thực và phân quyền (`src/auth/`)

| Khía cạnh | Triển khai |
|-----------|-----------|
| **Băm mật khẩu** | PBKDF2-HMAC-SHA256, 200 nghìn vòng, salt ngẫu nhiên 16 byte; lưu dạng `pbkdf2_sha256$<salt>$<digest>`; so sánh bằng `hmac.compare_digest` để chống tấn công thời gian. Chỉ dùng `hashlib` chuẩn, không thêm dependency. |
| **Token** | JWT HS256 (override qua `JWT_ALGORITHM`, chỉ chấp nhận họ HS256/384/512), payload `{sub, role, iat, exp}`, hạn mặc định 120 phút (tối thiểu 5). |
| **Fail-fast** | Ở `APP_ENV=production`, nếu `JWT_SECRET_KEY` rỗng, nằm trong danh sách yếu, hoặc dưới 32 ký tự thì app từ chối khởi động (`RuntimeError`). |
| **Google OAuth** | Xác thực `id_token` qua `google-auth` với `audience = GOOGLE_CLIENT_ID`; liên kết theo `google_id` hoặc email, tạo user mới (role `member`) nếu chưa có. Thiếu `GOOGLE_CLIENT_ID` trả 503; token sai trả 401. |
| **Reset mật khẩu** | Token `secrets.token_urlsafe(32)`, TTL mặc định 30 phút, dùng một lần (xóa sau khi đổi). Chống dò email: response giống nhau dù email tồn tại hay không. |
| **Phân quyền admin** | Qua env `ADMIN_EMAILS`. Role `admin` được tính lại mỗi request nên sống sót qua reset DB; đăng ký công khai luôn là `member`. |
| **Chống IDOR** | `_ensure_self_or_admin` chặn user A xem dữ liệu user B (trả 403), còn `_ensure_session_owner_or_admin` trả 404 thay vì 403 để không lộ sự tồn tại của session. Endpoint `/api/ask*` lấy `user_id` từ JWT, không tin client. |

### 4.4. Rate limit và validation (`src/utils/`)

- **Rate limiter:** dùng sliding window in-memory (lưu mốc `time.monotonic()` trong `deque`), có `threading.Lock`; key tính theo `"{scope}:{ip}"`, với IP ưu tiên lấy từ `x-forwarded-for` ở vị trí proxy tin cậy. Vượt ngưỡng thì trả 429, và toàn bộ bật tắt qua `RATE_LIMIT_ENABLED`.
  - Phạm vi áp dụng gồm nhóm `auth/*` (register 5 lần mỗi 60 giây, login 10, forgot và reset 5, google 10) và nhóm `ask*` (mặc định 20 mỗi 60 giây, override qua env).
  - Lưu ý là các endpoint còn lại như sessions, daily, community, duo thì không gắn rate limit. Và vì là in-memory nên cách này chỉ đúng khi chạy một process; muốn multi-worker thì cần Redis.
- **Validators:** kiểm `email` bằng regex cộng giới hạn độ dài 254, và có `normalize_email`. Phần còn lại để cho tầng Pydantic validate.

---

## 5. Pipeline AI đa phương thức (đào sâu)

Trong `src/pipeline/tarot_pipeline.py`, hàm `run_pipeline()` điều phối đúng bảy bước:

![Sơ đồ bảy bước của pipeline: ASR, cảm xúc, Vision hoặc random, gộp query, RAG, LLM](images/02-pipeline-ai.png)

1. **ASR** (`transcribe_audio`) chuyển audio thành transcript.
2. **Cảm xúc** (`analyze_voice_emotion`) suy ra `emotion_state` từ tín hiệu giọng nói.
3. **Lấy lá**: nếu `random_draw` thì gọi `_draw_random_cards()`, ngược lại nhận diện bằng `_build_card_outputs()`.
4. **Override**: `_apply_overrides()` cho phép sửa lá bằng tay.
5. **Gộp query**: ghép câu hỏi với transcript thành một truy vấn chung.
6. **RAG**: `_collect_snippets(query, cards)` lấy về các đoạn nghĩa lá liên quan.
7. **LLM**: `reader.generate(...)` viết ra luận giải Markdown tiếng Việt.

### 5.1. Tầng 1 ASR: nhận diện giọng nói (`asr/transcribe.py`)

- Trước hết audio được chuẩn hóa định dạng về WAV mono 16kHz bằng `ffmpeg`; nếu thiếu ffmpeg thì chỉ cảnh báo nhẹ và bỏ qua bước này.
- **Hai backend xếp theo ưu tiên:** đầu tiên là `faster-whisper` (model `large-v3`, `device=cpu`, `compute_type=int8`, load một lần rồi cache qua `lru_cache`); không được thì dự phòng bằng `transformers whisper-small`; cuối cùng trả `None` để pipeline vẫn chạy tiếp mà không có transcript.
- **Chế độ song ngữ `auto_vi_en`:** chạy nhận diện cả tiếng Việt lẫn tiếng Anh, mỗi bản kèm `avg_logprob`, rồi chọn bản có điểm tin cậy cao hơn. Cách này xử lý tốt người Việt nói chêm tiếng Anh.

### 5.2. Tầng 2 Vision: nhận diện lá bài (`vision/`)

- **Embedding:** dùng OpenCLIP ViT-B-32 (pretrained `laion2b_s34b_b79k`) trên CPU, rồi L2-normalize. Phòng khi máy không cài nổi OpenCLIP, hệ thống có sẵn demo mode dựa trên histogram màu, ảnh xám và gradient (864 chiều).
- **So khớp:** dùng `faiss.IndexFlatIP` (Inner Product). Do vector đã được L2-norm nên inner product chính là cosine similarity, tức tìm lá có góc vector gần nhất.
- **Mẹo 1, nhận biết lá ngược:** hệ thống embed cả ảnh gốc và ảnh xoay 180 độ; ứng viên đến từ bản xoay sẽ bị đảo orientation từ xuôi sang ngược và ngược lại. Nếu bản xoay khớp tốt hơn thì nghĩa là lá đang đặt ngược, nên không cần ảnh huấn luyện riêng cho lá ngược.
- **Mẹo 2, độ tin cậy:** tính `confidence = (margin + 0.2) / 0.8` với `margin = score_top1 - score_top2`. Tức độ tin cậy đo bằng độ tách biệt giữa ứng viên hạng nhất và hạng nhì, chứ không phải điểm tuyệt đối. Ngưỡng `confidence_threshold` mặc định 0.18 (đọc từ cấu hình ứng dụng): xuống dưới ngưỡng thì hệ thống cảnh báo người dùng chụp lại hoặc chọn từ top 5.
- Khi không có FAISS index, tầng này trả về kết quả dự phòng (danh sách lá mặc định) thay vì sập. `index.py` còn có guard kiểm chiều vector, tránh assertion mơ hồ của FAISS khi index 512 chiều gặp demo 864 chiều.

### 5.3. Tầng phụ: phân tích cảm xúc giọng nói (`advanced/emotion_analysis.py`)

Tầng này không dùng model ML mà chỉ phân tích tín hiệu số: `pause_ratio` (tỉ lệ khoảng lặng), `energy_mean` và `energy_std` (năng lượng), `zero_crossing_rate` (độ gấp gáp). Từ các chỉ số đó, một bộ luật ngưỡng phân giọng nói về 5 nhãn `sad`, `anxious`, `excited`, `uncertain`, `calm`. Nhãn này sau đó được chèn vào prompt LLM để điều chỉnh tông giọng cho đồng cảm hơn.

### 5.4. Tầng 3 RAG: truy hồi ý nghĩa lá bài (`rag/retrieve.py`)

- **Embedding text:** dùng `sentence-transformers/all-MiniLM-L6-v2` (nhẹ, chạy CPU) cùng FAISS.
- Truy vấn được ghép thành `"<câu hỏi> card=<tên lá> orientation=<chiều>"`, đem đi search, rồi lọc theo metadata để snippet đúng lá đang xét. Hệ thống đặt một ngưỡng điểm tối thiểu (`RAG_MIN_SCORE`, mặc định 0.1, có thể nâng qua env), và nhiều lớp dự phòng (chẳng hạn cùng lá khác chiều thì dùng placeholder) bảo đảm luôn có tối thiểu 3 snippet cho LLM, qua đó giảm bịa.

### 5.5. Tầng 4 LLM: sinh luận giải, chuỗi dự phòng bốn tầng (`llm/generate.py`)

| Tier | Nhà cung cấp | Vai trò | Ghi chú |
|------|--------------|---------|---------|
| 1 | Google Gemini (`gemini-2.5-flash`, free) | Ưu tiên cao nhất | Xoay vòng nhiều API key khi một key dính 429 |
| 2 | OpenAI (`gpt-4o-mini`) | Tùy chọn | Chỉ chạy nếu có `OPENAI_API_KEY` |
| 3 | Groq (`llama-3.3-70b-versatile`, free) | Backup chính | OpenAI-compatible, rất nhanh |
| 4 | Ollama (`qwen2.5:3b-instruct`, local) | Khi self-host | |
| Cuối | Fallback tất định | Lưới an toàn cuối cùng | Sinh luận giải từ template cộng từ điển nghĩa lá tiếng Việt, không cần internet |

Vài chi tiết kỹ thuật đáng chú ý:

- **Prompt có chủ đích:** trước khi đưa vào prompt, hệ thống lọc bỏ các cảnh báo nhạy cảm như "ngẫu nhiên" hay "chụp lại" để LLM không lỡ tiết lộ rằng bài là ngẫu nhiên, hoặc nhắc người dùng chụp lại một cách thừa thãi; đồng thời truyền vào một cờ rõ ràng cho biết có thêm mục "Lưu ý" hay không.
- **Bảo mật log:** mọi thông báo lỗi HTTP đều thay API key bằng `<redacted>`.
- Đặt `maxOutputTokens = 0` nghĩa là bỏ trần, để bài luận giải không bị cắt giữa câu.
- `last_used_model` ghi lại model nào thực sự đã trả lời và trả về frontend, giúp minh bạch và dễ debug.
- **Fallback tất định** dùng `_detect_theme()` (khớp từ khóa không dấu, hỗ trợ cả Việt lẫn Anh) để chọn chủ đề như tình cảm, sự nghiệp, tài chính, sức khỏe hay học tập, rồi ghép nghĩa lá với lời khuyên 7 ngày.

### 5.6. Mạch xuyên suốt: suy biến an toàn ở mọi tầng

| Tầng | Lý tưởng | Dự phòng | Lưới an toàn cuối |
|------|----------|----------|-------------------|
| ASR | faster-whisper | transformers whisper | chạy không transcript |
| Vision | OpenCLIP cộng FAISS | demo embedder | danh sách lá mặc định |
| RAG | FAISS đúng lá | cùng lá khác chiều | placeholder snippet |
| LLM | Gemini (nhiều key) | OpenAI, Groq, Ollama | template tất định offline |
| TTS | mms-tts-vie (VITS) | tắt qua `TTS_ENABLED` | trả 503 kèm thông điệp, web vẫn đọc chữ |

Nhờ vậy hệ thống không trả lỗi 500 chỉ vì thiếu model hay hết quota.

---

## 6. Tầng dữ liệu

### 6.1. ORM và danh mục bảng

- Tầng dữ liệu dựng trên SQLAlchemy 2.0 (kiểu `Mapped[...]` và `mapped_column`), với 24 bảng quan hệ:
  - *Lõi đọc bài:* `users`, `tarot_cards`, `reading_sessions`, `recognized_cards`, `readings`, `conversation_turns`, `rating_reminders`.
  - *Phân tích:* `user_archetype_profiles`, `oracle_reports`, `analytics_events`.
  - *Đọc bài đôi:* `duo_sessions`, `duo_participants`, `duo_cards`, `duo_readings`.
  - *Cộng đồng:* `community_posts`, `community_interpretations`, `community_votes`, `community_moderation_logs`.
  - *Tính năng khác:* `dream_entries` (kèm cột `interpretation_json`), `daily_cards`, `daily_deep_readings`, `time_capsules`, `notification_preferences`, `notifications`.

### 6.2. Toàn vẹn dữ liệu

- **16 CheckConstraint có tên** lo phần ràng buộc enum trạng thái: `status IN (...)`, `orientation IN ('upright','reversed')`, `role IN (...)`, `accuracy_score IS NULL OR (1..5)`, `daily_card_hour` từ 0 đến 23, và các ràng buộc tương tự.
- **6 UniqueConstraint nhiều cột** chống trùng: `uq_daily_cards_user_date` (một lá mỗi người mỗi ngày), `uq_daily_deep_readings_user_date_topic` (cache luận giải sâu), `uq_community_votes_interp_user` (một vote mỗi người mỗi interpretation), `uq_duo_participants_session_slot`, `uq_duo_card_session_participant` (mỗi người chỉ nộp một lá trong một phiên), và `uq_conversation_turns_session_idx` (chống đua hai follow-up ghi trùng `turn_index`).
- **ForeignKey được phân biệt rõ theo mục đích:**
  - Dùng CASCADE (xóa cha thì xóa con) cho dữ liệu phụ thuộc như recognized_cards, readings, conversation_turns, votes.
  - Dùng SET NULL (giữ con lại khi cha biến mất) để bảo toàn lịch sử lúc user hoặc khách bị xóa, áp cho `reading_sessions.user_id`, `community_posts.user_id`, `dream_entries.user_id`, `analytics_events.user_id`.
- `password_hash` cho phép NULL để hỗ trợ user đăng nhập bằng Google; còn `users.email`, `users.username`, `users.google_id` đều unique và có index.

### 6.3. Engine và session (`db/session.py`)

- **Engine kép:** `get_engine()` (singleton qua `lru_cache`) tự chuẩn hóa `postgres://` thành `postgresql://`, nên dán thẳng connection string của Neon hay Heroku vào là chạy. Với Postgres thì bật `pool_pre_ping=True` và `pool_recycle=300` để chịu được việc Neon đóng kết nối nhàn rỗi; với SQLite thì bật `check_same_thread=False` và đặt `PRAGMA foreign_keys=ON` qua event listener, vì nếu thiếu thì các ràng buộc CASCADE và SET NULL sẽ bị vô hiệu.
- `session_scope()` hoạt động như một unit-of-work: commit nếu không lỗi, rollback rồi ném lại khi lỗi, và luôn close trong `finally`.

### 6.4. Lưu kết quả an toàn (`db/persistence.py`)

- `persist_reading_result()` lưu trọn `ReadingSession`, `RecognizedCard`, `Reading` và (nếu có user) `RatingReminder` trong một transaction.
- **Đưa `user_id` rác về ẩn danh:** nếu `user_id <= 0` hoặc không hợp lệ thì chuyển thành `None` để tránh vỡ khóa ngoại.
- **Xử lý lỗi phân tầng:** lỗi DB nghiêm trọng (`Operational`, `Integrity`, `Programming`) được log ở mức ERROR kèm ngữ cảnh, còn lỗi khác thì log WARNING; nhưng cả hai đều trả `None` để phiên đọc vẫn về tới người dùng thay vì sập.

### 6.5. Migration

- Việc bootstrap là idempotent và an toàn với đa luồng, đa worker: `initialize_database_if_needed` dùng double-checked locking.
- Bài Tarot được seed từ `data/raw/tarot_json/tarot.json` (kỳ vọng 78 lá), idempotent theo tên.
- **Alembic** có 5 revision (initial, daily_card cộng time_capsule, notifications cộng analytics, daily_deep_readings, dream interpretation). Bên cạnh đó, một lightweight migration trong `init_db.py` tự `ALTER TABLE ADD COLUMN` cho các cột bổ sung (`emotion_state`, `accuracy_score`, `dream_entries.interpretation_json`), tự áp các ràng buộc unique và index còn thiếu, và tự tạo lại bảng cache `daily_deep_readings` nếu gặp schema CHECK enum cũ (đổi từ chủ đề cố định sang tự do, an toàn cho cả SQLite lẫn Postgres).

---

## 7. Tác vụ nền (schedulers)

Phần lập lịch dùng APScheduler (`BackgroundScheduler`), chạy in-process cùng FastAPI và được bật trong `lifespan`. Tất cả các job đều opt-in qua env và suy biến an toàn: nếu thiếu APScheduler thì chỉ log cảnh báo chứ không làm sập app.

| Scheduler | Job | Lịch | Env (mặc định) |
|-----------|-----|------|----------------|
| `rating_reminders` | Gửi email nhắc chấm điểm (tối đa 3 lần thử) | mỗi 5 phút | `RATING_REMINDER_SCHEDULER_ENABLED` (bật) |
| `notifications` | Đẩy "lá bài hôm nay" đúng khung giờ user | mỗi 5 phút | `NOTIFICATION_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Archetype | cron Thứ Hai 02:00 | `ARCHETYPE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Oracle report tháng | cron ngày 1, 03:00 | `ORACLE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Mở time capsule tới hạn | mỗi 15 phút | `TIME_CAPSULE_SCHEDULER_ENABLED` (bật) |
| `community_automod` | Bot kiểm duyệt | mỗi 5 phút | `COMMUNITY_AUTOMOD_ENABLED` (tắt) |

- Mọi job đều đặt `coalesce=True`, `max_instances=1`, `replace_existing=True` để chống dồn, chống đè và chống chạy chồng.
- **Xử lý timezone cẩn thận:** để thông báo daily card giữ đúng một lần mỗi ngày mỗi user, hệ thống quy mốc đầu ngày địa phương về UTC-naive rồi so với `created_at` (SQLite lưu naive UTC).

---

## 8. Kiến trúc Frontend

### 8.1. Stack và build

- Nền tảng là React 19, Vite 7 và react-router-dom v7. Toàn bộ viết bằng `.jsx` và `.js`, không chạy TypeScript.
- Các thư viện chính gồm `axios`, bộ animation `framer-motion` cùng `motion` và `gsap`, `react-markdown` (render kết quả LLM an toàn, không đụng tới `dangerouslySetInnerHTML`), `ogl` và `three` cho hiệu ứng WebGL, `react-hot-toast`, `styled-components`, cùng `lucide-react` và `react-icons`.
- Trong `vite.config.js`, vendor được tách thành nhiều chunk (`vendor-react`, `vendor-motion`, `vendor-misc`) để cache tốt hơn; riêng ở production thì esbuild loại bỏ `console` và `debugger`.

### 8.2. Routing và guard (`App.jsx`)

- Cả 6 page (`/`, `/login`, `/signin`, `/home`, `/forgot-password`, `/reset-password`) đều được code-splitting bằng `React.lazy` và `Suspense`, với fallback là `MysticLoader`.
- **Route guard `RequireAuth`** bọc quanh `/home`: không có token thì chuyển về `<Navigate to="/login">`. Token được đọc nhất quán theo thứ tự `localStorage` rồi `sessionStorage`, và key `token` rồi `access_token`.
- Ở cấp toàn cục có `SplashCursor` (con trỏ WebGL), `Toaster` và `RouteTransition` lo hiệu ứng chuyển trang.

### 8.3. Tầng service (`services/*`)

- Toàn bộ frontend dùng chung một instance axios tập trung (`api.js`), trong đó:
  - **Request interceptor** tự gắn `Authorization: Bearer <token>`.
  - **Response interceptor** xử lý lỗi tập trung và tự logout khi gặp 401 (xóa token ở cả hai storage rồi điều hướng về `/login`), nhưng loại trừ các endpoint `/api/auth/*` và trang `/login`, `/signin`, để việc nhập sai mật khẩu không làm mất phiên đang dùng.
- **Service chia theo domain:** `authService`, `tarotService` (tự định tuyến giữa ask, ask_with_image và ask_with_media tùy input), `dailyService` (có retry tự viết cùng cache theo user và ngày), `communityService`, `duoService`, `historyService` (fallback về cache offline), `visionsService` (time capsule và dream), cùng `speechService` (TTS đọc kết quả).
- `sessionCache.js` cache lịch sử phiên trong localStorage, làm nguồn dữ liệu offline và tự xóa phần cache hỏng.

### 8.4. HomePage: màn hình chính

`HomePage.jsx` (khoảng 1805 dòng) gom toàn bộ tính năng vào một trang động thay vì chia nhiều route con, và chuyển chế độ qua `selectedCard.mode` gồm `reading` (trải bài), `daily` (lá hằng ngày, khóa lại khi đã rút), `duo`, `community`, `visions`.

- Navbar `CardNav` chia 3 nhóm: "Xem Bài" (lịch sử), "Tarot" (overlay Markdown "Tarot là gì?" và "Catarot"), cùng "Liên hệ".
- Trang này dùng state thuần React (`useState`, `useEffect`, `useCallback`, khoảng 25 state local, không đụng tới Redux, Zustand hay React Query) và đồng bộ user từ storage cùng `getCurrentUser()`.
- `pageScale` lo zoom-to-fit ở desktop (tham chiếu 1500 nhân 880), còn mobile để bằng 1 qua hook `useIsMobile`.
- Hiệu ứng chuyển cảnh `playScene()` đổi nội dung đúng vào lúc màn hình đang bị che (`onCover`).
- **Hiển thị transcript giọng nói:** khi người dùng hỏi bằng giọng nói, bong bóng câu hỏi sẽ hiện transcript ASR kèm biểu tượng micro qua helper `buildUserMessageContent`, để người dùng thấy hệ thống đã nghe đúng ý.

### 8.5. Thư viện component (theo nhóm)

Trải bài và kết quả (`TarotGallery`, `TarotSpreadGrid`, `TarotResultPanel`, `CircularGallery`), chat (`ChatBox`, `DailyChatBox`, `ChatConversation`, `SpeechBubble`), daily và chiêm nghiệm (`DailyResultPanel`, `ReflectionModal`, `ReflectionHistory`), lịch sử (`ReadingHistory`), cộng đồng (`CommunityReadingPanel`, `CommunityFeed`, `CommunityPostCard`, `CommunityPostComposer`, `CommunityModerationPanel`), duo (`DuoReadingPanel`), visions (`VisionsVaultPanel`, `TimeCapsuleComposer` và `TimeCapsuleCard`, `DreamJournalComposer`, `DreamEntryCard`), profile và trợ giúp (`UserProfile`, `ContactPanel`, `MascotHelper`, `MagicCat`), hiệu ứng (`ScrambledText`, `TextType`, `Shuffle`, `ScrollVelocity`, `AnimatedList`, `MarkdownOverlay`, `MysticLoader`), layout và transition (`CardNav`, `ASCIIText`, `RouteTransition`, `CosmicVeil`, `sceneTransition`).

---

## 9. Công nghệ & lý do lựa chọn

### 9.1. Backend

| Công nghệ | Lý do chọn | Phương án thay thế đã cân nhắc |
|-----------|------------|-------------------------------|
| **FastAPI** | Async, tự sinh OpenAPI và Swagger (`/docs`), validation Pydantic gắn liền, type hint thân thiện; route đồng bộ tự chạy trong threadpool nên hợp inference blocking. | Flask (thiếu async và validation), Django (nặng, thiên monolith full-stack) |
| **OpenCLIP** | Embedding ảnh mở, không cần train lại; so khớp FAISS nhanh và chính xác cho tập đóng 78 lá. | Train CNN riêng (tốn dữ liệu và thời gian) |
| **FAISS** | Tìm vector xấp xỉ cực nhanh, chạy CPU (`faiss-cpu`), không cần vector DB ngoài. | Pinecone hoặc Weaviate (tốn phí và phụ thuộc mạng) |
| **sentence-transformers** (`all-MiniLM-L6-v2`) | RAG nhẹ, chạy CPU. | Gọi embedding API trả phí (tốn tiền và chậm) |
| **faster-whisper** | ASR chính xác Việt và Anh, nhanh hơn whisper gốc nhờ CTranslate2, chạy CPU (`int8`). | Google Speech API (tốn phí và lo ngại riêng tư) |
| **Gemini và Groq (free)** | Chi phí 0 đồng, chất lượng tiếng Việt tốt; Groq cực nhanh, là backup khi Gemini hết quota. | OpenAI GPT-4 (tốn phí) |
| **SQLAlchemy 2.0** | Hỗ trợ cả SQLite (dev) lẫn Postgres (prod) trên cùng codebase; kiểu `Mapped` an toàn. | SQL thô (dễ lỗi), Tortoise hoặc Peewee (hệ sinh thái nhỏ hơn) |
| **PBKDF2 (hashlib)** | An toàn, có sẵn trong thư viện chuẩn, không thêm dependency; 200 nghìn vòng đủ mạnh. | bcrypt hoặc argon2 (thêm dependency build nặng) |
| **PyJWT** | Stateless, không lưu session phía server nên scale ngang dễ; hợp SPA. | Session-cookie (phức tạp với SPA cross-origin) |
| **APScheduler** | Lên lịch ngay trong tiến trình app, không cần Celery cộng broker. | Celery (quá nặng cho nhu cầu này) |

### 9.2. Frontend

| Công nghệ | Lý do chọn |
|-----------|------------|
| **React 19** | Hệ sinh thái lớn, component model hợp UI giàu trạng thái. |
| **Vite 7** | HMR cực nhanh, build tối ưu (tree-shaking, code-split), cấu hình tối giản. |
| **axios** | Interceptor tiện cho gắn token và xử lý lỗi tập trung; gọn hơn `fetch` cho multipart. |
| **framer-motion và gsap** | Hiệu ứng chuyển cảnh mượt, đúng định hướng huyền bí của Tarot. |
| **react-markdown** | LLM trả Markdown nên render trực tiếp, an toàn. |

---

## 10. Bảo mật

- Không hardcode secret, toàn bộ qua env; `.env` nằm trong `.gitignore`; có `.env.example`.
- Mật khẩu PBKDF2 200 nghìn vòng cộng salt; so sánh hằng thời gian.
- JWT fail-fast ở production; secret yếu thì chặn boot. Chỉ chấp nhận thuật toán họ HS256.
- Không tin `user_id` client gửi, lấy từ JWT. Chống IDOR ở mọi endpoint thao tác dữ liệu cá nhân (trả 404 thay vì 403 cho session).
- Rate limit cho `/api/auth/*` và `/api/ask*` (trả 429).
- Chống dò email khi quên mật khẩu.
- Upload chặt: whitelist đuôi file, giới hạn 25MB, xóa file tạm trong `finally`.
- Sanitize dữ liệu cộng đồng (whitelist cộng cắt độ dài); automod chống prompt injection (bọc `<<<DATA>>>`) cộng chuẩn hóa chống lách từ cấm.
- Che API key trong mọi log lỗi LLM và automod.
- Frontend: không dùng `dangerouslySetInnerHTML`, loại `console.*` ở production, tự logout khi 401.

---

## 11. Triển khai (Deploy)

Cả hệ thống được thiết kế để chạy miễn phí trên free tier.

### 11.1. Backend lên Hugging Face Spaces (Docker SDK)

- `backend/Dockerfile` dựng theo kiểu multi-stage trên Python 3.11-slim, cài torch và torchvision bản CPU-only (nhẹ hơn khoảng 3 đến 5GB so với bản CUDA), chạy non-root UID 1000, expose port 8000, và có `HEALTHCHECK` gọi `/api/health`.
- Các secret (`GEMINI_API_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `DATABASE_URL`) đặt trong phần Settings của Space; metadata để trong `SPACE_README.md`.
- **Lý do chọn:** bản free cho 16GB RAM và 2 vCPU, đủ để load các model Vision, RAG và ASR (khoảng 4GB); hỗ trợ Docker gốc; và quan trọng là không cần thẻ tín dụng.
- **Đánh đổi:** build lần đầu mất 10 đến 15 phút vì phải tải model, có cold-start, và SQLite trong container thì không bền vững nên nhóm khuyến nghị trỏ `DATABASE_URL` sang Postgres.

### 11.2. Frontend lên Cloudflare Workers (static assets)

- Chạy `npm run build` ra thư mục `dist/`, rồi deploy bằng `wrangler` với `not_found_handling: single-page-application` để mọi route không khớp đều rơi về `index.html` cho React Router xử lý. Các biến `VITE_API_BASE_URL` và `VITE_GOOGLE_CLIENT_ID` được inline lúc build.
- **Lý do chọn:** CDN toàn cầu miễn phí, độ trễ thấp, HTTPS tự động, và SPA-fallback dễ cấu hình. Repo cũng kèm sẵn `vercel.json` và `_redirects` cho phương án khác.

### 11.3. Cơ sở dữ liệu lên Neon (PostgreSQL serverless, free)

- Dữ liệu cần sống sót qua các lần rebuild Space, nên kết nối bằng `postgresql+psycopg2://...?sslmode=require`. Code đã lo sẵn việc chuẩn hóa scheme cùng `pool_pre_ping` và `pool_recycle`.

### 11.4. Tự host bằng Docker Compose

- `docker-compose.yml` dựng cả backend (kèm volume bền vững cho `data`, `models`, `uploads` và healthcheck) lẫn frontend (nginx cộng SPA fallback). Chỉ một lệnh `docker compose up --build` là chạy được full stack.

### 11.5. Vì sao tách ba nơi?

Mỗi thành phần có nhu cầu tài nguyên khác hẳn nhau: backend cần nhiều RAM nên đặt ở Hugging Face, frontend cần CDN nhanh nên dùng Cloudflare, còn DB cần bền vững nên chọn Neon. Tách ra như vậy giúp nhóm chọn đúng free tier mạnh nhất cho từng phần, scale từng phần độc lập, và khi một nơi gặp sự cố thì thiệt hại cũng được khoanh lại.

---

## 12. Kiểm thử & chất lượng mã

- **Backend (pytest):** 174 hàm test trải trên 26 file, phủ khắp pipeline (smoke), DB persistence, migration Alembic, auth và security, LLM fallback, conversation context, RAG, vision, TTS (chuẩn hóa văn bản, đóng gói WAV, suy biến mềm, endpoint), rating reminders, các tính năng nâng cao (duo, community, daily-card kèm luận giải sâu, dream journal kèm diễn giải tổng hợp, time capsule), random và media, cùng timezone. Ở bản final toàn bộ đều xanh.
- **Lint backend:** `ruff check src/` báo sạch, 0 lỗi.
- **Frontend:** `npm run lint` (ESLint, rule `react-hooks` nghiêm) sạch; `npm run build` (Vite production) chạy thành công.
- **Rà soát chất lượng (bản final):** nhóm review chéo nhiều vòng theo từng lát cắt là bảo mật, hiệu năng, logic nghiệp vụ và UX; mỗi phát hiện đều được kiểm chứng lại trực tiếp trên code hoặc chạy thử trước khi sửa. Kết quả là từ 32 phát hiện thô, có 12 lỗi xác nhận là thật (3 mức HIGH, 9 mức MEDIUM) và đã sửa, còn 1 cảnh báo bị loại sau khi kiểm chứng: nghi vấn "Duo realtime hỏng" hóa ra sai, vì frontend vốn cập nhật qua polling.

---

## 13. Hạn chế đã biết & hướng phát triển

Nhóm ghi nhận các hạn chế dưới đây để trung thực với thực trạng hệ thống:

- **Rate limit in-memory** chỉ đúng khi chạy một process; muốn multi-worker thì cần Redis.
- **SQLite không bền vững trên free tier**, nên ở production vẫn nên dùng Postgres (Neon).
- **Model nặng RAM** (khoảng 4GB), nên với host nhỏ thì cần bật `VISION_DEMO_MODE`.
- **ASR `large-v3` nặng trên CPU**, nên với host ít vCPU (Hugging Face free chỉ 2 vCPU) thì đặt `ASR_MODEL_FASTER=base` hoặc `small` cho giọng nói phản hồi nhanh, tránh timeout.
- **Duo Reading:** backend đã có WebSocket nhưng frontend hiện vẫn dùng polling REST, chưa nối WebSocket phía client.
- **Lá người dùng chọn ở luồng text không quyết định lá kết quả:** backend rút ngẫu nhiên theo ẩn dụ "vũ trụ chọn cho bạn"; lá hiển thị khớp với lá đưa vào LLM nên vẫn nhất quán. Muốn lá người dùng chọn thực sự ảnh hưởng thì phải đổi contract `QuestionRequest`.
- **`spread_recommender` mới dừng ở mức gợi ý**, backend hiện thực tế chỉ thực thi trải 3 lá.
- **Analytics và retention tính trong bộ nhớ**, hợp với dữ liệu nhỏ, chưa tối ưu cho quy mô lớn.

Về hướng phát triển, nhóm dự tính bổ sung bộ Tarot đầy đủ 78 lá có ảnh, đưa Duo realtime sang WebSocket phía client thay cho polling, làm giao diện đa ngôn ngữ, hỗ trợ PWA offline, và chuyển rate-limit cùng analytics sang Redis khi cần scale ngang.
