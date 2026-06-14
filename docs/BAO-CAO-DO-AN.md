# Báo cáo đồ án — Ứng dụng web đọc bài Tarot đa phương thức (bản chi tiết)

> Tài liệu kỹ thuật đầy đủ: **kiến trúc**, **công nghệ** và **chức năng**, kèm *lý do lựa chọn* cho từng quyết định. Mọi mô tả trong tài liệu này được đối chiếu trực tiếp với mã nguồn.

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

**Mô tả:** Ứng dụng web cho phép người dùng đặt câu hỏi bằng **văn bản**, **giọng nói**, hoặc **ảnh chụp lá bài thật**; hệ thống nhận diện lá bài, tra cứu ý nghĩa và sinh **luận giải tiếng Việt** bằng mô hình ngôn ngữ lớn (LLM), kèm tuỳ chọn **nghe luận giải bằng giọng đọc tiếng Việt** (TTS). Ngoài luồng đọc bài lõi, hệ thống còn có một hệ sinh thái tính năng tăng tương tác và giữ chân người dùng: lá bài hằng ngày + streak, viên nang thời gian, nhật ký giấc mơ, đọc bài đôi thời gian thực, phòng cộng đồng có kiểm duyệt (kèm bot tự động), hồ sơ nguyên mẫu (archetype), báo cáo Oracle định kỳ, thông báo và phân tích hành vi.

**Triết lý sản phẩm:** chạy **hoàn toàn miễn phí** trên hạ tầng free tier (phù hợp đồ án sinh viên), và **không bao giờ trả lỗi 500 vì thiếu model/API key** — mỗi tầng AI đều có cơ chế suy biến an toàn (graceful degradation).

**Quy mô:** ~11.600 dòng Python (`backend/src`) + ~20.900 dòng JS/JSX/CSS (`frontend/src`); **hơn 60 endpoint REST + 1 WebSocket**; cơ sở dữ liệu **24 bảng** quan hệ; bộ kiểm thử **137 hàm test trên 24 file**.

---

## 2. Kiến trúc tổng thể

Hệ thống theo kiến trúc **client–server tách rời (decoupled SPA + API)**, triển khai trên **3 hạ tầng độc lập**:

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

**Bốn nguyên tắc kiến trúc chủ đạo:**

1. **Tách rời FE/BE hoàn toàn** — giao tiếp chỉ qua API JSON + JWT, không server-side rendering. Cho phép deploy độc lập, scale riêng, đổi một bên không ảnh hưởng bên kia.
2. **Phân tầng rõ ràng ở backend** — `main.py` (HTTP/route, mỏng) → `advanced/*` & `pipeline/*` (business logic) → `db/*` (truy cập dữ liệu). Route chỉ nhận request, validate, rồi uỷ thác xuống tầng service.
3. **Suy biến duyên dáng (graceful degradation)** — mỗi tầng AI (ASR/Vision/RAG/LLM) và mỗi điểm phụ thuộc bên ngoài đều có phương án dự phòng nhiều lớp.
4. **Bảo mật theo mặc định** — JWT fail-fast ở production, không tin `user_id` do client khai, chống IDOR, rate limit, chống enumeration email, che (redact) API key trong log.

---

## 3. Danh mục chức năng chi tiết

Đây là phần mô tả **giá trị nghiệp vụ + cách hoạt động** của từng nhóm chức năng, kèm endpoint tiêu biểu.

### 3.1. Đọc bài lõi (Reading)

- **Đa phương thức:** `POST /api/ask` (JSON text), `POST /api/ask_with_image` (multipart, tối đa 3 ảnh), `POST /api/ask_with_media` (ảnh + audio). Tất cả chạy qua pipeline 4 tầng AI (mục 5).
- **Hai chế độ rút bài:** nhận diện từ ảnh thật, hoặc **rút ngẫu nhiên** (`random_draw`) khi người dùng không có bài vật lý. Mọi quẻ chuẩn hoá về kiểu trải **"three"** (Quá khứ / Hiện tại / Tương lai).
- **Hỏi bằng giọng nói (voice-only):** `question` là **tuỳ chọn** (`Form("")`) ở `ask_with_media`/`ask_with_image` — khi chỉ ghi âm không gõ chữ, câu hỏi nằm trong audio; transcript ASR được ghép vào truy vấn và **hiển thị lại trên giao diện** (bong bóng `🎙️ …`).
- **`user_id` lấy từ JWT, không tin body** — chống giả mạo, tránh ghi đè lịch sử của user khác.
- **Nghe luận giải (TTS):** `POST /api/tts` đọc văn bản luận giải thành **giọng nói tiếng Việt** (`facebook/mms-tts-vie` — VITS, chạy qua `transformers` sẵn có, không thêm dependency), trả `audio/wav`. Văn bản quá 1.200 ký tự được cắt bớt, kèm cảnh báo qua header `X-TTS-Warnings` (percent-encoded vì header HTTP chỉ nhận latin-1). Tổng hợp **on-demand**, không chen vào pipeline đọc bài; TTS tắt/lỗi → 503 kèm thông điệp, phần chữ vẫn dùng bình thường.
- **Chấm điểm:** `POST /api/readings/{session_id}/rating` (1–5 sao).

