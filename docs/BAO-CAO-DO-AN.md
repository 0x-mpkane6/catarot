# [CATAROT] BÁO CÁO ĐỒ ÁN (BẢN CHI TIẾT)

Phần này đi sâu vào ba mặt của hệ thống là kiến trúc, công nghệ và chức năng, kèm theo lý do đứng sau từng quyết định.

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

**Tên hệ thống:** CATAROT (API tự đặt tiêu đề `Tarot Multimodal API`, version `0.2.0`).

**Mô tả:** Đây là ứng dụng web cho người dùng đặt câu hỏi theo ba cách: gõ **văn bản**, nói bằng **giọng nói**, hoặc chụp **ảnh lá bài thật**. Hệ thống sẽ nhận diện lá bài, tra cứu ý nghĩa rồi dùng mô hình ngôn ngữ lớn (LLM) viết ra **luận giải tiếng Việt**, và nếu muốn, người dùng có thể **nghe luận giải bằng giọng đọc tiếng Việt** (TTS). Quanh luồng đọc bài chính, nhóm xây thêm một loạt tính năng để giữ chân và tăng tương tác: lá bài hằng ngày kèm streak, viên nang thời gian, nhật ký giấc mơ, đọc bài đôi thời gian thực, phòng cộng đồng có kiểm duyệt (kèm bot tự động), hồ sơ nguyên mẫu (archetype), báo cáo Oracle định kỳ, thông báo và phân tích hành vi.

**Triết lý sản phẩm:** toàn bộ hệ thống chạy **miễn phí** trên hạ tầng free tier, vốn là lựa chọn hợp lý cho một đồ án sinh viên. Một điểm nhóm theo đuổi là hệ thống không nên trả lỗi 500 chỉ vì thiếu model hay API key, nên mỗi tầng AI đều có sẵn cơ chế suy biến an toàn (graceful degradation).

**Quy mô:** ~11.600 dòng Python (`backend/src`) + ~20.900 dòng JS/JSX/CSS (`frontend/src`); **hơn 60 endpoint REST + 1 WebSocket**; cơ sở dữ liệu **24 bảng** quan hệ; bộ kiểm thử **137 hàm test trên 24 file**.

---

## 2. Kiến trúc tổng thể

Hệ thống đi theo kiến trúc **client–server tách rời (decoupled SPA + API)** và được triển khai trên **3 hạ tầng độc lập**:

```
                NGƯỜI DÙNG (trình duyệt)
                        │
                        ▼
┌──────────────────────────────┐   HTTPS / WSS            ┌────────────────────────────────────────┐
│  FRONTEND (SPA)              │   REST JSON + multipart  │  BACKEND (FastAPI monolith)              │
│  React 19 + Vite 7           │ ───────────────────────▶ │                                           │
│  → Cloudflare Workers (CDN)  │   JWT Bearer             │  HTTP layer (main.py, ~60 route + 1 WS)  │
│                              │ ◀─────────────────────── │      │                                    │
│  - React Router v7 (SPA)     │                          │      ▼                                    │
│  - axios (JWT interceptor)   │                          │  Service layer (advanced/*, pipeline/*)  │
│  - tự logout khi 401         │                          │      │                                    │
└──────────────────────────────┘                          │      ▼                                    │
                                                           │  Data layer (SQLAlchemy 2.0)             │
                                                           │  + Schedulers (APScheduler, in-process)  │
                                                           └──────────────────┬───────────────────────┘
                                                                              │
                                                          ┌───────────────────┴────────────────────┐
                                                          │  PostgreSQL (Neon, prod) / SQLite (dev)  │
                                                          └──────────────────────────────────────────┘

   LLM bên ngoài (chuỗi dự phòng): Gemini → OpenAI → Groq → Ollama → fallback tất định
```

Có bốn nguyên tắc kiến trúc xuyên suốt cả hệ thống:

1. **Tách rời FE/BE.** Hai bên chỉ nói chuyện với nhau qua API JSON và JWT, không có server-side rendering. Nhờ vậy mỗi bên deploy riêng, scale riêng, và sửa một bên thì bên kia không bị động chạm.
2. **Phân tầng rõ ở backend.** `main.py` lo phần HTTP và route, giữ cho mỏng; tầng `advanced/*` và `pipeline/*` chứa business logic; còn `db/*` lo truy cập dữ liệu. Route chỉ làm nhiệm vụ nhận request, validate, rồi đẩy việc xuống tầng service.
3. **Suy biến duyên dáng (graceful degradation).** Mỗi tầng AI (ASR/Vision/RAG/LLM) và mỗi điểm phụ thuộc bên ngoài đều có phương án dự phòng nhiều lớp.
4. **Bảo mật theo mặc định.** JWT fail-fast ở production, không tin `user_id` do client khai, chống IDOR, rate limit, chống enumeration email, và che (redact) API key trong log.

---

## 3. Danh mục chức năng chi tiết

Phần này mô tả giá trị nghiệp vụ và cách hoạt động của từng nhóm chức năng, kèm endpoint tiêu biểu.

### 3.1. Đọc bài lõi (Reading)

- **Đa phương thức:** `POST /api/ask` (JSON text), `POST /api/ask_with_image` (multipart, tối đa 3 ảnh), `POST /api/ask_with_media` (ảnh + audio). Tất cả chạy qua pipeline 4 tầng AI (mục 5).
- **Hai chế độ rút bài:** nhận diện từ ảnh thật, hoặc **rút ngẫu nhiên** (`random_draw`) khi người dùng không có bài vật lý. Mọi quẻ chuẩn hoá về kiểu trải **"three"** (Quá khứ / Hiện tại / Tương lai).
- **Hỏi bằng giọng nói (voice-only):** trường `question` để **tuỳ chọn** (`Form("")`) ở `ask_with_media`/`ask_with_image`. Khi người dùng chỉ ghi âm mà không gõ chữ, câu hỏi nằm trong audio; transcript ASR được ghép vào truy vấn rồi **hiển thị lại trên giao diện** dưới dạng bong bóng `🎙️ …`.
- **`user_id` lấy từ JWT, không tin body.** Cách này chống giả mạo và tránh việc ghi đè lịch sử của user khác.
- **Nghe luận giải (TTS):** `POST /api/tts` đọc văn bản luận giải thành **giọng nói tiếng Việt** bằng `facebook/mms-tts-vie` (VITS, chạy qua `transformers` đã có sẵn nên không phải thêm dependency), trả về `audio/wav`. Văn bản dài quá 1.200 ký tự sẽ bị cắt bớt, kèm cảnh báo qua header `X-TTS-Warnings` (phải percent-encode vì header HTTP chỉ nhận latin-1). Phần này tổng hợp **on-demand**, không chen vào pipeline đọc bài; nếu TTS tắt hoặc lỗi thì trả 503 kèm thông điệp, còn phần chữ vẫn dùng được như thường.
- **Chấm điểm:** `POST /api/readings/{session_id}/rating` (1–5 sao).

