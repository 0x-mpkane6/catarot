# Bố cục mã nguồn — Tarot Multimodal Web App

> Bản đồ code để đọc nhanh: thư mục nào làm gì, file nào chịu trách nhiệm gì, một request đi qua đâu. Dùng khi review/chấm code.

## Tổng quan repo (monorepo)

```
llm-tarot-reader/
├── backend/        # API + AI (FastAPI, Python) — phần xử lý
├── frontend/       # Giao diện (React + Vite) — phần hiển thị
├── alembic/        # Migration cơ sở dữ liệu (5 revision)
├── docs/           # Báo cáo, sơ đồ, hướng dẫn, bố cục (file này)
└── docker-compose.yml   # Chạy full-stack 1 lệnh
```

Backend **phân 3 tầng**: `main.py` (HTTP/route) → `advanced/*` + `pipeline/*` (nghiệp vụ) → `db/*` (dữ liệu).

---

## BACKEND — `backend/src/`

### Tầng HTTP (điểm vào)
| File | Vai trò |
|------|---------|
| `main.py` | **Điểm vào FastAPI** — đăng ký ~60 route REST + 1 WebSocket, middleware (request-id, CORS, exception handler tổng), lifespan (khởi tạo DB + bật scheduler), Pydantic validate request. **Route mỏng, gọi xuống tầng service.** |

### `pipeline/` — Trái tim đa phương thức
| File | Vai trò |
|------|---------|
| `tarot_pipeline.py` | **Bộ điều phối** đọc bài: ASR → cảm xúc → Vision/rút ngẫu nhiên → RAG → LLM. Gom cảnh báo thay vì ném lỗi. |

### Các adapter AI
| File | Vai trò |
|------|---------|
| `asr/transcribe.py` | **ASR** — giọng nói → chữ (faster-whisper, fallback transformers; song ngữ Việt/Anh). |
| `vision/embedder.py` | Sinh embedding ảnh bằng **OpenCLIP** (có demo mode khi thiếu model). |
| `vision/index.py` | Tìm lá gần nhất bằng **FAISS** (cosine similarity). |
| `vision/predict_card.py` | **Nhận diện lá bài** từ ảnh: embed gốc + ảnh xoay 180° (nhận lá ngược), tính độ tin cậy. |
| `vision/preprocess.py` | Tiền xử lý ảnh (load, xoay). |
| `rag/retrieve.py` | **RAG** — tra ý nghĩa lá bài liên quan (sentence-transformers + FAISS), lọc theo lá/chiều. |
| `rag/build_index.py` | Dựng index RAG + lớp embedder text (có demo fallback). |
| `llm/generate.py` | **Sinh luận giải** — chuỗi dự phòng Gemini → OpenAI → Groq → Ollama → template tất định; che API key trong log. |
| `llm/card_meanings_vi.py` | Từ điển nghĩa lá bài tiếng Việt (cho fallback tất định). |
| `advanced/emotion_analysis.py` | Phân tích **cảm xúc giọng nói** bằng tín hiệu số (không dùng model ML). |

### `auth/` — Xác thực & phân quyền
| File | Vai trò |
|------|---------|
| `auth/security.py` | Băm mật khẩu **PBKDF2 200k vòng**, ký/giải **JWT HS256**. |
| `auth/service.py` | Đăng ký/đăng nhập/đặt lại mật khẩu, **Google OAuth**, chống enumeration. |
| `auth/deps.py` | Dependency lấy user hiện tại từ JWT; guard chống **IDOR** (`_ensure_self_or_admin`…). |

### `db/` — Tầng dữ liệu (SQLAlchemy 2.0)
| File | Vai trò |
|------|---------|
| `db/models.py` | **24 bảng** ORM + ràng buộc (CheckConstraint, UniqueConstraint, FK CASCADE/SET NULL). |
| `db/session.py` | Engine kép (SQLite/Postgres), `session_scope()` tự commit/rollback/close. |
| `db/persistence.py` | Lưu kết quả 1 phiên đọc (session + cards + reading) trong 1 transaction, nuốt lỗi mềm. |
| `db/init_db.py` | Khởi tạo DB lúc startup (create_all + **lightweight migration** ALTER ADD COLUMN). |
| `db/seed.py` | Seed 78 lá bài tham chiếu (idempotent). |