### 3.2. Hội thoại tiếp nối (Follow-up conversation)

- `POST /api/sessions/{id}/followup` — hỏi sâu thêm trong cùng phiên đọc; `GET /api/sessions/{id}/conversation` — lấy lịch sử chat.
- **Quản lý cửa sổ ngữ cảnh:** giữ nguyên tối đa **8 lượt gần nhất** (`MAX_RECENT_TURNS = 8`); các lượt cũ hơn được **tóm tắt tất định** (nối nội dung cắt gọn, không tốn LLM). LLM nhận: ngữ cảnh phiên gốc (câu hỏi, lá bài, cảm xúc, đáp án cũ) + tóm tắt + 8 lượt gần nhất + câu hỏi mới.
- Mỗi follow-up tạo 2 lượt (`user` rồi `assistant`), `turn_index` lấy `MAX(turn_index)+1`.

### 3.3. Lịch sử (History)

- `GET /api/sessions` (phân trang newest-first), `GET /api/sessions/{id}` (chi tiết: lá + đáp án cuối).
- Frontend có **cache offline** (`sessionCache.js`): nếu API lỗi, vẫn hiển thị danh sách phiên từ localStorage.

### 3.4. Xác thực (Auth)

- `POST /api/auth/register` (luôn tạo role `member`), `/login` (đăng nhập bằng username hoặc email), `/forgot-password`, `/reset-password`, **`/google`** (OAuth), `GET /api/auth/me`.
- Chi tiết kỹ thuật ở mục 4.3.

### 3.5. Hồ sơ (Profile)

- `GET /api/profile/me`, `PATCH|POST /api/profile/me` — cập nhật `avatar_url`, `bio`, `display_name`, `username` (trùng username → 409).

### 3.6. Daily Card + Streak (gamification)

- `GET /api/daily-card` (một-chạm: get-or-create lá hôm nay + streak), `POST /api/daily-card/draw`, `POST /api/daily-card/{id}/reflect` (mood + chiêm nghiệm), `GET /api/daily-card/streak`, `GET /api/daily-card/history`, `GET /api/daily-card/{date}/image` (ảnh PNG chia sẻ).
- **Cách hoạt động:** mỗi user rút đúng **1 lá/ngày** theo lịch địa phương. Lá được chọn **ngẫu nhiên** (`random.choice` trên toàn bộ `TarotCard` + chiều ngẫu nhiên) — *không* phải hàm tất định theo user+date.
- **Streak:** đếm số ngày liên tiếp (mỗi ngày cách nhau đúng 1 ngày, tính từ hôm nay/hôm qua); cũng tính `longest_streak` bằng cách quét toàn lịch sử.
- **Idempotent + chống race:** dựa vào `UniqueConstraint(user_id, draw_date)`; nếu 2 request cùng ngày chạy song song, request thua bắt `IntegrityError`, rollback và đọc lại bản ghi đã có.
- **Affirmation tất định:** kèm theo lá là một câu khẳng định sinh **tất định** (hash SHA-1 của `lá|chiều|ngày` → chọn template) — cùng lá, cùng chiều, cùng ngày luôn cho cùng một câu, không tốn LLM.
- **Luận giải sâu theo chủ đề (RAG + LLM):** `POST /api/daily-card/deep-reading` — người dùng **gõ chủ đề tự do** (vd "chuyện chuyển việc", "sức khoẻ tinh thần"); LLM (qua chuỗi fallback) sinh 4 mục cố định (Tổng quan / Lời khuyên / Một việc nên làm / Một điều nên tránh), có **bản dự phòng tất định** khi mất mạng. Chủ đề tự do được `_detect_theme()` suy ra nhóm cho phần dự phòng. **Cache theo `(user, ngày, chủ đề)`** trong bảng `daily_deep_readings` (unique constraint) → bấm lại cùng chủ đề trong ngày không gọi lại LLM.

### 3.7. Time Capsule (viên nang thời gian)

- `POST /api/time-capsules`, `GET /api/time-capsules`, `GET /api/time-capsules/{id}`, `POST .../reveal`, `POST .../verdict`.
- **Cách hoạt động:** người dùng "niêm phong" một lời tiên đoán kèm ngày mở (`reveal_at`, ràng buộc tối thiểu 6 giờ, tối đa 3 năm). Vòng đời: `sealed` → `revealed` → `verified`. Khi chưa tới hạn, nội dung bị giấu (chỉ trả metadata + lời niêm phong).
- **Chấm độ chính xác do chính người dùng nhập (1–5 sao)** — không có thuật toán tự động.
- Có thể tạo capsule từ một phiên đọc cũ (hydrate lá/câu hỏi từ `ReadingSession`, có lọc `user_id` chống IDOR).

### 3.8. Dream Journal (nhật ký giấc mơ)