### 3.2. Hội thoại tiếp nối (Follow-up conversation)

- `POST /api/sessions/{id}/followup` để hỏi sâu thêm trong cùng phiên đọc; `GET /api/sessions/{id}/conversation` để lấy lịch sử chat.
- **Quản lý cửa sổ ngữ cảnh:** hệ thống giữ nguyên tối đa **8 lượt gần nhất** (`MAX_RECENT_TURNS = 8`), còn các lượt cũ hơn được **tóm tắt tất định** bằng cách nối nội dung đã cắt gọn, không tốn lượt gọi LLM. Khi sinh câu trả lời, LLM nhận đủ bộ: ngữ cảnh phiên gốc (câu hỏi, lá bài, cảm xúc, đáp án cũ), bản tóm tắt, 8 lượt gần nhất, và câu hỏi mới.
- Mỗi follow-up tạo ra 2 lượt (`user` rồi `assistant`), với `turn_index` lấy theo `MAX(turn_index)+1`.

### 3.3. Lịch sử (History)

- `GET /api/sessions` (phân trang newest-first), `GET /api/sessions/{id}` (chi tiết: lá + đáp án cuối).
- Frontend có thêm **cache offline** (`sessionCache.js`): khi API lỗi, danh sách phiên vẫn hiện ra từ localStorage.

### 3.4. Xác thực (Auth)

- `POST /api/auth/register` (luôn tạo role `member`), `/login` (đăng nhập bằng username hoặc email), `/forgot-password`, `/reset-password`, **`/google`** (OAuth), `GET /api/auth/me`.
- Chi tiết kỹ thuật ở mục 4.3.

### 3.5. Hồ sơ (Profile)

- `GET /api/profile/me`, `PATCH|POST /api/profile/me` để cập nhật `avatar_url`, `bio`, `display_name`, `username` (trùng username thì trả 409).

### 3.6. Daily Card + Streak (gamification)

- `GET /api/daily-card` (một-chạm: get-or-create lá hôm nay + streak), `POST /api/daily-card/draw`, `POST /api/daily-card/{id}/reflect` (mood + chiêm nghiệm), `GET /api/daily-card/streak`, `GET /api/daily-card/history`, `GET /api/daily-card/{date}/image` (ảnh PNG chia sẻ).
- **Cách hoạt động:** mỗi user rút đúng **1 lá/ngày** theo lịch địa phương. Lá được chọn **ngẫu nhiên** (`random.choice` trên toàn bộ `TarotCard` cộng với chiều ngẫu nhiên), chứ không phải tính tất định theo user và date.
- **Streak:** đếm số ngày liên tiếp, mỗi ngày cách nhau đúng 1 ngày tính từ hôm nay hoặc hôm qua; song song đó hệ thống cũng quét toàn lịch sử để tính `longest_streak`.
- **Idempotent + chống race:** chỗ này dựa vào `UniqueConstraint(user_id, draw_date)`. Nếu 2 request cùng ngày chạy song song, request thua sẽ bắt `IntegrityError`, rollback rồi đọc lại bản ghi đã có.
- **Affirmation tất định:** đi kèm mỗi lá là một câu khẳng định sinh **tất định** — hash SHA-1 của `lá|chiều|ngày` rồi chọn template — nên cùng lá, cùng chiều, cùng ngày sẽ luôn cho cùng một câu mà không tốn LLM.
- **Luận giải sâu theo chủ đề (RAG + LLM):** `POST /api/daily-card/deep-reading` cho người dùng **gõ chủ đề tự do** như "chuyện chuyển việc" hay "sức khoẻ tinh thần"; LLM (qua chuỗi fallback) sinh ra 4 mục cố định là Tổng quan, Lời khuyên, Một việc nên làm và Một điều nên tránh, kèm **bản dự phòng tất định** khi mất mạng. Chủ đề tự do được `_detect_theme()` suy ra nhóm để phục vụ phần dự phòng. Kết quả được **cache theo `(user, ngày, chủ đề)`** trong bảng `daily_deep_readings` (unique constraint), nên bấm lại cùng chủ đề trong ngày sẽ không gọi LLM lần nữa.

### 3.7. Time Capsule (viên nang thời gian)

- `POST /api/time-capsules`, `GET /api/time-capsules`, `GET /api/time-capsules/{id}`, `POST .../reveal`, `POST .../verdict`.
- **Cách hoạt động:** người dùng "niêm phong" một lời tiên đoán kèm ngày mở (`reveal_at`, ràng buộc tối thiểu 6 giờ và tối đa 3 năm). Vòng đời của capsule đi từ `sealed` sang `revealed` rồi `verified`. Khi chưa tới hạn, nội dung bị giấu đi, chỉ trả về metadata và lời niêm phong.
- **Chấm độ chính xác do chính người dùng nhập (1–5 sao)** — không có thuật toán tự động nào ở đây.
- Người dùng cũng có thể tạo capsule từ một phiên đọc cũ; lúc đó hệ thống hydrate lá và câu hỏi từ `ReadingSession`, có lọc `user_id` để chống IDOR.

### 3.8. Dream Journal (nhật ký giấc mơ)

- `POST /api/dreams` (text và/hoặc audio), `GET /api/dreams`, `GET /api/dreams/{id}`.
- **Cách hoạt động:** nhận giấc mơ vào, nếu có audio thì chuyển giọng thành text trước, rồi **trích biểu tượng** qua 2 tầng. Tầng đầu ưu tiên để LLM trả về một mảng JSON gồm 3–7 biểu tượng kèm lá bài và câu ý nghĩa; nếu mảng đó rỗng thì rơi về luật khớp chuỗi con từ `dream_symbol_map.json`. Tiếp theo hệ thống **ánh xạ sang lá Tarot (arcana)** rồi **đối chiếu chéo** với các phiên đọc bài của user trong 7 ngày gần nhất.
- **Diễn giải tổng hợp (nâng cấp mới):** ngoài biểu tượng và lá bài, LLM (qua chuỗi fallback) còn sinh thêm `summary_interpretation` ("giấc mơ nói gì về mình"), `main_theme`, `emotional_tone`, `recent_reading_connections` (liên hệ với phiên đọc trong 7 ngày, có **lọc bỏ những session_id LLM bịa ra**), `reflection_questions` (2–3 câu phản tư) và `suggested_action` (một việc nhỏ nên làm). Khi LLM lỗi vẫn có **bản dự phòng tất định**; toàn bộ phần này lưu ở cột `interpretation_json` (nullable nên giấc mơ cũ không bị ảnh hưởng, và frontend tự ẩn các mục mới).