### `advanced/` — Các tính năng nghiệp vụ
| File | Vai trò |
|------|---------|
| `daily_card.py` | Lá bài 1/ngày + streak (chống trùng bằng unique constraint). |
| `daily_deep_reading.py` | **Luận giải sâu** theo **chủ đề tự do** (RAG + LLM), cache theo (user, ngày, chủ đề). |
| `affirmations.py` | Câu khẳng định tất định (hash SHA-1, không tốn LLM). |
| `dream_journal.py` | **Nhật ký giấc mơ** — trích biểu tượng → lá bài → **diễn giải tổng hợp** + liên hệ phiên đọc + câu hỏi phản tư. |
| `conversation.py` | Hội thoại tiếp nối (giữ 8 lượt gần nhất, tóm tắt lượt cũ). |
| `community_room.py` | Phòng cộng đồng: đăng ẩn danh, vote, kiểm duyệt (chống N+1, chống race vote). |
| `community_automod.py` | **Bot kiểm duyệt** 2 lớp (luật + Gemini), chống prompt injection, nghi ngờ → escalate. |
| `duo_reading.py` | Đọc bài đôi realtime (WebSocket + invite code). |
| `time_capsule.py` | Viên nang thời gian (niêm phong dự đoán, mở khi tới hạn). |
| `archetype_profiler.py` | Hồ sơ nguyên mẫu (Soul Card…) từ lịch sử — không LLM. |
| `oracle_reports.py` | Báo cáo Oracle hằng tháng (LLM + fallback, gửi email). |
| `rating_reminders.py` | Nhắc chấm điểm buổi đọc qua email + scheduler. |
| `notifications.py` | Thông báo in-app/email + job đẩy lá bài hằng ngày. |
| `analytics.py` | Ghi sự kiện + funnel + retention D1/D7. |
| `analytics_scheduler.py` | Gom job định kỳ (archetype tuần / oracle tháng / mở capsule). |
| `question_suggestions.py` | Gợi ý câu hỏi (theo pha trăng, thứ — rule-based). |
| `spread_recommender.py` | Gợi ý kiểu trải bài (rule-based). |
| `share_image.py` | Sinh ảnh PNG chia sẻ lá bài hằng ngày. |

### `utils/` — Tiện ích dùng chung
| File | Vai trò |
|------|---------|
| `config.py` | Đọc cấu hình + resolve đường dẫn. |
| `logging.py` | Logger chuẩn hoá. |
| `rate_limit.py` | Giới hạn tần suất (sliding window in-memory). |
| `validators.py` | Validate email. |
| `timezone.py` | Múi giờ ứng dụng (mặc định Asia/Ho_Chi_Minh). |
| `io.py` | Hàm I/O phụ trợ. |

---

## FRONTEND — `frontend/src/`

| Thư mục / file | Vai trò |
|----------------|---------|
| `main.jsx` · `App.jsx` | Entry + **routing** (React Router v7, lazy-load), route guard `RequireAuth`. |
| `pages/` | 5 trang: `LandingPage`, `LoginPage`, `SigninPage`, `ForgotPasswordPage`, **`HomePage`** (màn chính, gộp mọi tính năng). |
| `services/` | Gọi API theo domain: `api.js` (axios + interceptor JWT), `authService`, `tarotService`, `dailyService`, `communityService`, `duoService`, `historyService`, `visionsService`, `sessionCache`. |
| `features/login/` | Form đăng nhập/đăng ký/quên mật khẩu + `GoogleLoginButton`. |
| `components/ui/` | Component giao diện: `ChatBox`, `ChatConversation`, `TarotSpreadGrid`, `TarotResultPanel`, `DailyResultPanel`, `DeepReadingPanel`, `DreamJournalComposer`, `DreamEntryCard`, `VisionsVaultPanel`, `CommunityReadingPanel`, `DuoReadingPanel`, … |
| `components/transition/` · `layout/` · `common/` | Hiệu ứng chuyển cảnh, navbar, con trỏ WebGL. |
| `hooks/` · `lib/` | `useIsMobile`, ảnh lá bài. |

---

## Luồng một request "đọc bài" (đầu → cuối)

```
[Frontend] ChatBox → tarotService.askTarotWithMedia (FormData: question + audio/ảnh)
      │  POST /api/ask_with_media (JWT)
      ▼
[main.py] validate (Pydantic/Form) → lấy user_id từ JWT → gọi pipeline
      ▼
[tarot_pipeline.run_pipeline]
      ASR(transcribe) → emotion → Vision(predict_card) | random → RAG(retrieve) → LLM(generate)
      ▼
[persistence.persist_reading_result] lưu reading_sessions + recognized_cards + readings
      ▼
trả JSON {cards, transcript, final_answer, warnings, session_id} → Frontend render Markdown
```

---

## "Thầy hỏi X → mở file nào"

| Câu hỏi | File |
|---------|------|
| Nhận diện lá bài bằng gì? | `vision/predict_card.py`, `vision/embedder.py`, `vision/index.py` |
| LLM sinh luận giải / fallback? | `llm/generate.py` |
| RAG hoạt động ra sao? | `rag/retrieve.py` |
| Giọng nói → chữ? | `asr/transcribe.py` |
| Bot kiểm duyệt cộng đồng? | `advanced/community_automod.py` |
| Diễn giải giấc mơ? | `advanced/dream_journal.py` |
| Bảo mật mật khẩu / JWT? | `auth/security.py`, `auth/service.py`, `auth/deps.py` |
| Cấu trúc DB / bảng? | `db/models.py` |
| Route / API? | `main.py` |
| Pipeline tổng thể? | `pipeline/tarot_pipeline.py` |
| Test? | `backend/tests/` (124 hàm test / 23 file) |
```