- `POST /api/dreams` (text và/hoặc audio), `GET /api/dreams`, `GET /api/dreams/{id}`.
- **Cách hoạt động:** nhận giấc mơ → (nếu có audio) chuyển giọng thành text → **trích biểu tượng** (2 tầng: ưu tiên LLM trả mảng JSON 3–7 biểu tượng kèm lá bài + câu ý nghĩa; nếu rỗng dùng luật khớp chuỗi con từ `dream_symbol_map.json`) → **ánh xạ sang lá Tarot (arcana)** → **đối chiếu chéo** với các phiên đọc bài của user trong 7 ngày gần nhất.
- **Diễn giải tổng hợp (nâng cấp mới):** ngoài biểu tượng + lá bài, LLM (qua chuỗi fallback) sinh thêm `summary_interpretation` ("giấc mơ nói gì về mình"), `main_theme`, `emotional_tone`, `recent_reading_connections` (liên hệ phiên đọc 7 ngày — **lọc bỏ session_id LLM bịa**), `reflection_questions` (2–3 câu phản tư) và `suggested_action` (một việc nhỏ nên làm). Có **bản dự phòng tất định** khi LLM lỗi; lưu ở cột `interpretation_json` (nullable → giấc mơ cũ vẫn an toàn, frontend tự ẩn các mục mới).

### 3.9. Duo Reading (đọc bài đôi thời gian thực)

- `POST /api/duo/sessions`, `.../join`, `.../join_by_invite`, `.../card` (nộp ảnh lá), `GET .../{id}`, và **WebSocket `WS /ws/duo/{id}`**.
- **Cách hoạt động:** 2 người vào chung phòng (mời qua `invite_code` 8 ký tự sinh bằng `secrets`), mỗi người nộp 1 lá; khi đủ 2 lá hệ thống gộp thành **một luận giải tương hợp**. Vòng đời phòng: `waiting_partner` → `waiting_cards` → `generating` → `completed`.
- **Realtime:** backend có `DuoWsManager` quản lý kết nối WebSocket theo phòng, broadcast trạng thái (`duo_created`, `snapshot`, heartbeat `ping/pong`). *Lưu ý trung thực:* frontend hiện cập nhật trạng thái bằng cách gọi lại `getDuoSession` (polling REST), chưa nối WebSocket client — đây là điểm có thể nâng cấp.
- **Tối ưu khoá DB:** lệnh gọi LLM (~120s) được tách **ra ngoài** transaction để không giữ write-lock suốt thời gian sinh nội dung.

### 3.10. Community (cộng đồng có kiểm duyệt)

- User: `POST /api/community/posts`, `GET /api/community/feed`, `POST .../interpretations`, `.../vote`, `.../resonate`.
- Admin: `GET /api/admin/community/moderation_queue`, `.../approve`, `.../reject`.
- **Cách hoạt động:** đăng câu hỏi/quẻ bài dưới **bí danh ẩn danh** (`Seeker-{id:04d}`, suy ra từ ID nên không lộ user thật); người khác **luận giải hộ**, **vote**, chủ bài đánh dấu **đồng cảm (resonate)**. Bài phải `approved` mới hiển thị công khai (`pending` → `approved`/`rejected`).
- **Điểm kỹ thuật:** feed chống **N+1** (gom tất cả interpretation trong 1 query `IN (...)`); vote **chống race + tự chữa lệch đếm** (bắt `IntegrityError`, rồi `COUNT()` lại số vote thật từ bảng thay vì tin cột counter); sanitize whitelist trường lá bài (chống nhồi dữ liệu).

### 3.11. Auto-moderation bot (opt-in, ưu tiên an toàn)

- `POST /api/admin/community/automod/run` (có `dry_run`), `GET .../automod/preview`.
- **Cách hoạt động:** bot quét bài `pending`, phân loại **approve / reject / escalate** theo kiến trúc **2 lớp**: (1) tiền lọc bằng luật (độ dài, từ cấm hard-block, URL/PII/quảng cáo, có chuẩn hoá chống lách bộ lọc kiểu `đ.ị.t`); (2) phân loại bằng Gemini với JSON schema, `temperature=0`, **chống prompt injection** (bọc dữ liệu trong khối `<<<DATA>>>`).
- **Triết lý an toàn:** mặc định **TẮT** (opt-in qua `COMMUNITY_AUTOMOD_ENABLED`); **mọi trường hợp nghi ngờ / LLM lỗi → escalate cho người, không bao giờ tự approve**; chỉ tự `reject` khi bật thêm `COMMUNITY_AUTOMOD_AUTOREJECT`. Không ghi đè quyết định của admin thật (idempotent khi bài đã rời `pending`).

### 3.12. Gợi ý & phân tích người dùng

- **Gợi ý câu hỏi** `GET /api/question_suggestions` — **rule-based, không LLM**: dựa trên **pha trăng** (tính bằng toán thiên văn từ chu kỳ 29,53 ngày), **thứ trong tuần**, và lá bài gần nhất; mỗi gợi ý kèm `reason` minh bạch.
- **Gợi ý trải bài** `POST /api/spread/recommend` — **rule-based**: phân loại chủ đề + độ khẩn từ từ khoá → đề xuất kiểu trải; có cờ `can_run_with_current_backend` (thực tế backend hiện chỉ chạy trải 3 lá).
- **Hồ sơ archetype** `GET /api/users/{id}/archetype_profile` — tổng hợp lịch sử (≥5 phiên): lá hay gặp nhất = Soul Card, top từ khoá từ câu hỏi, cảm xúc thường gặp; **không dùng LLM**.
- **Oracle report** `GET /api/users/{id}/oracle_reports[/latest]` — thư tổng kết tháng (LLM viết, có fallback tất định), gửi email.
- **Affirmations** `GET /api/affirmations/{card_name}` — không cần auth, tất định.
- **Notifications** `GET /api/notifications`, `.../read`, `GET|PUT /api/notification-preferences`.
- **Analytics (admin)** `GET /api/admin/analytics/funnel` — đếm sự kiện + retention D1/D7.