### 3.9. Duo Reading (đọc bài đôi thời gian thực)

- `POST /api/duo/sessions`, `.../join`, `.../join_by_invite`, `.../card` (nộp ảnh lá), `GET .../{id}`, và **WebSocket `WS /ws/duo/{id}`**.
- **Cách hoạt động:** hai người vào chung một phòng (mời nhau qua `invite_code` 8 ký tự sinh bằng `secrets`), mỗi người nộp 1 lá; khi đủ 2 lá thì hệ thống gộp lại thành **một luận giải tương hợp**. Phòng đi qua các trạng thái `waiting_partner`, `waiting_cards`, `generating` rồi `completed`.
- **Realtime:** backend có `DuoWsManager` quản lý kết nối WebSocket theo phòng và broadcast trạng thái (`duo_created`, `snapshot`, heartbeat `ping/pong`). Cần nói thẳng ở đây: frontend hiện cập nhật trạng thái bằng cách gọi lại `getDuoSession` (polling REST) chứ chưa nối WebSocket client, nên đây là một điểm còn có thể nâng cấp.
- **Tối ưu khoá DB:** lệnh gọi LLM (~120s) được tách hẳn ra ngoài transaction, để không giữ write-lock suốt thời gian sinh nội dung.

### 3.10. Community (cộng đồng có kiểm duyệt)

- User: `POST /api/community/posts`, `GET /api/community/feed`, `POST .../interpretations`, `.../vote`, `.../resonate`.
- Admin: `GET /api/admin/community/moderation_queue`, `.../approve`, `.../reject`.
- **Cách hoạt động:** người dùng đăng câu hỏi hoặc quẻ bài dưới một **bí danh ẩn danh** (`Seeker-{id:04d}`, suy ra từ ID nên không lộ user thật); người khác vào **luận giải hộ**, **vote**, và chủ bài có thể đánh dấu **đồng cảm (resonate)**. Bài chỉ hiển thị công khai khi đã `approved`, theo luồng `pending` sang `approved` hoặc `rejected`.
- **Điểm kỹ thuật:** feed tránh **N+1** bằng cách gom toàn bộ interpretation vào 1 query `IN (...)`; vote vừa **chống race vừa tự chữa lệch đếm** (bắt `IntegrityError`, sau đó `COUNT()` lại số vote thật từ bảng thay vì tin cột counter); trường lá bài được sanitize theo whitelist để chống nhồi dữ liệu.

### 3.11. Auto-moderation bot (opt-in, ưu tiên an toàn)

- `POST /api/admin/community/automod/run` (có `dry_run`), `GET .../automod/preview`.
- **Cách hoạt động:** bot quét các bài `pending` rồi phân loại thành approve, reject hoặc escalate, theo kiến trúc **2 lớp**. Lớp đầu là tiền lọc bằng luật: kiểm tra độ dài, từ cấm hard-block, URL/PII/quảng cáo, và có chuẩn hoá để chống lách bộ lọc kiểu `đ.ị.t`. Lớp sau dùng Gemini phân loại với JSON schema, `temperature=0`, và **chống prompt injection** bằng cách bọc dữ liệu trong khối `<<<DATA>>>`.
- **Triết lý an toàn:** bot mặc định **TẮT** (opt-in qua `COMMUNITY_AUTOMOD_ENABLED`). Mọi trường hợp nghi ngờ hoặc LLM lỗi đều **escalate cho người, không tự approve**; bot chỉ tự `reject` khi bật thêm `COMMUNITY_AUTOMOD_AUTOREJECT`. Nó cũng không ghi đè quyết định của admin thật, tức là idempotent khi bài đã rời `pending`.

### 3.12. Gợi ý & phân tích người dùng

- **Gợi ý câu hỏi** `GET /api/question_suggestions` chạy **rule-based, không dùng LLM**: dựa vào **pha trăng** (tính bằng toán thiên văn từ chu kỳ 29,53 ngày), **thứ trong tuần**, và lá bài gần nhất; mỗi gợi ý đều kèm `reason` minh bạch.
- **Gợi ý trải bài** `POST /api/spread/recommend` cũng **rule-based**: nó phân loại chủ đề và độ khẩn từ từ khoá rồi đề xuất kiểu trải; có cờ `can_run_with_current_backend` (thực tế backend hiện chỉ chạy trải 3 lá).
- **Hồ sơ archetype** `GET /api/users/{id}/archetype_profile` tổng hợp lịch sử khi có từ 5 phiên trở lên: lá hay gặp nhất thành Soul Card, top từ khoá rút ra từ câu hỏi, cảm xúc thường gặp. Phần này **không dùng LLM**.
- **Oracle report** `GET /api/users/{id}/oracle_reports[/latest]` là thư tổng kết tháng do LLM viết (có fallback tất định) rồi gửi qua email.
- **Affirmations** `GET /api/affirmations/{card_name}` không cần auth và chạy tất định.
- **Notifications** `GET /api/notifications`, `.../read`, `GET|PUT /api/notification-preferences`.
- **Analytics (admin)** `GET /api/admin/analytics/funnel` đếm sự kiện và tính retention D1/D7.

---

## 4. Kiến trúc Backend

### 4.1. Tầng HTTP — FastAPI (`src/main.py`)

- **Entry:** nơi đăng ký toàn bộ **~60 endpoint REST + 1 WebSocket** (`/ws/duo/{id}`).
- **Middleware:**
  - `request_id_middleware` gắn `x-request-id` (lấy từ header hoặc sinh `uuid4`) cho mỗi request rồi echo lại trên response, phục vụ truy vết log.
  - `CORSMiddleware` đọc origin từ env `API_ALLOWED_ORIGINS`.
  - **Exception handler tổng** biến mọi lỗi không lường trước thành JSON `500 {detail, request_id}` và không để lộ stack trace ra client.
- **Lifespan (startup):** khởi tạo DB (kèm seed bài Tarot), **fail-fast JWT_SECRET_KEY** (chặn boot nếu ở production mà secret yếu hoặc thiếu), rồi bật các scheduler (rating, analytics, automod opt-in, notification opt-in). Lúc **shutdown** thì dừng scheduler theo thứ tự ngược lại.
- **Validation:** mọi request body đều qua **Pydantic** — `password` min 6, `username` 3–64, `score` 1–5, `daily_card_hour` 0–23, phân trang ràng buộc bằng `Query(ge=…, le=…)`, v.v.
- **Upload chặt:** whitelist đuôi file (ảnh và âm thanh), giới hạn **25MB**, đặt tên file ngẫu nhiên bằng `uuid4`, đọc theo chunk 1MB, và **xoá file tạm trong `finally`** kể cả khi gặp lỗi.

