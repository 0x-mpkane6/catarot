# Báo cáo đồ án — Ứng dụng web đọc bài Tarot đa phương thức

> Tài liệu kỹ thuật: kiến trúc, công nghệ và cách triển khai (deploy), kèm **lý do lựa chọn** cho từng quyết định.

---

## 1. Tổng quan dự án

**Tên hệ thống:** Tarot Multimodal Web App
**Mô tả ngắn:** Ứng dụng web cho phép người dùng đặt câu hỏi (bằng **văn bản**, **giọng nói**, hoặc **ảnh chụp lá bài thật**), hệ thống nhận diện lá bài, tra cứu ý nghĩa và sinh **luận giải tiếng Việt** bằng mô hình ngôn ngữ lớn (LLM). Ngoài luồng đọc bài chính, hệ thống còn có một loạt tính năng tăng tương tác: lá bài hàng ngày + chuỗi streak, viên nang thời gian (time capsule), nhật ký giấc mơ, đọc bài đôi (duo), phòng cộng đồng có kiểm duyệt, hồ sơ archetype, báo cáo định kỳ (oracle report)…

**Quy mô mã nguồn:** ~9.200 dòng Python (backend) + ~17.300 dòng JS/JSX (frontend).

### 1.1. Bản đồ tính năng

| Nhóm | Tính năng | Endpoint tiêu biểu |
|------|-----------|--------------------|
| Đọc bài lõi | Hỏi bằng text/ảnh/voice → nhận diện → luận giải | `/api/ask`, `/api/ask_with_image`, `/api/ask_with_media` |
| Hội thoại tiếp nối | Chat hỏi thêm trong cùng phiên đọc | `/api/sessions/{id}/followup`, `/conversation` |
| Lịch sử | Danh sách + chi tiết phiên đọc | `/api/sessions`, `/api/sessions/{id}` |
| Xác thực | Đăng ký, đăng nhập (username/email), quên/đặt lại mật khẩu, **Google OAuth** | `/api/auth/*` |
| Hồ sơ | Xem/cập nhật avatar, bio, display_name, username | `/api/profile/me` |
| Daily Card | Rút 1 lá/ngày, mood pre/post, reflection, **streak** | `/api/daily-card/*` |
| Time Capsule | Khoá dự đoán, mở khi tới hạn, chấm độ chính xác | `/api/time-capsules/*` |
| Dream Journal | Ghi giấc mơ (text/voice) → ánh xạ biểu tượng → Arcana | `/api/dreams` |
| Duo Reading | Đọc bài đôi realtime qua WebSocket + invite code | `/api/duo/*`, `/ws/duo/{id}` |
| Community | Đăng bài (ẩn danh), luận giải, vote, đồng cảm, **kiểm duyệt** | `/api/community/*`, `/api/admin/community/*` |
| Auto-mod bot | Bot tự phê duyệt/escalate bài cộng đồng (opt-in) | `/api/admin/community/automod/*` |
| Gợi ý & phân tích | Gợi ý câu hỏi, gợi ý trải bài, archetype, oracle report, affirmation | `/api/question_suggestions`, `/api/spread/recommend`, … |

---

## 2. Kiến trúc tổng thể

Hệ thống theo kiến trúc **client–server tách rời (decoupled SPA + API)**:

```
┌─────────────────────────────┐         HTTPS / WSS          ┌──────────────────────────────────────┐
│   FRONTEND (SPA)            │  ───────────────────────────▶ │   BACKEND (FastAPI)                    │
│   React 19 + Vite           │   REST JSON + multipart      │                                         │
│   Cloudflare Workers (CDN)  │ ◀───────────────────────────  │   ┌──────────── Pipeline ───────────┐  │
│                             │                               │   │ ASR → Vision → RAG → LLM         │  │
│   - React Router (SPA)      │                               │   └──────────────────────────────────┘  │
│   - axios (JWT interceptor) │                               │   Auth (JWT) · DB (SQLAlchemy) · Sched  │
└─────────────────────────────┘                               └───────────────┬──────────────────────┘
                                                                               │
                                                              ┌────────────────┴───────────────┐
                                                              │  PostgreSQL (Neon)  /  SQLite   │
                                                              └─────────────────────────────────┘
                       LLM bên ngoài: Gemini → OpenAI → Groq → Ollama → fallback tất định
```