---

## 4. Kiến trúc Backend

### 4.1. Tầng HTTP — FastAPI (`src/main.py`)

- **Entry:** đăng ký toàn bộ **~60 endpoint REST + 1 WebSocket** (`/ws/duo/{id}`).
- **Middleware:**
  - `request_id_middleware` — gắn `x-request-id` (lấy từ header hoặc sinh `uuid4`) cho mỗi request, echo lại trên response → truy vết log.
  - `CORSMiddleware` — origin đọc từ env `API_ALLOWED_ORIGINS`.
  - **Exception handler tổng** — biến mọi lỗi không lường trước thành JSON `500 {detail, request_id}`, **không lộ stack trace** ra client.
- **Lifespan (startup):** khởi tạo DB (+ seed bài Tarot), **fail-fast JWT_SECRET_KEY** (chặn boot nếu production mà secret yếu/thiếu), bật các scheduler (rating, analytics, automod opt-in, notification opt-in). **Shutdown:** dừng scheduler theo thứ tự ngược.
- **Validation:** dùng **Pydantic** cho mọi request body — `password` min 6, `username` 3–64, `score` 1–5, `daily_card_hour` 0–23, phân trang ràng buộc `Query(ge=…, le=…)`, v.v.
- **Upload chặt:** whitelist đuôi file (ảnh/âm thanh), giới hạn **25MB**, tên file ngẫu nhiên `uuid4`, đọc theo chunk 1MB, **xoá file tạm trong `finally`** kể cả khi lỗi.

### 4.2. Pipeline (tóm tắt — chi tiết ở mục 5)

`src/pipeline/tarot_pipeline.py` là **bộ điều phối** gọi 5 module con theo trình tự: ASR → Emotion → Vision/Random → RAG → LLM. Bản thân nó không chứa AI; nó gom cảnh báo (`warnings`) thay vì ném lỗi, đảm bảo một tầng hỏng không kéo sập phiên đọc.

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

- **Rate limiter:** in-memory **sliding window** (`deque` mốc `time.monotonic()`), có `threading.Lock`; key = `"{scope}:{ip}"` (IP ưu tiên `x-forwarded-for`). Vượt ngưỡng → **HTTP 429**. Bật/tắt qua `RATE_LIMIT_ENABLED`.
  - Áp cho: `auth/*` (register 5/60s, login 10/60s, forgot/reset 5/60s, google 10/60s) và nhóm `ask*` (mặc định 20/60s, override qua env).
  - *Trung thực:* các endpoint khác (sessions, daily, community, duo…) **không** gắn rate limit. In-memory chỉ đúng khi chạy 1 process; multi-worker cần Redis.
- **Validators:** kiểm `email` (regex + độ dài ≤254) và `normalize_email`. Phần còn lại validate ở tầng Pydantic.

---

## 5. Pipeline AI đa phương thức (đào sâu)

`src/pipeline/tarot_pipeline.py`, hàm `run_pipeline()` điều phối theo đúng 7 bước:

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

- Chuẩn hoá định dạng về WAV mono 16kHz bằng `ffmpeg` (thiếu ffmpeg → cảnh báo nhẹ, bỏ qua).
- **Hai backend xếp ưu tiên:** `faster-whisper` (model `large-v3`, `device=cpu`, `compute_type=int8`, cache load 1 lần qua `lru_cache`) → dự phòng `transformers whisper-small` → cuối cùng trả `None` (pipeline chạy tiếp không transcript).
- **Chế độ song ngữ `auto_vi_en`:** chạy nhận diện **cả tiếng Việt lẫn Anh**, mỗi bản kèm `avg_logprob`, rồi **chọn bản có điểm tin cậy cao hơn** — xử lý tốt người Việt nói chêm tiếng Anh.

### 5.2. Tầng ② Vision — Nhận diện lá bài (`vision/`)

- **Embedding:** **OpenCLIP ViT-B-32** (pretrained `laion2b_s34b_b79k`), CPU, rồi **L2-normalize**. Có **demo mode** (histogram màu + ảnh xám + gradient, 864 chiều) khi máy không cài nổi OpenCLIP.
- **So khớp:** `faiss.IndexFlatIP` (Inner Product). Vì vector đã L2-norm nên **inner product = cosine similarity** → tìm lá có góc vector gần nhất.
- **Mẹo 1 — nhận biết lá NGƯỢC:** embed cả ảnh gốc **và ảnh xoay 180°**; ứng viên từ bản xoay được **đảo orientation** (upright↔reversed). Nếu bản xoay khớp tốt hơn nghĩa là lá đang đặt ngược — không cần ảnh huấn luyện riêng cho lá ngược.
- **Mẹo 2 — độ tin cậy:** `confidence = (margin + 0.2) / 0.8` với `margin = score_top1 − score_top2`. Tức confidence dựa trên **độ tách biệt** giữa ứng viên nhất và nhì, không phải điểm tuyệt đối. Dưới ngưỡng `confidence_threshold = 0.18` → cảnh báo chụp lại / chọn từ top-5.
- Không có FAISS index → trả kết quả dự phòng (danh sách lá mặc định) thay vì sập. `index.py` có guard kiểm tra chiều vector (tránh assertion mơ hồ của FAISS khi index 512 chiều vs demo 864 chiều).

