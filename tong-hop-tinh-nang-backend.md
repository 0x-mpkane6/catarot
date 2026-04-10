# Tổng Hợp Tính Năng Backend

Ngày cập nhật: 2026-04-10  
Nguồn đối chiếu chính: `src/main.py`, `src/advanced/*`, `src/db/models.py`, `src/pipeline/tarot_pipeline.py`

## 1) Tổng quan backend hiện có

Backend đang chạy trên FastAPI, hỗ trợ cả luồng đọc bài Tarot cơ bản và bộ tính năng nâng cao (f1 -> f10). Hệ thống có cơ chế fallback cho ASR, Vision, LLM; có lưu DB; có scheduler cho nhắc đánh giá và phân tích định kỳ.

## 2) Checklist tính năng theo nhóm

### 2.1 Auth

- Đăng ký tài khoản (`register`)
- Đăng nhập nhận JWT (`login`)
- Lấy thông tin người dùng hiện tại (`me`)
- Phân quyền `member/admin`
- Guard truy cập dữ liệu theo owner hoặc admin

Module chính: `src/auth/service.py`, `src/auth/deps.py`, `src/auth/security.py`

### 2.2 Core Reading

- Đọc bài qua JSON (`/api/ask`)
- Đọc bài qua upload media (`/api/ask_with_media`)
- Đọc bài qua upload ảnh (`/api/ask_with_image`)
- Hỗ trợ `random_draw`
- Trả `cards`, `transcript`, `warnings`, `final_answer`, `session_id` (khi lưu DB thành công)

Module chính: `src/main.py`, `src/pipeline/tarot_pipeline.py`

### 2.3 AI Pipeline

- ASR từ audio (ưu tiên faster-whisper, fallback transformers)
- Phân tích cảm xúc giọng nói (`emotion_state`, `emotion_signal`)
- Nhận diện lá bài từ ảnh (Vision + top-k candidates)
- RAG lấy snippets theo câu hỏi/lá bài
- Sinh diễn giải bằng LLM (OpenAI -> Ollama -> deterministic fallback)
- Cảnh báo khi generation chậm (`SLOW_GENERATION_WARNING_SECONDS`)

Module chính: `src/asr/transcribe.py`, `src/advanced/emotion_analysis.py`, `src/vision/*`, `src/rag/retrieve.py`, `src/llm/generate.py`, `src/pipeline/tarot_pipeline.py`

### 2.4 Advanced Features (f1 -> f10)

- f1 Conversational follow-up theo session
- f2 Archetype profiler theo lịch sử đọc bài
- f3 Voice emotion analysis
- f4 Oracle report theo chu kỳ tháng
- f5 Gợi ý câu hỏi tiếp theo
- f6 Gợi ý kiểu trải bài (spread recommender)
- f7 Duo reading (REST + WebSocket realtime)
- f8 Community reading room + moderation
- f9 Accuracy rating loop + reminder
- f10 Dream journal integration

Module chính: `src/advanced/*.py`

### 2.5 Scheduler

- Scheduler nhắc đánh giá chạy chu kỳ 5 phút
- Scheduler analytics (weekly archetype, monthly oracle)
- Bật/tắt qua biến môi trường
- Áp dụng timezone app (`APP_TIMEZONE`)

Module chính: `src/advanced/rating_reminders.py`, `src/advanced/analytics_scheduler.py`

### 2.6 DB & Persistence

- ORM models đầy đủ cho core + advanced domains
- Auto init DB khi startup
- Seed dữ liệu `tarot_cards`
- Lưu reading session, recognized cards, generated reading
- Có migration baseline bằng Alembic
- Giữ tương thích ngược bằng lightweight migration ở startup

Module chính: `src/db/models.py`, `src/db/persistence.py`, `src/db/init_db.py`, `alembic/versions/20260410_000001_initial_advanced.py`

## 3) API map theo nhóm endpoint

### 3.1 System

- `GET /` -> Health check

### 3.2 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### 3.3 Reading core

- `POST /api/ask`
- `POST /api/ask_with_media`
- `POST /api/ask_with_image`

### 3.4 Conversation & Suggestions & Spread

- `POST /api/sessions/{session_id}/followup`
- `GET /api/sessions/{session_id}/conversation`
- `GET /api/question_suggestions`
- `POST /api/spread/recommend`

### 3.5 Rating & User analytics outputs

- `POST /api/readings/{session_id}/rating`
- `GET /api/users/{user_id}/pending_ratings`
- `GET /api/users/{user_id}/archetype_profile`
- `GET /api/users/{user_id}/oracle_reports`
- `GET /api/users/{user_id}/oracle_reports/latest`

### 3.6 Duo reading

- `POST /api/duo/sessions`
- `POST /api/duo/sessions/{duo_session_id}/join`
- `POST /api/duo/sessions/join_by_invite`
- `POST /api/duo/sessions/{duo_session_id}/card`
- `GET /api/duo/sessions/{duo_session_id}`
- `WS /ws/duo/{duo_session_id}`

### 3.7 Community room

- `POST /api/community/posts`
- `GET /api/community/feed`
- `POST /api/community/posts/{post_id}/interpretations`
- `POST /api/community/interpretations/{interpretation_id}/vote`
- `POST /api/community/interpretations/{interpretation_id}/resonate`
- `GET /api/admin/community/moderation_queue`
- `POST /api/admin/community/posts/{post_id}/approve`
- `POST /api/admin/community/posts/{post_id}/reject`

### 3.8 Dream journal

- `POST /api/dreams`
- `GET /api/dreams`
- `GET /api/dreams/{dream_id}`

## 4) Ghi chú trạng thái hiện tại

- Trạng thái tổng thể backend: **đang có đầy đủ các nhóm tính năng chính theo scope hiện tại**.
- API cũ vẫn hoạt động để giữ tương thích frontend.
- Mặc định DB là SQLite (`data/app.db`), phù hợp local/staging nhỏ.
- Scheduler đang chạy in-process cùng API; phù hợp MVP, chưa tối ưu scale lớn.