### 4.2. Pipeline (tóm tắt — chi tiết ở mục 5)

`src/pipeline/tarot_pipeline.py` đóng vai **bộ điều phối**, gọi 5 module con theo trình tự ASR → Emotion → Vision/Random → RAG → LLM. Bản thân nó không chứa AI; thay vì ném lỗi, nó gom các cảnh báo (`warnings`) lại, nhờ vậy một tầng hỏng không kéo sập cả phiên đọc.

### 4.3. Xác thực & phân quyền (`src/auth/`)

| Khía cạnh | Triển khai |
|-----------|-----------|
| **Băm mật khẩu** | PBKDF2-HMAC-SHA256, **200.000 vòng**, salt ngẫu nhiên 16 byte; lưu dạng `pbkdf2_sha256$<salt>$<digest>`; so sánh bằng `hmac.compare_digest` (chống timing attack). Chỉ dùng `hashlib` chuẩn, không thêm dependency. |
| **Token** | **JWT HS256** (override qua `JWT_ALGORITHM`), payload `{sub, role, iat, exp}`, hạn mặc định **120 phút** (tối thiểu 5). |
| **Fail-fast** | Ở `APP_ENV=production`, nếu `JWT_SECRET_KEY` rỗng / trong danh sách yếu / `< 32 ký tự` → **app từ chối khởi động** (`RuntimeError`). |
| **Google OAuth** | Xác thực `id_token` qua `google-auth` với `audience = GOOGLE_CLIENT_ID`; liên kết theo `google_id` hoặc email, tạo user mới (role `member`) nếu chưa có. Thiếu `GOOGLE_CLIENT_ID` → 503; token sai → 401. |
| **Reset mật khẩu** | Token `secrets.token_urlsafe(32)`, TTL mặc định **30 phút**, dùng một lần (xoá sau khi đổi). **Chống enumeration:** response giống nhau dù email tồn tại hay không. |
| **Phân quyền admin** | Qua env `ADMIN_EMAILS` — role `admin` được **tính lại mỗi request** (sống sót qua reset DB); đăng ký công khai **luôn** là `member`. |
| **Chống IDOR** | `_ensure_self_or_admin` (chặn user A xem dữ liệu user B → 403) và `_ensure_session_owner_or_admin` (trả **404** thay vì 403 để không lộ sự tồn tại của session). Endpoint `/api/ask*` lấy `user_id` từ JWT, không tin client. |

### 4.4. Rate limit & validation (`src/utils/`)

- **Rate limiter:** dùng **sliding window** in-memory (lưu mốc `time.monotonic()` trong `deque`), có `threading.Lock`; key tính theo `"{scope}:{ip}"` với IP ưu tiên lấy từ `x-forwarded-for`. Vượt ngưỡng thì trả **HTTP 429**, và toàn bộ bật tắt qua `RATE_LIMIT_ENABLED`.
  - Phạm vi áp dụng gồm `auth/*` (register 5/60s, login 10/60s, forgot/reset 5/60s, google 10/60s) và nhóm `ask*` (mặc định 20/60s, override qua env).
  - Nói cho rõ: các endpoint còn lại như sessions, daily, community, duo… **không** gắn rate limit. Và vì là in-memory nên cách này chỉ đúng khi chạy 1 process; muốn multi-worker thì cần Redis.
- **Validators:** kiểm `email` (regex cộng với độ dài ≤254) và `normalize_email`. Phần còn lại để cho tầng Pydantic validate.

---

## 5. Pipeline AI đa phương thức (đào sâu)

Trong `src/pipeline/tarot_pipeline.py`, hàm `run_pipeline()` điều phối đúng 7 bước:

```
① ASR        transcribe_audio(audio)        → transcript
② EMOTION    analyze_voice_emotion(audio)   → emotion_state
③ LẤY LÁ     random_draw ? _draw_random_cards() : _build_card_outputs()  → cards
④ OVERRIDE   _apply_overrides()             → cho phép sửa lá tay
⑤ GỘP QUERY  query = question + transcript
⑥ RAG        _collect_snippets(query, cards) → rag_snippets
⑦ LLM        reader.generate(...)           → final_answer (Markdown tiếng Việt)
```

### 5.1. Tầng ① ASR — Nhận diện giọng nói (`asr/transcribe.py`)

- Trước hết audio được chuẩn hoá định dạng về WAV mono 16kHz bằng `ffmpeg` (nếu thiếu ffmpeg thì chỉ cảnh báo nhẹ và bỏ qua bước này).
- **Hai backend xếp theo ưu tiên:** đầu tiên là `faster-whisper` (model `large-v3`, `device=cpu`, `compute_type=int8`, load 1 lần rồi cache qua `lru_cache`); nếu không được thì dự phòng bằng `transformers whisper-small`; cuối cùng trả `None` để pipeline vẫn chạy tiếp mà không có transcript.
- **Chế độ song ngữ `auto_vi_en`:** chạy nhận diện cả tiếng Việt lẫn tiếng Anh, mỗi bản kèm `avg_logprob`, rồi chọn bản có điểm tin cậy cao hơn. Cách này xử lý tốt người Việt nói chêm tiếng Anh.

### 5.2. Tầng ② Vision — Nhận diện lá bài (`vision/`)

- **Embedding:** dùng **OpenCLIP ViT-B-32** (pretrained `laion2b_s34b_b79k`) trên CPU, rồi **L2-normalize**. Phòng khi máy không cài nổi OpenCLIP, hệ thống có sẵn **demo mode** dựa trên histogram màu, ảnh xám và gradient (864 chiều).
- **So khớp:** dùng `faiss.IndexFlatIP` (Inner Product). Do vector đã được L2-norm nên inner product chính là cosine similarity, tức là tìm lá có góc vector gần nhất.
- **Mẹo 1 — nhận biết lá NGƯỢC:** hệ thống embed cả ảnh gốc và ảnh xoay 180°; ứng viên đến từ bản xoay sẽ bị **đảo orientation** (upright↔reversed). Nếu bản xoay khớp tốt hơn thì nghĩa là lá đang đặt ngược, nên không cần ảnh huấn luyện riêng cho lá ngược.
- **Mẹo 2 — độ tin cậy:** tính `confidence = (margin + 0.2) / 0.8` với `margin = score_top1 − score_top2`. Tức là độ tin cậy đo bằng **độ tách biệt** giữa ứng viên hạng nhất và hạng nhì chứ không phải điểm tuyệt đối. Nếu xuống dưới ngưỡng `confidence_threshold = 0.18` thì hệ thống cảnh báo người dùng chụp lại hoặc chọn từ top-5.
- Khi không có FAISS index, tầng này trả về kết quả dự phòng (danh sách lá mặc định) thay vì sập. `index.py` còn có guard kiểm tra chiều vector, tránh assertion mơ hồ của FAISS khi index 512 chiều gặp demo 864 chiều.