### 5.3. Tầng phụ — Phân tích cảm xúc giọng nói (`advanced/emotion_analysis.py`)

- **Không dùng model ML** — chỉ phân tích tín hiệu số: `pause_ratio` (tỉ lệ khoảng lặng), `energy_mean/std` (năng lượng), `zero_crossing_rate` (độ gấp gáp). Phân về 5 nhãn `sad / anxious / excited / uncertain / calm` bằng luật ngưỡng. Nhãn này được chèn vào prompt LLM để điều chỉnh tông giọng đồng cảm.

### 5.4. Tầng ③ RAG — Truy hồi ý nghĩa lá bài (`rag/retrieve.py`)

- **Embedding text:** `sentence-transformers/all-MiniLM-L6-v2` (nhẹ, CPU) + FAISS.
- Ghép truy vấn `"<câu hỏi> card=<tên lá> orientation=<chiều>"`, search, **lọc theo metadata** để snippet đúng lá đang xét. Nhiều lớp dự phòng (cùng lá khác chiều → placeholder) đảm bảo **luôn đủ tối thiểu 3 snippet** cho LLM → giảm bịa (hallucination).

### 5.5. Tầng ④ LLM — Sinh luận giải, chuỗi dự phòng 4 tầng (`llm/generate.py`)

| Tier | Nhà cung cấp | Vai trò | Ghi chú |
|------|--------------|---------|---------|
| 1 | **Google Gemini** (`gemini-2.5-flash`, free) | Ưu tiên cao nhất | **Xoay vòng nhiều API key** khi 1 key dính 429 |
| 2 | OpenAI (`gpt-4o-mini`) | Tuỳ chọn | Chỉ chạy nếu có `OPENAI_API_KEY` |
| 3 | **Groq** (`llama-3.3-70b-versatile`, free) | Backup chính | OpenAI-compatible, rất nhanh |
| 4 | Ollama (`qwen2.5:3b-instruct`, local) | Khi self-host | — |
| ⤓ | **Fallback tất định** | Lưới an toàn cuối | Sinh luận giải từ template + từ điển nghĩa lá bài tiếng Việt, **không cần internet** |

**Chi tiết kỹ thuật đáng chú ý:**

- **Prompt engineering có chủ đích:** lọc bỏ các cảnh báo nhạy cảm ("ngẫu nhiên", "chụp lại"…) khỏi prompt để LLM không lỡ tiết lộ bài là ngẫu nhiên hay nhắc chụp lại thừa; truyền cờ rõ ràng "có/không thêm mục `### Lưu ý`".
- **Bảo mật log:** mọi thông báo lỗi HTTP đều **thay API key bằng `<redacted>`**.
- **`maxOutputTokens = 0`** nghĩa là không đặt trần → bài luận giải không bị cắt giữa câu.
- `last_used_model` ghi lại model thực sự đã trả lời (trả về frontend, minh bạch + dễ debug).
- **Fallback tất định** dùng `_detect_theme()` (khớp từ khoá **không dấu**, hỗ trợ Việt + Anh) để chọn chủ đề (tình cảm/sự nghiệp/tài chính/sức khoẻ/học tập) rồi ghép nghĩa lá + lời khuyên 7 ngày.

### 5.6. Sợi chỉ đỏ: Graceful Degradation ở mọi tầng

| Tầng | Lý tưởng | Dự phòng | Lưới an toàn cuối |
|------|----------|----------|-------------------|
| ASR | faster-whisper | transformers whisper | chạy không transcript |
| Vision | OpenCLIP + FAISS | demo embedder | danh sách lá mặc định |
| RAG | FAISS đúng lá | cùng lá khác chiều | placeholder snippet |
| LLM | Gemini (nhiều key) | OpenAI → Groq → Ollama | **template tất định offline** |
| TTS | mms-tts-vie (VITS) | tắt qua `TTS_ENABLED` | 503 kèm thông điệp, web vẫn đọc chữ |

→ Hệ thống **không bao giờ trả lỗi 500 chỉ vì thiếu model hay hết quota**.

---

## 6. Tầng dữ liệu

### 6.1. ORM & danh mục bảng

- **SQLAlchemy 2.0** (kiểu `Mapped[...]` / `mapped_column`), **24 bảng** quan hệ:
  - *Lõi đọc bài:* `users`, `tarot_cards`, `reading_sessions`, `recognized_cards`, `readings`, `conversation_turns`, `rating_reminders`.
  - *Phân tích:* `user_archetype_profiles`, `oracle_reports`, `analytics_events`.
  - *Đọc bài đôi:* `duo_sessions`, `duo_participants`, `duo_cards`, `duo_readings`.
  - *Cộng đồng:* `community_posts`, `community_interpretations`, `community_votes`, `community_moderation_logs`.
  - *Tính năng khác:* `dream_entries` (kèm cột `interpretation_json`), `daily_cards`, `daily_deep_readings`, `time_capsules`, `notification_preferences`, `notifications`.