**Nguyên tắc kiến trúc chủ đạo:**

1. **Tách rời FE/BE hoàn toàn** — giao tiếp chỉ qua API JSON + JWT, không server-side rendering. Cho phép deploy độc lập, scale riêng, và đổi một bên mà không ảnh hưởng bên kia.
2. **Pipeline có khả năng suy biến (graceful degradation)** — mỗi tầng AI (Vision/RAG/ASR/LLM) đều có chế độ dự phòng để hệ thống **không bao giờ trả lỗi 500 vì thiếu model/API key**, mà luôn cho ra một kết quả "đủ dùng".
3. **Phân tầng rõ ràng ở backend** — `main.py` (HTTP/route) → `advanced/*` & `pipeline/*` (business logic) → `db/*` (truy cập dữ liệu). Route mỏng, logic nằm ở tầng service.
4. **Bảo mật theo mặc định** — JWT fail-fast ở production, không tin `user_id` do client khai, chống IDOR, rate limit, chống enumeration email.

---

## 3. Kiến trúc Backend chi tiết

### 3.1. Tầng HTTP — FastAPI

- **Entry:** `src/main.py` đăng ký toàn bộ ~50 endpoint + 1 WebSocket.
- **Middleware:** `request_id_middleware` gắn `x-request-id` cho mỗi request (truy vết log), `CORSMiddleware` đọc origin từ env, và một **exception handler tổng** biến mọi lỗi không lường trước thành JSON `500 {detail, request_id}` thay vì để stacktrace lộ ra ngoài.
- **Lifespan:** lúc khởi động — khởi tạo DB (+ seed dữ liệu tham chiếu), **kiểm tra fail-fast JWT_SECRET_KEY** (chặn boot nếu production mà secret yếu), bật các scheduler (rating reminder, analytics, automod). Lúc tắt — dừng scheduler gọn gàng.
- **Validation:** dùng **Pydantic** model cho mọi request body → input được validate ngay tại biên (min_length, ge/le, kiểu dữ liệu) trước khi vào logic.

### 3.2. Pipeline đa phương thức — trái tim của hệ thống

`src/pipeline/tarot_pipeline.py` điều phối 4 tầng AI theo trình tự:

```
audio ──▶ [ASR: faster-whisper] ──▶ transcript ──┐
                                                  ├─▶ query (question + transcript)
ảnh  ──▶ [Vision: OpenCLIP + FAISS] ──▶ cards ────┤            │
                                                  │            ▼
                                          [RAG: sentence-transformers + FAISS]
                                                  │     ──▶ rag_snippets (ý nghĩa lá bài)
                                                  ▼            │
                                          [LLM 4-tier] ◀───────┘
                                                  │
                                                  ▼
                                          luận giải Markdown tiếng Việt
```

1. **ASR (Automatic Speech Recognition)** — `faster-whisper` chuyển giọng nói sang text, tự nhận diện Việt/Anh. Có phân tích cảm xúc giọng nói (`emotion_analysis`) để LLM điều chỉnh giọng văn đồng cảm.
2. **Vision** — **OpenCLIP (ViT-B-32)** sinh embedding ảnh, đối chiếu với **FAISS index** các lá bài đã dựng sẵn → trả top-k ứng viên + độ tin cậy. Có ngưỡng `confidence_threshold`: nếu thấp → cảnh báo người dùng chụp lại.
3. **RAG (Retrieval-Augmented Generation)** — **sentence-transformers (all-MiniLM-L6-v2)** + FAISS tra cứu các đoạn ý nghĩa lá bài liên quan đến câu hỏi + lá bài đã nhận diện, làm "tư liệu" để LLM bám vào (giảm bịa đặt).
4. **LLM** — sinh luận giải cuối cùng (xem 3.3).

Hai chế độ rút bài: **nhận diện từ ảnh thật** hoặc **rút ngẫu nhiên** (`random_draw`) khi người dùng không có bài vật lý. Mỗi quẻ chuẩn hoá về kiểu trải **"three"** (Quá khứ / Hiện tại / Tương lai).

### 3.3. Tầng LLM — chuỗi dự phòng 4 tầng (điểm nhấn kỹ thuật)