### 5.3. Tầng phụ — Phân tích cảm xúc giọng nói (`advanced/emotion_analysis.py`)

- Tầng này **không dùng model ML** mà chỉ phân tích tín hiệu số: `pause_ratio` (tỉ lệ khoảng lặng), `energy_mean/std` (năng lượng), `zero_crossing_rate` (độ gấp gáp). Từ các chỉ số đó, một bộ luật ngưỡng phân giọng nói về 5 nhãn `sad / anxious / excited / uncertain / calm`. Nhãn này sau đó được chèn vào prompt LLM để điều chỉnh tông giọng cho đồng cảm hơn.

### 5.4. Tầng ③ RAG — Truy hồi ý nghĩa lá bài (`rag/retrieve.py`)

- **Embedding text:** dùng `sentence-transformers/all-MiniLM-L6-v2` (nhẹ, chạy CPU) cùng FAISS.
- Truy vấn được ghép thành `"<câu hỏi> card=<tên lá> orientation=<chiều>"`, đem đi search, rồi **lọc theo metadata** để snippet đúng lá đang xét. Nhiều lớp dự phòng (chẳng hạn cùng lá khác chiều thì dùng placeholder) bảo đảm luôn có tối thiểu 3 snippet cho LLM, qua đó giảm bịa (hallucination).

### 5.5. Tầng ④ LLM — Sinh luận giải, chuỗi dự phòng 4 tầng (`llm/generate.py`)

| Tier | Nhà cung cấp | Vai trò | Ghi chú |
|------|--------------|---------|---------|
| 1 | **Google Gemini** (`gemini-2.5-flash`, free) | Ưu tiên cao nhất | **Xoay vòng nhiều API key** khi 1 key dính 429 |
| 2 | OpenAI (`gpt-4o-mini`) | Tuỳ chọn | Chỉ chạy nếu có `OPENAI_API_KEY` |
| 3 | **Groq** (`llama-3.3-70b-versatile`, free) | Backup chính | OpenAI-compatible, rất nhanh |
| 4 | Ollama (`qwen2.5:3b-instruct`, local) | Khi self-host | — |
| ⤓ | **Fallback tất định** | Lưới an toàn cuối | Sinh luận giải từ template + từ điển nghĩa lá bài tiếng Việt, **không cần internet** |

Vài chi tiết kỹ thuật đáng chú ý:

- **Prompt engineering có chủ đích:** trước khi đưa vào prompt, hệ thống lọc bỏ các cảnh báo nhạy cảm như "ngẫu nhiên" hay "chụp lại" để LLM không lỡ tiết lộ rằng bài là ngẫu nhiên hay nhắc người dùng chụp lại một cách thừa thãi; đồng thời truyền vào một cờ rõ ràng cho biết có thêm mục `### Lưu ý` hay không.
- **Bảo mật log:** mọi thông báo lỗi HTTP đều **thay API key bằng `<redacted>`**.
- Đặt **`maxOutputTokens = 0`** nghĩa là bỏ trần, để bài luận giải không bị cắt giữa câu.
- `last_used_model` ghi lại model nào thực sự đã trả lời và trả về frontend, giúp minh bạch và dễ debug.
- **Fallback tất định** dùng `_detect_theme()` (khớp từ khoá **không dấu**, hỗ trợ cả Việt lẫn Anh) để chọn chủ đề như tình cảm, sự nghiệp, tài chính, sức khoẻ hay học tập, rồi ghép nghĩa lá với lời khuyên 7 ngày.

### 5.6. Sợi chỉ đỏ: Graceful Degradation ở mọi tầng

| Tầng | Lý tưởng | Dự phòng | Lưới an toàn cuối |
|------|----------|----------|-------------------|
| ASR | faster-whisper | transformers whisper | chạy không transcript |
| Vision | OpenCLIP + FAISS | demo embedder | danh sách lá mặc định |
| RAG | FAISS đúng lá | cùng lá khác chiều | placeholder snippet |
| LLM | Gemini (nhiều key) | OpenAI → Groq → Ollama | **template tất định offline** |
| TTS | mms-tts-vie (VITS) | tắt qua `TTS_ENABLED` | 503 kèm thông điệp, web vẫn đọc chữ |

Nhờ vậy hệ thống không trả lỗi 500 chỉ vì thiếu model hay hết quota.

---

## 6. Tầng dữ liệu

### 6.1. ORM & danh mục bảng

- Tầng dữ liệu dựng trên **SQLAlchemy 2.0** (kiểu `Mapped[...]` / `mapped_column`), với **24 bảng** quan hệ:
  - *Lõi đọc bài:* `users`, `tarot_cards`, `reading_sessions`, `recognized_cards`, `readings`, `conversation_turns`, `rating_reminders`.
  - *Phân tích:* `user_archetype_profiles`, `oracle_reports`, `analytics_events`.
  - *Đọc bài đôi:* `duo_sessions`, `duo_participants`, `duo_cards`, `duo_readings`.
  - *Cộng đồng:* `community_posts`, `community_interpretations`, `community_votes`, `community_moderation_logs`.
  - *Tính năng khác:* `dream_entries` (kèm cột `interpretation_json`), `daily_cards`, `daily_deep_readings`, `time_capsules`, `notification_preferences`, `notifications`.

### 6.2. Toàn vẹn dữ liệu

- **13 CheckConstraint có tên** lo phần ràng buộc enum trạng thái: `status IN (...)`, `orientation IN ('upright','reversed')`, `role IN (...)`, `accuracy_score IS NULL OR (1..5)`, `daily_card_hour 0..23`, v.v.
- **3 UniqueConstraint multi-column** chống trùng: `uq_daily_cards_user_date` (1 lá/user/ngày), `uq_community_votes_interp_user` (1 vote/người/interpretation), `uq_duo_participants_session_slot`.
- **ForeignKey được phân biệt rõ theo mục đích:**
  - Dùng **CASCADE** (xoá cha thì xoá con) cho dữ liệu phụ thuộc như recognized_cards, readings, conversation_turns, votes…
  - Dùng **SET NULL** (giữ con lại khi cha biến mất) để **bảo toàn lịch sử** lúc user hoặc khách bị xoá, áp cho reading_sessions.user_id, community_posts.user_id, dream_entries.user_id, analytics_events.user_id…