### 6.2. Toàn vẹn dữ liệu

- **13 CheckConstraint có tên** — ràng buộc enum trạng thái: `status IN (...)`, `orientation IN ('upright','reversed')`, `role IN (...)`, `accuracy_score IS NULL OR (1..5)`, `daily_card_hour 0..23`, v.v.
- **3 UniqueConstraint multi-column** — chống trùng: `uq_daily_cards_user_date` (1 lá/user/ngày), `uq_community_votes_interp_user` (1 vote/người/interpretation), `uq_duo_participants_session_slot`.
- **ForeignKey phân biệt rõ:**
  - **CASCADE** (xoá cha → xoá con) cho dữ liệu phụ thuộc (recognized_cards, readings, conversation_turns, votes…).
  - **SET NULL** (giữ con khi cha biến mất) để **bảo toàn lịch sử** khi user/khách bị xoá (reading_sessions.user_id, community_posts.user_id, dream_entries.user_id, analytics_events.user_id…).
- `password_hash` cho phép NULL (hỗ trợ user đăng nhập bằng Google); `users.email/username/google_id` unique + index.

### 6.3. Engine & session (`db/session.py`)

- **Engine kép:** `get_engine()` (singleton `lru_cache`) tự **chuẩn hoá `postgres://` → `postgresql://`** (dán connection string Neon/Heroku là chạy); với Postgres bật `pool_pre_ping=True` + `pool_recycle=300` (chịu được Neon đóng kết nối nhàn rỗi); với SQLite bật `check_same_thread=False` và **`PRAGMA foreign_keys=ON`** qua event listener (nếu không, ràng buộc CASCADE/SET NULL bị vô hiệu).
- `session_scope()` — unit-of-work: tự **commit** nếu không lỗi, **rollback + re-raise** khi lỗi, luôn **close** ở `finally`.

### 6.4. Lưu kết quả an toàn (`db/persistence.py`)

- `persist_reading_result()` lưu trọn `ReadingSession` + `RecognizedCard` + `Reading` + (nếu có user) `RatingReminder` trong **một transaction**.
- **Coerce `user_id` rác về ẩn danh:** `user_id <= 0` hoặc không hợp lệ → `None` (tránh vỡ khoá ngoại).
- **Xử lý lỗi phân tầng:** lỗi DB nghiêm trọng (`Operational/Integrity/Programming`) → log **ERROR** kèm ngữ cảnh; lỗi khác → log **WARNING**; cả hai đều `return None` để phiên đọc vẫn trả về người dùng thay vì sập.

### 6.5. Migration

- Bootstrap **idempotent, an toàn đa luồng/đa worker** (`initialize_database_if_needed` dùng double-checked locking).
- Seed bài Tarot từ `data/raw/tarot_json/tarot.json` (kỳ vọng 78 lá), idempotent theo tên.
- **Alembic** có 5 revision (initial → daily_card+time_capsule → notifications+analytics → daily_deep_readings → dream interpretation); ngoài ra "lightweight migration" trong `init_db.py` tự `ALTER TABLE ADD COLUMN` cho cột bổ sung (emotion_state, accuracy_score, **dream_entries.interpretation_json**…) và tự **tạo lại bảng cache `daily_deep_readings`** nếu gặp schema CHECK enum cũ (chuyển chủ đề cố định → tự do, an toàn cho cả SQLite lẫn Postgres).

---

## 7. Tác vụ nền (schedulers)

Dùng **APScheduler** (`BackgroundScheduler`, chạy **in-process** cùng FastAPI, bật trong `lifespan`). Tất cả **opt-in qua env** và **suy biến an toàn** (thiếu APScheduler chỉ log cảnh báo, không sập app):

| Scheduler | Job | Lịch | Env (mặc định) |
|-----------|-----|------|----------------|
| `rating_reminders` | Gửi email nhắc chấm điểm (tối đa 3 lần thử) | mỗi 5 phút | `RATING_REMINDER_SCHEDULER_ENABLED` (bật) |
| `notifications` | Đẩy "lá bài hôm nay" đúng khung giờ user | mỗi 5 phút | `NOTIFICATION_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Archetype | cron **Thứ Hai 02:00** | `ARCHETYPE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Oracle report tháng | cron **ngày 1, 03:00** | `ORACLE_SCHEDULER_ENABLED` (bật) |
| `analytics_scheduler` | Mở time capsule tới hạn | mỗi 15 phút | `TIME_CAPSULE_SCHEDULER_ENABLED` (bật) |
| `community_automod` | Bot kiểm duyệt | mỗi 5 phút | `COMMUNITY_AUTOMOD_ENABLED` (**TẮT**) |

- Mọi job dùng `coalesce=True`, `max_instances=1`, `replace_existing=True` (chống dồn/đè/chạy chồng).
- **Xử lý timezone cẩn thận:** thông báo daily card idempotent "1 lần/ngày/user" bằng cách quy mốc đầu ngày địa phương về UTC-naive để so với `created_at` (SQLite lưu naive UTC).

---

## 8. Kiến trúc Frontend

### 8.1. Stack & build