`src/llm/generate.py` triển khai **fallback chain** để tối đa độ sẵn sàng với chi phí = 0₫:

| Tier | Nhà cung cấp | Vai trò | Ghi chú |
|------|--------------|---------|---------|
| 1 | **Google Gemini** (free) | Ưu tiên cao nhất | **Xoay vòng nhiều API key** khi 1 key dính quota 429 |
| 2 | OpenAI | Tuỳ chọn | Chỉ chạy nếu có `OPENAI_API_KEY` |
| 3 | **Groq** (cloud free) | Backup chính khi Gemini cạn quota | OpenAI-compatible, model Llama-3.3-70B |
| 4 | Ollama (local) | Khi self-host có GPU/CPU mạnh | Qwen2.5-3B |
| ⤓ | **Fallback tất định** | Lưới an toàn cuối | Sinh luận giải theo template + từ điển nghĩa lá bài tiếng Việt, **không cần internet** |

**Vì sao thiết kế như vậy:** đây là đồ án sinh viên, không có ngân sách trả phí API. Chuỗi này đảm bảo: (a) chạy miễn phí nhờ free tier; (b) khi free tier hết quota giữa buổi demo, hệ thống **tự nhảy nhà cung cấp** thay vì sập; (c) kể cả mất hết mạng, vẫn có câu trả lời tiếng Việt mạch lạc nhờ template tất định. Mọi log đều **che (mask/redact) API key** để không rò rỉ bí mật.

### 3.4. Xác thực & phân quyền

`src/auth/`:

- **Mật khẩu:** băm bằng **PBKDF2-HMAC-SHA256, 200.000 vòng**, salt ngẫu nhiên 16 byte; so sánh bằng `hmac.compare_digest` (chống timing attack). Không dùng thư viện nặng — chỉ `hashlib` chuẩn.
- **Token:** **JWT HS256**, hạn 120 phút, payload `{sub, role, iat, exp}`.
- **Fail-fast bảo mật:** ở `APP_ENV=production`, nếu `JWT_SECRET_KEY` trống / nằm trong danh sách yếu / < 32 ký tự → **app từ chối khởi động** (tránh việc mọi endpoint auth âm thầm hỏng lúc runtime).
- **Google OAuth:** xác thực `id_token` qua thư viện `google-auth` với `audience = GOOGLE_CLIENT_ID`; tự liên kết theo `google_id` hoặc email, tạo user mới nếu chưa có.
- **Đặt lại mật khẩu:** token ngẫu nhiên `secrets.token_urlsafe`, có TTL, **chống enumeration** (response giống nhau dù email tồn tại hay không).
- **Phân quyền admin:** qua biến `ADMIN_EMAILS` — tính lại mỗi request nên sống sót qua cả reset DB; đăng ký công khai **luôn** là `member` (client không tự phong admin được).
- **Chống IDOR:** `_ensure_self_or_admin` và `_ensure_session_owner_or_admin` chặn user A truy cập dữ liệu user B; các endpoint nhận `user_id` từ **JWT**, không tin giá trị client gửi trong body/form.

### 3.5. Tầng dữ liệu — SQLAlchemy 2.0

- **ORM:** SQLAlchemy 2.0 (kiểu `Mapped[...]`), 18 bảng quan hệ đầy đủ: users, tarot_cards, reading_sessions, recognized_cards, readings, conversation_turns, rating_reminders, user_archetype_profiles, oracle_reports, duo_*, community_*, dream_entries, daily_cards, time_capsules.
- **Toàn vẹn dữ liệu:** dùng **ForeignKey** với `ondelete` (CASCADE/SET NULL), **CheckConstraint** cho enum trạng thái (vd `status IN (...)`, `orientation IN ('upright','reversed')`), **UniqueConstraint** chống trùng (vd 1 lá/ngày: `uq_daily_cards_user_date`; 1 vote/người: `uq_community_votes_interp_user`).
- **Engine kép:** `get_engine()` tự chuẩn hoá `postgres://` → `postgresql://` (để dán connection string của Neon/Heroku là chạy), bật `pool_pre_ping` + `pool_recycle=300` cho Postgres (tránh lỗi SSL khi Neon đóng kết nối nhàn rỗi), và bật `PRAGMA foreign_keys=ON` cho SQLite.
- **Quản lý phiên:** context manager `session_scope()` tự commit/rollback/close — mọi truy cập DB đi qua đây nên không rò rỉ kết nối.
- **Lưu kết quả an toàn:** `persist_reading_result` coerce `user_id` không hợp lệ (0/khách) về `None` để tránh vỡ khoá ngoại, và **nuốt lỗi mềm** (trả `None`) nếu DB hỏng — phiên đọc vẫn trả về cho người dùng thay vì sập.