- `password_hash` cho phép NULL để hỗ trợ user đăng nhập bằng Google; còn `users.email/username/google_id` đều unique và có index.

### 6.3. Engine & session (`db/session.py`)

- **Engine kép:** `get_engine()` (singleton qua `lru_cache`) tự chuẩn hoá `postgres://` thành `postgresql://`, nên dán thẳng connection string của Neon hay Heroku vào là chạy. Với Postgres thì bật `pool_pre_ping=True` và `pool_recycle=300` để chịu được việc Neon đóng kết nối nhàn rỗi; với SQLite thì bật `check_same_thread=False` và đặt **`PRAGMA foreign_keys=ON`** qua event listener, bởi nếu thiếu thì các ràng buộc CASCADE/SET NULL sẽ bị vô hiệu.
- `session_scope()` hoạt động như một unit-of-work: **commit** nếu không lỗi, **rollback rồi re-raise** khi lỗi, và luôn **close** trong `finally`.

### 6.4. Lưu kết quả an toàn (`db/persistence.py`)

- `persist_reading_result()` lưu trọn `ReadingSession`, `RecognizedCard`, `Reading` và (nếu có user) `RatingReminder` trong **một transaction**.
- **Coerce `user_id` rác về ẩn danh:** nếu `user_id <= 0` hoặc không hợp lệ thì chuyển thành `None` để tránh vỡ khoá ngoại.
- **Xử lý lỗi phân tầng:** lỗi DB nghiêm trọng (`Operational/Integrity/Programming`) được log ở mức **ERROR** kèm ngữ cảnh, còn lỗi khác thì log **WARNING**; nhưng cả hai đều `return None` để phiên đọc vẫn trả về cho người dùng thay vì sập.

### 6.5. Migration

- Việc bootstrap là **idempotent và an toàn với đa luồng/đa worker**: `initialize_database_if_needed` dùng double-checked locking.
- Bài Tarot được seed từ `data/raw/tarot_json/tarot.json` (kỳ vọng 78 lá), idempotent theo tên.
- **Alembic** có 5 revision (initial → daily_card+time_capsule → notifications+analytics → daily_deep_readings → dream interpretation). Bên cạnh đó, một "lightweight migration" trong `init_db.py` tự `ALTER TABLE ADD COLUMN` cho các cột bổ sung (emotion_state, accuracy_score, **dream_entries.interpretation_json**…) và tự tạo lại bảng cache `daily_deep_readings` nếu gặp schema CHECK enum cũ (đổi từ chủ đề cố định sang tự do, an toàn cho cả SQLite lẫn Postgres).

---

## 7. Tác vụ nền (schedulers)

Phần lập lịch dùng **APScheduler** (`BackgroundScheduler`), chạy **in-process** cùng FastAPI và được bật trong `lifespan`. Tất cả các job đều **opt-in qua env** và suy biến an toàn: nếu thiếu APScheduler thì chỉ log cảnh báo chứ không làm sập app.