- **React 19** + **Vite 7** + **react-router-dom v7**. Toàn bộ là `.jsx`/`.js` (không TypeScript thực thi).
- Thư viện chính: `axios`, `framer-motion` + `gsap` (animation), `react-markdown` (render kết quả LLM, an toàn — không `dangerouslySetInnerHTML`), `ogl` + `three` (hiệu ứng WebGL), `react-hot-toast`, `styled-components`, `lucide-react`/`react-icons`.
- **vite.config.js:** **tách vendor chunk** (`vendor-react`, `vendor-motion`, `vendor-misc`) để cache tốt; **drop `console`/`debugger` chỉ ở production** qua esbuild.

### 8.2. Routing & guard (`App.jsx`)

- **Code-splitting** bằng `React.lazy` + `Suspense` cho cả 5 page (`/`, `/login`, `/signin`, `/home`, `/forgot-password`); fallback là `MysticLoader`.
- **Route guard `RequireAuth`** bọc `/home`: không có token → `<Navigate to="/login">`. Token đọc nhất quán từ `localStorage → sessionStorage`, key `token → access_token`.
- Toàn cục: `SplashCursor` (con trỏ WebGL), `Toaster`, `RouteTransition` (hiệu ứng chuyển trang).

### 8.3. Tầng service (`services/*`)

- **Một instance axios tập trung** (`api.js`) với:
  - **Request interceptor** tự gắn `Authorization: Bearer <token>`.
  - **Response interceptor** xử lý lỗi tập trung + **tự logout khi 401** (xoá token cả 2 storage rồi điều hướng `/login`), nhưng **loại trừ** endpoint `/api/auth/*` và trang `/login`,`/signin` (để đăng nhập sai mật khẩu không xoá phiên).
- **Service theo domain:** `authService`, `tarotService` (tự định tuyến ask/ask_with_image/ask_with_media theo input), `dailyService` (có **retry tự viết** + cache theo user+ngày), `communityService`, `duoService`, `historyService` (fallback cache offline), `visionsService` (time capsule + dream).
- `sessionCache.js`: cache lịch sử phiên trong localStorage (nguồn dữ liệu offline, tự xoá cache hỏng).

### 8.4. HomePage — màn hình chính

`HomePage.jsx` (~1455 dòng) gộp toàn bộ tính năng vào **một trang động** (không nhiều route con), chuyển chế độ qua `selectedCard.mode`: `reading` (trải bài), `daily` (lá hằng ngày, khoá khi đã rút), `duo`, `community`, `visions`.

- Navbar `CardNav` 3 nhóm: "Xem Bài" (lịch sử), "Tarot" (overlay Markdown "Tarot là gì?", "Catarot"), "Liên hệ".
- **State thuần React** (`useState`/`useEffect`/`useCallback`, ~25 state local — không dùng Redux/Zustand/React Query); đồng bộ user từ storage + `getCurrentUser()`.
- **`pageScale`** zoom-to-fit desktop (tham chiếu 1500×880), mobile = 1 (hook `useIsMobile`).
- Hiệu ứng chuyển cảnh `playScene()` đổi nội dung đúng lúc màn hình bị che (`onCover`).
- **Hiển thị transcript giọng nói:** khi hỏi bằng giọng nói, bong bóng câu hỏi hiển thị `🎙️ <transcript>` (văn bản ASR nhận diện được) qua helper `buildUserMessageContent` — giúp người dùng thấy hệ thống "nghe" đúng.

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

- ✅ Không hardcode secret — toàn bộ qua env; `.env` trong `.gitignore`; có `.env.example`.
- ✅ Mật khẩu PBKDF2 200k vòng + salt; so sánh hằng thời gian.
- ✅ JWT fail-fast ở production; secret yếu → chặn boot.
- ✅ Không tin `user_id` client gửi; lấy từ JWT. Chống IDOR ở mọi endpoint thao tác dữ liệu cá nhân (404 thay vì 403 cho session).
- ✅ Rate limit cho `/api/auth/*` và `/api/ask*` (429).
- ✅ Chống enumeration email khi quên mật khẩu.
- ✅ Upload chặt: whitelist đuôi file, giới hạn 25MB, **xoá file tạm trong `finally`**.
- ✅ Sanitize dữ liệu cộng đồng (whitelist + cắt độ dài); automod **chống prompt injection** (bọc `<<<DATA>>>`) + chuẩn hoá chống lách từ cấm.
- ✅ Che (redact) API key trong mọi log lỗi LLM/automod.
- ✅ Frontend: không `dangerouslySetInnerHTML`, loại `console.*` ở production, tự logout khi 401.

---

## 11. Triển khai (Deploy)

Hệ thống được thiết kế chạy **hoàn toàn miễn phí** trên free tier.

### 11.1. Backend → Hugging Face Spaces (Docker SDK)