### 3.6. Tác vụ nền (schedulers)

Dùng **APScheduler**: nhắc đánh giá (rating reminder), tính archetype profile, sinh oracle report định kỳ, mở time capsule tới hạn, và **bot auto-moderation** cộng đồng. Tất cả đều **opt-in qua env** và suy biến an toàn (nếu thiếu APScheduler chỉ log cảnh báo, không sập app). Bot kiểm duyệt theo triết lý an toàn: **nghi ngờ hoặc LLM lỗi → luôn escalate cho người, không tự duyệt**.

---

## 4. Kiến trúc Frontend

- **Framework:** **React 19** + **Vite 7** (build tool).
- **Routing:** `react-router-dom` v7, SPA 5 route (`/`, `/login`, `/signin`, `/home`, `/forgot-password`). Toàn bộ page **code-split bằng `React.lazy` + `Suspense`** để giảm bundle ban đầu.
- **Gọi API:** một instance `axios` tập trung (`services/api.js`) với **interceptor tự gắn `Authorization: Bearer <token>`** đọc từ localStorage/sessionStorage, và interceptor log lỗi gọn.
- **Tổ chức service theo domain:** `authService`, `tarotService`, `dailyService`, `communityService`, `duoService`, `historyService`, `visionsService` — mỗi service đóng gói endpoint + chuẩn hoá dữ liệu, tách hẳn khỏi component.
- **Tách vendor chunk:** `vite.config.js` chia `vendor-react`, `vendor-motion` (framer-motion/gsap), `vendor-misc` để cache tốt; **loại bỏ `console.*`/`debugger` ở bản production** qua esbuild drop.
- **Trải nghiệm/đồ hoạ:** hiệu ứng con trỏ WebGL (`SplashCursor` dùng OGL), chuyển cảnh (`RouteTransition`/`CosmicVeil`), animation (framer-motion/gsap), markdown render kết quả (`react-markdown`), toast (`react-hot-toast`). Có hook `useIsMobile` để **reflow responsive** trên di động.

---

## 5. Công nghệ & lý do lựa chọn

### 5.1. Backend

| Công nghệ | Lý do chọn | Phương án thay thế đã cân nhắc |
|-----------|------------|-------------------------------|
| **FastAPI** | Async, tự sinh tài liệu OpenAPI/Swagger (`/docs`), validation bằng Pydantic gắn liền, hiệu năng cao, type hint thân thiện. Route đồng bộ tự chạy trong threadpool — phù hợp cho inference blocking (Vision/LLM). | Flask (thiếu async + validation tích hợp), Django (nặng, thiên về full-stack monolith) |
| **OpenCLIP** | Mô hình embedding ảnh mở, không cần huấn luyện lại; so khớp ảnh lá bài bằng FAISS rất nhanh và chính xác cho tập đóng (78 lá). | Train CNN phân loại riêng (tốn dữ liệu + thời gian, kém linh hoạt khi thêm bộ bài) |
| **FAISS** | Tìm kiếm vector xấp xỉ cực nhanh, chạy CPU tốt (`faiss-cpu`), không cần dịch vụ vector DB ngoài. | Pinecone/Weaviate (tốn phí + phụ thuộc mạng) |
| **sentence-transformers** | RAG ý nghĩa lá bài: model `all-MiniLM-L6-v2` nhẹ, đa ngôn ngữ tạm ổn, chạy CPU. | Gọi embedding API trả phí (tốn tiền + chậm vì round-trip) |
| **faster-whisper** | ASR chính xác cho tiếng Việt/Anh, nhanh hơn whisper gốc nhờ CTranslate2, chạy CPU được. | Google Speech API (tốn phí + cần key + privacy) |
| **Gemini / Groq (free)** | **Chi phí 0₫** nhờ free tier; chất lượng tiếng Việt tốt; Groq cực nhanh và là backup khi Gemini hết quota. | OpenAI GPT-4 (tốn phí — không khả thi cho đồ án) |
| **SQLAlchemy 2.0** | ORM mạnh, hỗ trợ cả SQLite (dev) lẫn Postgres (prod) qua **cùng một codebase**; kiểu `Mapped` an toàn. | Truy vấn SQL thô (dễ lỗi, khó bảo trì), Tortoise/Peewee (hệ sinh thái nhỏ hơn) |
| **PBKDF2 (hashlib)** | An toàn, có trong thư viện chuẩn, **không thêm dependency**; 200k vòng đủ mạnh. | bcrypt/argon2 (mạnh hơn nhưng thêm dependency build nặng — không cần thiết cho quy mô này) |
| **JWT (PyJWT)** | Stateless, không cần lưu session server-side → scale ngang dễ; phù hợp SPA. | Session-cookie (cần lưu trữ phía server, phức tạp hơn với SPA cross-origin) |
| **APScheduler** | Lên lịch tác vụ nền ngay trong tiến trình app, không cần Celery + Redis/broker riêng. | Celery (quá nặng cho nhu cầu đơn giản) |