| Scheduler | Job | Lịch | Env (mặc định) |
|-----------|-----|------|----------------|
| `rating_reminders` | Gửi email nhắc chấm điểm (tối đa 3 lần thử) | mỗi 5 phút | `RATING_REMINDER_SCHEDULER_ENABLED` (bật) |
| `notifications` | Đẩy "lá bài hôm nay" đúng khung giờ user | mỗi 5 phút | `NOTIFICATION_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Archetype | cron **Thứ Hai 02:00** | `ARCHETYPE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Oracle report tháng | cron **ngày 1, 03:00** | `ORACLE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Mở time capsule tới hạn | mỗi 15 phút | `TIME_CAPSULE_SCHEDULER_ENABLED` (bật) |
| `community_automod` | Bot kiểm duyệt | mỗi 5 phút | `COMMUNITY_AUTOMOD_ENABLED` (**TẮT**) |

- Mọi job đều đặt `coalesce=True`, `max_instances=1`, `replace_existing=True` để chống dồn, chống đè và chống chạy chồng.
- **Xử lý timezone cẩn thận:** để thông báo daily card giữ đúng "1 lần/ngày/user", hệ thống quy mốc đầu ngày địa phương về UTC-naive rồi so với `created_at` (SQLite lưu naive UTC).

---

## 8. Kiến trúc Frontend

### 8.1. Stack & build

- Nền tảng là **React 19** + **Vite 7** + **react-router-dom v7**. Toàn bộ viết bằng `.jsx`/`.js`, không chạy TypeScript.
- Các thư viện chính gồm `axios`, bộ animation `framer-motion` + `motion` + `gsap`, `react-markdown` (render kết quả LLM một cách an toàn, không đụng tới `dangerouslySetInnerHTML`), `ogl` + `three` cho hiệu ứng WebGL, `react-hot-toast`, `styled-components`, và `lucide-react`/`react-icons`.
- Trong **vite.config.js**, vendor được **tách thành nhiều chunk** (`vendor-react`, `vendor-motion`, `vendor-misc`) để cache tốt hơn; riêng ở production thì esbuild **drop `console`/`debugger`**.

### 8.2. Routing & guard (`App.jsx`)

- Cả 6 page (`/`, `/login`, `/signin`, `/home`, `/forgot-password`, `/reset-password`) đều được **code-splitting** bằng `React.lazy` + `Suspense`, với fallback là `MysticLoader`.
- **Route guard `RequireAuth`** bọc quanh `/home`: không có token thì chuyển về `<Navigate to="/login">`. Token được đọc nhất quán theo thứ tự `localStorage → sessionStorage` và key `token → access_token`.
- Ở cấp toàn cục có `SplashCursor` (con trỏ WebGL), `Toaster` và `RouteTransition` lo hiệu ứng chuyển trang.

### 8.3. Tầng service (`services/*`)

- Toàn bộ frontend dùng chung **một instance axios tập trung** (`api.js`), trong đó:
  - **Request interceptor** tự gắn `Authorization: Bearer <token>`.
  - **Response interceptor** xử lý lỗi tập trung và **tự logout khi gặp 401** (xoá token ở cả hai storage rồi điều hướng về `/login`), nhưng có loại trừ các endpoint `/api/auth/*` và trang `/login`, `/signin`, để việc nhập sai mật khẩu không làm mất phiên đang dùng.
- **Service chia theo domain:** `authService`, `tarotService` (tự định tuyến giữa ask/ask_with_image/ask_with_media tuỳ input), `dailyService` (có **retry tự viết** cùng cache theo user+ngày), `communityService`, `duoService`, `historyService` (fallback về cache offline), `visionsService` (time capsule + dream), và `speechService` (TTS đọc kết quả).
- `sessionCache.js` cache lịch sử phiên trong localStorage, làm nguồn dữ liệu offline và tự xoá phần cache hỏng.

### 8.4. HomePage — màn hình chính

`HomePage.jsx` (~1455 dòng) gom toàn bộ tính năng vào **một trang động** thay vì chia nhiều route con, và chuyển chế độ qua `selectedCard.mode` gồm `reading` (trải bài), `daily` (lá hằng ngày, khoá lại khi đã rút), `duo`, `community`, `visions`.

- Navbar `CardNav` chia 3 nhóm: "Xem Bài" (lịch sử), "Tarot" (overlay Markdown "Tarot là gì?", "Catarot"), và "Liên hệ".
- Trang này dùng **state thuần React** (`useState`/`useEffect`/`useCallback`, khoảng 25 state local, không đụng tới Redux/Zustand/React Query) và đồng bộ user từ storage cùng `getCurrentUser()`.
- **`pageScale`** lo zoom-to-fit ở desktop (tham chiếu 1500×880), còn mobile để bằng 1 (qua hook `useIsMobile`).
- Hiệu ứng chuyển cảnh `playScene()` đổi nội dung đúng vào lúc màn hình đang bị che (`onCover`).
- **Hiển thị transcript giọng nói:** khi người dùng hỏi bằng giọng nói, bong bóng câu hỏi sẽ hiện `🎙️ <transcript>` (chính là văn bản ASR nhận diện được) thông qua helper `buildUserMessageContent`, để người dùng thấy hệ thống đã "nghe" đúng ý mình.

### 8.5. Thư viện component (theo nhóm)

Trải bài/kết quả (`TarotGallery`, `TarotSpreadGrid`, `TarotResultPanel`, `CircularGallery`), chat (`ChatBox`, `DailyChatBox`, `ChatConversation`, `SpeechBubble`), daily/chiêm nghiệm (`DailyResultPanel`, `ReflectionModal`, `ReflectionHistory`), lịch sử (`ReadingHistory`), cộng đồng (`CommunityReadingPanel`, `CommunityFeed`, `CommunityPostCard`, `CommunityPostComposer`, `CommunityModerationPanel`), duo (`DuoReadingPanel`), visions (`VisionsVaultPanel`, `TimeCapsuleComposer/Card`, `DreamJournalComposer`, `DreamEntryCard`), profile/trợ giúp (`UserProfile`, `ContactPanel`, `MascotHelper`, `MagicCat`), hiệu ứng (`ScrambledText`, `TextType`, `Shuffle`, `ScrollVelocity`, `AnimatedList`, `MarkdownOverlay`, `MysticLoader`), layout/transition (`CardNav`, `ASCIIText`, `RouteTransition`, `CosmicVeil`, `sceneTransition`).

---

## 9. Công nghệ & lý do lựa chọn

### 9.1. Backend

| Công nghệ | Lý do chọn | Phương án thay thế đã cân nhắc |
|-----------|------------|-------------------------------|
| **FastAPI** | Async, tự sinh OpenAPI/Swagger (`/docs`), validation Pydantic gắn liền, type hint thân thiện; route đồng bộ tự chạy trong threadpool — hợp inference blocking. | Flask (thiếu async + validation), Django (nặng, thiên monolith full-stack) |
| **OpenCLIP** | Embedding ảnh mở, không cần train lại; so khớp FAISS nhanh & chính xác cho tập đóng 78 lá. | Train CNN riêng (tốn dữ liệu + thời gian) |
| **FAISS** | Tìm vector xấp xỉ cực nhanh, chạy CPU (`faiss-cpu`), không cần vector DB ngoài. | Pinecone/Weaviate (tốn phí + phụ thuộc mạng) |
| **sentence-transformers** (`all-MiniLM-L6-v2`) | RAG nhẹ, chạy CPU. | Gọi embedding API trả phí (tốn tiền + chậm) |
| **faster-whisper** | ASR chính xác Việt/Anh, nhanh hơn whisper gốc nhờ CTranslate2, chạy CPU (`int8`). | Google Speech API (tốn phí + privacy) |
| **Gemini / Groq (free)** | **Chi phí 0₫**, chất lượng tiếng Việt tốt; Groq cực nhanh, là backup khi Gemini hết quota. | OpenAI GPT-4 (tốn phí) |
| **SQLAlchemy 2.0** | Hỗ trợ cả SQLite (dev) lẫn Postgres (prod) qua **cùng codebase**; kiểu `Mapped` an toàn. | SQL thô (dễ lỗi), Tortoise/Peewee (hệ sinh thái nhỏ hơn) |
| **PBKDF2 (hashlib)** | An toàn, có sẵn trong thư viện chuẩn, **không thêm dependency**; 200k vòng đủ mạnh. | bcrypt/argon2 (thêm dependency build nặng) |
| **PyJWT** | Stateless, không lưu session server-side → scale ngang dễ; hợp SPA. | Session-cookie (phức tạp với SPA cross-origin) |
| **APScheduler** | Lên lịch ngay trong tiến trình app, không cần Celery + broker. | Celery (quá nặng cho nhu cầu này) |

### 9.2. Frontend

| Công nghệ | Lý do chọn |
|-----------|------------|
| **React 19** | Hệ sinh thái lớn, component model hợp UI giàu trạng thái. |
| **Vite 7** | HMR cực nhanh, build tối ưu (tree-shaking, code-split), cấu hình tối giản. |
| **axios** | Interceptor tiện cho gắn token + xử lý lỗi tập trung; gọn hơn `fetch` cho multipart. |
| **framer-motion + gsap** | Hiệu ứng chuyển cảnh mượt, đúng định hướng "huyền bí" của Tarot. |
| **react-markdown** | LLM trả Markdown → render trực tiếp, an toàn. |

---

## 10. Bảo mật

- Không hardcode secret — toàn bộ qua env; `.env` trong `.gitignore`; có `.env.example`.
- Mật khẩu PBKDF2 200k vòng + salt; so sánh hằng thời gian.
- JWT fail-fast ở production; secret yếu → chặn boot.
- Không tin `user_id` client gửi; lấy từ JWT. Chống IDOR ở mọi endpoint thao tác dữ liệu cá nhân (404 thay vì 403 cho session).
- Rate limit cho `/api/auth/*` và `/api/ask*` (429).
- Chống enumeration email khi quên mật khẩu.
- Upload chặt: whitelist đuôi file, giới hạn 25MB, **xoá file tạm trong `finally`**.
- Sanitize dữ liệu cộng đồng (whitelist + cắt độ dài); automod **chống prompt injection** (bọc `<<<DATA>>>`) + chuẩn hoá chống lách từ cấm.
- Che (redact) API key trong mọi log lỗi LLM/automod.
- Frontend: không `dangerouslySetInnerHTML`, loại `console.*` ở production, tự logout khi 401.

---

## 11. Triển khai (Deploy)

Cả hệ thống được thiết kế để chạy miễn phí trên free tier.

### 11.1. Backend → Hugging Face Spaces (Docker SDK)

- `backend/Dockerfile` dựng theo kiểu multi-stage trên Python 3.11-slim, cài **torch/torchvision bản CPU-only** (nhẹ hơn khoảng 3–5GB so với bản CUDA), chạy non-root UID 1000, expose port 8000, và có `HEALTHCHECK` gọi `/api/health`.
- Các secret (`GEMINI_API_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `DATABASE_URL`) đặt trong phần Settings của Space; metadata để trong `SPACE_README.md`.
- **Lý do chọn:** bản free cho **16GB RAM + 2 vCPU**, đủ để load các model Vision/RAG/ASR (~4GB); hỗ trợ Docker gốc; và quan trọng là không cần thẻ tín dụng.
- **Đánh đổi:** build lần đầu mất 10–15 phút vì phải tải model, có cold-start, và SQLite trong container thì không bền vững nên nhóm khuyến nghị trỏ `DATABASE_URL` sang Postgres.

### 11.2. Frontend → Cloudflare Workers (static assets)

- Chạy `npm run build` ra thư mục `dist/`, rồi deploy bằng `wrangler` với `not_found_handling: single-page-application` để mọi route không khớp đều rơi về `index.html` cho React Router xử lý. Các biến `VITE_API_BASE_URL` và `VITE_GOOGLE_CLIENT_ID` được inline lúc build.
- **Lý do chọn:** CDN toàn cầu miễn phí, độ trễ thấp, HTTPS tự động, và SPA-fallback dễ cấu hình. Repo cũng kèm sẵn `vercel.json` và `_redirects` cho phương án khác.

### 11.3. Cơ sở dữ liệu → Neon (PostgreSQL serverless, free)

- Dữ liệu cần sống sót qua các lần rebuild Space, nên kết nối bằng `postgresql+psycopg2://...?sslmode=require`. Code đã lo sẵn việc chuẩn hoá scheme cùng `pool_pre_ping`/`pool_recycle`.

### 11.4. Tự host → Docker Compose

- `docker-compose.yml` dựng cả backend (kèm volume bền vững cho `data`/`models`/`uploads` và healthcheck) lẫn frontend (nginx + SPA fallback). Chỉ một lệnh `docker compose up --build` là chạy được full stack.

### 11.5. Vì sao tách 3 nơi?

Mỗi thành phần có nhu cầu tài nguyên khác hẳn nhau: backend cần nhiều RAM nên đặt ở HF, frontend cần CDN nhanh nên dùng Cloudflare, còn DB cần bền vững nên chọn Neon. Tách ra như vậy giúp nhóm chọn đúng free tier mạnh nhất cho từng phần, scale từng phần độc lập, và khi một nơi gặp sự cố thì thiệt hại cũng được khoanh lại.

---

## 12. Kiểm thử & chất lượng mã

- **Backend (pytest):** **137 hàm test trên 24 file**, trải khắp pipeline (smoke), DB persistence, migration Alembic, auth/security, LLM fallback, conversation context, RAG, vision, TTS (chuẩn hoá văn bản, đóng gói WAV, suy biến mềm, endpoint), rating reminders, các tính năng nâng cao (duo, community, daily-card kèm luận giải sâu, dream journal kèm diễn giải tổng hợp, time capsule), random/media và timezone. Ở bản final toàn bộ đều xanh.
- **Lint backend:** `ruff check src/` báo **sạch (0 lỗi)**.
- **Frontend:** `npm run lint` (ESLint, rule `react-hooks` nghiêm) **sạch**; `npm run build` (Vite production) chạy **thành công**.
- **Rà soát chất lượng (bản final):** nhóm review chéo nhiều vòng theo từng lát cắt là bảo mật, hiệu năng, logic nghiệp vụ và UX; mỗi phát hiện đều được kiểm chứng lại trực tiếp trên code hoặc chạy thử trước khi sửa. Kết quả là từ 32 phát hiện thô, có 12 lỗi xác nhận là thật (3 HIGH, 9 MEDIUM) và đã sửa, còn 1 cảnh báo bị loại sau khi kiểm chứng: nghi vấn "Duo realtime hỏng" hoá ra là **sai**, vì FE vốn cập nhật qua polling.

---

## 13. Hạn chế đã biết & hướng phát triển

Nhóm ghi nhận lại các hạn chế dưới đây để trung thực với thực trạng hệ thống:

- **Rate limit in-memory** chỉ đúng khi chạy 1 process; muốn multi-worker thì cần Redis.
- **SQLite không bền vững trên free tier**, nên ở production vẫn nên dùng Postgres (Neon).
- **Model nặng RAM** (~4GB), nên với host nhỏ thì cần bật `VISION_DEMO_MODE`.
- **ASR `large-v3` nặng trên CPU**, nên với host ít vCPU (HF free chỉ 2 vCPU) thì đặt `ASR_MODEL_FASTER=base`/`small` cho giọng nói phản hồi nhanh, tránh timeout.
- **Duo Reading:** backend đã có WebSocket nhưng frontend hiện vẫn dùng polling REST, chưa nối WS client.
- **Lá người dùng "chọn" ở luồng text không quyết định lá kết quả:** backend rút ngẫu nhiên theo ẩn dụ "vũ trụ chọn cho bạn"; lá hiển thị khớp với lá đưa vào LLM nên vẫn nhất quán. Muốn lá người dùng chọn thực sự ảnh hưởng thì phải đổi contract `QuestionRequest`.
- **`add_followup_turn` cấp `turn_index` không nguyên tử** khi 2 followup cùng phiên chạy song song (hiếm gặp với một người dùng thao tác tuần tự); để khắc phục triệt để cần `UniqueConstraint(session_id, turn_index)` kèm migration.
- **`spread_recommender` chỉ dừng ở mức gợi ý** — backend hiện thực tế chỉ thực thi trải 3 lá.
- **Analytics/retention tính trong bộ nhớ**, hợp với dữ liệu nhỏ, chưa tối ưu cho quy mô lớn.

Về hướng phát triển, nhóm dự tính bổ sung bộ Tarot đầy đủ 78 lá có ảnh, đưa Duo realtime sang WebSocket client thay cho polling, làm giao diện đa ngôn ngữ, hỗ trợ PWA offline, và chuyển rate-limit cùng analytics sang Redis khi cần scale ngang.