- `backend/Dockerfile` multi-stage (Python 3.11-slim), cài **torch/torchvision bản CPU-only** (nhẹ hơn ~3–5GB so với CUDA), chạy non-root UID 1000, expose port 8000, có `HEALTHCHECK` gọi `/api/health`.
- Secret (`GEMINI_API_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `DATABASE_URL`) đặt trong Settings của Space; metadata trong `SPACE_README.md`.
- **Lý do:** Free **16GB RAM + 2 vCPU** đủ load model Vision/RAG/ASR (~4GB); hỗ trợ Docker gốc; **không cần thẻ tín dụng**.
- **Đánh đổi:** build lần đầu 10–15 phút (tải model); có cold-start; SQLite trong container không bền vững → khuyến nghị `DATABASE_URL` trỏ Postgres.

### 11.2. Frontend → Cloudflare Workers (static assets)

- `npm run build` → `dist/`, deploy bằng `wrangler` với `not_found_handling: single-page-application` (mọi route không khớp → `index.html` cho React Router). Biến `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` inline lúc build.
- **Lý do:** CDN toàn cầu miễn phí, độ trễ thấp, HTTPS tự động, SPA-fallback đơn giản. (Kèm sẵn `vercel.json` + `_redirects` cho phương án khác.)

### 11.3. Cơ sở dữ liệu → Neon (PostgreSQL serverless, free)

- Dữ liệu cần bền vững qua các lần rebuild Space; kết nối `postgresql+psycopg2://...?sslmode=require`. Code đã chuẩn hoá scheme + `pool_pre_ping`/`pool_recycle`.

### 11.4. Tự host → Docker Compose

- `docker-compose.yml` dựng cả backend (volume bền vững `data`/`models`/`uploads`, healthcheck) lẫn frontend (nginx + SPA fallback). Một lệnh `docker compose up --build` là chạy full stack.

### 11.5. Vì sao tách 3 nơi?

Mỗi thành phần có đặc tính tài nguyên khác nhau: backend cần RAM lớn (HF), frontend cần CDN nhanh (Cloudflare), DB cần bền vững (Neon). Tách ra để chọn đúng free tier mạnh nhất cho từng nhu cầu, scale độc lập, giảm thiệt hại khi một nơi gặp sự cố.

---

## 12. Kiểm thử & chất lượng mã

- **Backend (pytest):** **137 hàm test trên 24 file**, bao phủ pipeline (smoke), DB persistence, migration Alembic, auth/security, LLM fallback, conversation context, RAG, vision, TTS (chuẩn hoá văn bản, đóng gói WAV, suy biến mềm, endpoint), rating reminders, các tính năng nâng cao (duo, community, daily-card + luận giải sâu, dream journal + diễn giải tổng hợp, time capsule), random/media, timezone. Bản final: toàn bộ xanh.
- **Lint backend:** `ruff check src/` **sạch (0 lỗi)**.
- **Frontend:** `npm run lint` (ESLint, rule `react-hooks` nghiêm) **sạch**; `npm run build` (Vite production) **thành công**.
- **Rà soát chất lượng (bản final):** review chéo nhiều vòng theo từng lát cắt (bảo mật, hiệu năng, logic nghiệp vụ, UX); mỗi phát hiện đều được kiểm chứng lại trực tiếp trên code/chạy thử trước khi sửa. Kết quả: 32 phát hiện thô → 12 lỗi xác nhận thật (3 HIGH, 9 MEDIUM) đã sửa, 1 cảnh báo bị loại sau kiểm chứng (nghi vấn "Duo realtime hỏng" là **sai** — FE cập nhật qua polling).

---

## 13. Hạn chế đã biết & hướng phát triển

**Hạn chế (cố ý ghi nhận để trung thực):**

- **Rate limit in-memory** — chỉ đúng khi 1 process; multi-worker cần Redis.
- **SQLite không bền vững trên free tier** — production nên dùng Postgres (Neon).
- **Model nặng RAM** (~4GB) — host nhỏ cần bật `VISION_DEMO_MODE`.
- **ASR `large-v3` nặng trên CPU** — host ít vCPU (HF free 2 vCPU) nên đặt `ASR_MODEL_FASTER=base`/`small` để giọng nói phản hồi nhanh, tránh timeout.
- **Duo Reading:** backend đã có WebSocket nhưng **frontend hiện dùng polling REST** — chưa nối WS client.
- **Lá người dùng "chọn" ở luồng text không quyết định lá kết quả** — backend rút ngẫu nhiên (ẩn dụ "vũ trụ chọn cho bạn"); lá hiển thị khớp lá đưa vào LLM nên nhất quán. Muốn lá chọn thực sự ảnh hưởng cần đổi contract `QuestionRequest`.
- **`add_followup_turn` cấp `turn_index` không nguyên tử** khi 2 followup cùng phiên chạy song song (hiếm với 1 người dùng tuần tự); khắc phục triệt để cần `UniqueConstraint(session_id, turn_index)` + migration.
- **`spread_recommender` chỉ gợi ý** — backend hiện thực tế chỉ thực thi trải 3 lá.
- **Analytics/retention tính trong bộ nhớ** — hợp dữ liệu nhỏ, chưa tối ưu cho quy mô lớn.

**Hướng phát triển:**

- Bộ Tarot đầy đủ 78 lá có ảnh; realtime Duo qua WebSocket client thay polling; đa ngôn ngữ giao diện; PWA offline; chuyển rate-limit/analytics sang Redis khi scale ngang.

---

*Tài liệu này mô tả hệ thống ở trạng thái bản final, đối chiếu trực tiếp với mã nguồn backend (`backend/src/**`) và frontend (`frontend/src/**`).*