### 5.2. Frontend

| Công nghệ | Lý do chọn |
|-----------|------------|
| **React 19** | Hệ sinh thái lớn nhất, dễ tìm tài liệu/thư viện; component model phù hợp UI giàu trạng thái. |
| **Vite** | Dev server HMR cực nhanh, build tối ưu (tree-shaking, code-split), cấu hình tối giản so với Webpack. |
| **axios** | Interceptor tiện cho việc gắn token + xử lý lỗi tập trung; API gọn hơn `fetch` cho upload multipart. |
| **framer-motion + gsap** | Hiệu ứng chuyển cảnh/animation mượt, đúng định hướng "huyền bí" của sản phẩm Tarot. |
| **react-markdown** | LLM trả luận giải dạng Markdown → render trực tiếp, an toàn (không `dangerouslySetInnerHTML`). |

---

## 6. Cách triển khai (Deploy) & lý do

Hệ thống được thiết kế để chạy **hoàn toàn miễn phí** trên hạ tầng free tier, phù hợp đồ án sinh viên.

### 6.1. Backend → Hugging Face Spaces (Docker SDK)

- **Cách làm:** đóng gói bằng `backend/Dockerfile` (multi-stage, Python 3.11-slim), cài **torch/torchvision bản CPU-only** từ PyTorch index (nhẹ hơn ~3–5GB so với bản CUDA), chạy non-root user UID 1000 (chuẩn HF Spaces), expose port 8000, có `HEALTHCHECK` gọi `/api/health`.
- **Cấu hình:** secret (`GEMINI_API_KEY`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`, `DATABASE_URL`) đặt trong Settings → Variables and secrets của Space; metadata trong `SPACE_README.md` (`sdk: docker`, `app_port: 8000`).
- **Lý do chọn HF Spaces:**
  - **Miễn phí 16GB RAM + 2 vCPU** — đủ để load các model Vision/RAG/ASR vào RAM (vốn cần ~4GB), điều mà các free tier khác (Render 512MB, Railway giới hạn) không kham nổi.
  - **Hỗ trợ Docker gốc** → triển khai y hệt môi trường local, không phải sửa code theo nền tảng.
  - **Không cần thẻ tín dụng** (khác Oracle/AWS) — quan trọng với sinh viên.
- **Đánh đổi đã biết:** build lần đầu 10–15 phút (tải model); free tier có cold-start; SQLite trong container **không bền vững** qua restart → khuyến nghị gắn `DATABASE_URL` trỏ Postgres.

### 6.2. Frontend → Cloudflare Workers (static assets)

- **Cách làm:** `npm run build` ra `dist/`, deploy bằng `wrangler` (`wrangler.jsonc`) với `not_found_handling: single-page-application` (mọi route không khớp → trả `index.html` để React Router xử lý). Biến `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID` được **inline lúc build**.
- **Lý do chọn Cloudflare:** CDN toàn cầu miễn phí, độ trễ thấp, HTTPS tự động, cấu hình SPA-fallback đơn giản. (Dự án cũng kèm sẵn `vercel.json` cho phương án Vercel với security headers + cache control, và `_redirects` cho Netlify — linh hoạt đổi nền tảng.)

### 6.3. Cơ sở dữ liệu → Neon (PostgreSQL serverless, free)

- **Lý do:** dữ liệu người dùng/lịch sử cần **bền vững** qua các lần rebuild Space. Neon free tier cho Postgres serverless, kết nối qua connection string `postgresql+psycopg2://...?sslmode=require`. Code đã chuẩn hoá scheme + bật `pool_pre_ping`/`pool_recycle` để chịu được việc Neon đóng kết nối nhàn rỗi.

### 6.4. Tự host (self-host) → Docker Compose

- `docker-compose.yml` dựng cả backend (có volume bền vững cho `data`/`models`/`uploads`, healthcheck) lẫn frontend (nginx serve static, SPA fallback). Một lệnh `docker compose up --build` là chạy full stack — tiện cho chấm điểm offline.

### 6.5. Vì sao tách 3 nơi (BE / FE / DB) thay vì gộp?

Mỗi thành phần có **đặc tính tài nguyên khác nhau**: backend cần RAM lớn cho model (HF), frontend chỉ là static cần CDN nhanh (Cloudflare), DB cần bền vững + sao lưu (Neon). Tách ra cho phép chọn đúng free tier mạnh nhất cho từng nhu cầu, scale độc lập, và giảm thiệt hại khi một nơi gặp sự cố.

---

## 7. Bảo mật (tổng hợp)

- ✅ Không hardcode secret — toàn bộ qua env; `.env` nằm trong `.gitignore`; có `.env.example` đầy đủ.
- ✅ Mật khẩu băm PBKDF2 200k vòng + salt; so sánh hằng thời gian.
- ✅ JWT fail-fast ở production; secret yếu → chặn boot.
- ✅ Không tin `user_id` client gửi; lấy từ JWT. Chống IDOR ở mọi endpoint thao tác dữ liệu cá nhân.
- ✅ Rate limit cho `/api/auth/*` và `/api/ask*`.
- ✅ Chống enumeration email khi quên mật khẩu.
- ✅ Upload chặt: whitelist đuôi file, giới hạn 25MB, **xoá file tạm sau khi xử lý** (kể cả khi lỗi, qua `finally`).
- ✅ Sanitize dữ liệu cộng đồng (cắt độ dài, lọc khoá lạ) chống nhồi dữ liệu.
- ✅ Frontend: security headers (Vercel), không dùng `dangerouslySetInnerHTML`, loại `console.*` ở production.

---

## 8. Kiểm thử & chất lượng mã

### 8.1. Kiểm thử tự động

- **Backend (pytest):** ~98 test bao phủ pipeline (smoke), DB persistence, migration alembic, auth/security, LLM fallback, conversation context, RAG, vision, rating reminders, các tính năng nâng cao (duo, community, daily, time capsule), random/media, timezone. Kết quả sau khi sửa: **toàn bộ pass (97 passed, 1 skipped)**.
- **Frontend:** `npm run lint` (ESLint, rule `react-hooks` nghiêm ngặt) **sạch**, và `npm run build` (Vite production) **thành công**.
- **Lint backend:** `ruff check src/` **sạch (0 lỗi)**.

### 8.2. Quy trình review (đa tác tử)

Bản final được rà soát bằng một quy trình review nhiều tầng:
1. **Trinh sát + đọc lõi thủ công** toàn bộ pipeline, auth, DB, các module nghiệp vụ và đối chiếu contract FE↔BE.
2. **Fan-out 9 reviewer song song** theo từng lát cắt (auth/bảo mật, pipeline/LLM, nâng cao A/B, DB+main, contract FE↔BE, HomePage, panel tính năng, auth-shell).
3. **Xác minh đối nghịch (adversarial)** từng phát hiện: một tác tử độc lập đọc lại code gốc + file đối tác, mặc định cố **bác bỏ** để loại phát hiện sai.

Kết quả: 32 phát hiện thô → 13 được xác minh → **12 xác nhận thật** (3 HIGH, 9 MEDIUM), 1 bị bác bỏ (cảnh báo "realtime Duo hỏng" là **sai** — FE thực tế cập nhật qua polling 2 giây), 18 ở mức LOW (style/đề xuất).

### 8.3. Các lỗi đã sửa trong bản final

| # | Mức | Mô tả | Cách sửa |
|---|-----|-------|----------|
| Test | — | 4 test gọi `asyncio.run()` trên endpoint đã chuyển sang đồng bộ | Gọi trực tiếp hàm sync; suite xanh trở lại |
| Lint | — | 7 cảnh báo ruff (import/biến thừa) | Dọn sạch, `ruff` 0 lỗi |
| 1 | HIGH | `generate_followup` không xoay vòng nhiều key Gemini + thiếu tier Groq | Lặp qua `gemini_api_keys` + thêm `_generate_groq_messages` vào chuỗi tier |
| 3 | HIGH | Google login (SigninForm) không xoá session cũ → token cũ trong localStorage được ưu tiên | Dọn cả 2 storage trước khi ghi phiên mới |
| 4 | MED | Lệch chiều vector vision (build 512 vs demo 864) bị nuốt âm thầm | Thêm guard kiểm tra `query.dim == index.d`, nêu lỗi rõ ràng |
| 5 | MED | `vote_interpretation`: vote song song cùng user → HTTP 500 | Bắt `IntegrityError` (idempotent) + đếm lại số vote thật từ bảng |
| 7 | MED | `persist_reading_result` nuốt MỌI lỗi DB ở mức WARNING | Tách lỗi vận hành (Operational/Integrity/Programming) → log ERROR kèm ngữ cảnh |
| 8/11 | MED | `ReflectionModal` giữ state cũ khi đổi lá (modal không unmount) | Thêm prop `key` theo định danh lá → React remount, reset state |
| 9 | MED | Optimistic "đồng cảm" ép các luận giải khác về false, lệch backend | Chỉ cập nhật đúng luận giải được bấm, giữ nguyên phần còn lại |
| 10 | MED | `ReadingHistory` thiếu `catch` → lỗi load lịch sử bị nuốt | Thêm `catch` + `toast.error` + đưa danh sách về rỗng |
| 12 | MED | Không có route guard `/home` (vào thẳng URL khi chưa đăng nhập) | Thêm `RequireAuth` + tự đăng xuất khi gặp 401 (token hết hạn) |

### 8.4. Ghi chú thiết kế (cân nhắc — chưa đổi trong bản final)

Hai điểm được nêu nhưng **cố ý giữ nguyên** vì là quyết định thiết kế / có rủi ro khi đổi sát hạn nộp:

- **Lá người dùng "chọn" ở lưới úp mặt không quyết định lá kết quả** (luồng text). Backend rút ngẫu nhiên 3 lá (`random_draw=true`) — đây là ẩn dụ **"xáo bài, vũ trụ chọn cho bạn"** hợp lệ của Tarot; quan trọng là lá hiển thị cho người dùng **khớp** với lá đưa vào LLM nên không có mâu thuẫn nhìn thấy được. Nếu muốn lá chọn thực sự ảnh hưởng kết quả, cần đổi contract `QuestionRequest` (thêm `selected_cards`) + ánh xạ vị trí lưới → danh tính lá — là thay đổi nghiệp vụ lõi, nên để sau khi cân nhắc kỹ.
- **`add_followup_turn` cấp `turn_index` không nguyên tử** khi 2 followup cùng phiên chạy song song (hiếm với 1 người dùng tuần tự). Khắc phục triệt để cần thêm `UniqueConstraint(session_id, turn_index)` + migration — rủi ro với dữ liệu cũ, để lại như **hạn chế đã biết**.

---

## 9. Hạn chế đã biết & hướng phát triển

- **Rate limit in-memory** — chỉ đúng khi chạy 1 process; multi-worker cần backend Redis.
- **SQLite không bền vững trên free tier** — production nên dùng Postgres (Neon) hoặc gắn persistent storage.
- **Model nặng RAM** (~4GB) — host nhỏ cần bật `VISION_DEMO_MODE`.
- **Bundle có `three`/`ogl`** (~545KB) cho hiệu ứng WebGL — có thể cắt nếu cần nhẹ hơn.
- **Hướng phát triển:** thêm bộ bài Tarot khác (78 lá đầy đủ), realtime duo qua WebSocket thay polling, đa ngôn ngữ giao diện, PWA offline.
