# Tổng Hợp Tính Năng Backend

Ngày cập nhật: 2026-04-29  
Nguồn đối chiếu chính: `src/main.py`, `src/advanced/*`, `src/db/models.py`, `src/pipeline/tarot_pipeline.py`

## 1) Tổng quan backend hiện có

Backend chạy trên FastAPI, phục vụ:
- Luồng đọc bài Tarot đa phương thức (text + voice + image)
- Bộ tính năng nâng cao f1 → f10
- Bộ tính năng độc đáo v0.2 (Daily Card + Streak, Time Capsule, Affirmation)
- Hardening: rate limit, request id, health check, email validator, structured exception handling

## 2) Checklist tính năng theo nhóm

### 2.1 Auth & Security

- Đăng ký, đăng nhập JWT, lấy thông tin user.
- Phân quyền `member` / `admin`, guard truy cập theo owner.
- Rate limit cho `register` (5/min) và `login` (10/min) qua IP.
- Email validator regex (thay vì chỉ check `@`).
- Cảnh báo startup nếu `JWT_SECRET_KEY` vẫn là placeholder.
- Global exception handler: response 500 dạng JSON + request_id để debug.
- Module: `src/auth/*`, `src/utils/rate_limit.py`, `src/utils/validators.py`

### 2.2 Core Reading

- `POST /api/ask` (JSON), `POST /api/ask_with_media` (multipart, ưu tiên), `POST /api/ask_with_image`.
- Hỗ trợ `random_draw`. Trả `cards`, `transcript`, `warnings`, `final_answer`, `session_id`.
- Module: `src/main.py`, `src/pipeline/tarot_pipeline.py`

### 2.3 AI Pipeline

- ASR ưu tiên faster-whisper, fallback transformers.
- Phân tích cảm xúc giọng nói (`emotion_state`, `emotion_signal`).
- Vision card recognition + top-k candidates.
- RAG snippets theo câu hỏi/lá bài.
- LLM generation: OpenAI → Ollama → deterministic fallback.
- Cảnh báo khi generation chậm (`SLOW_GENERATION_WARNING_SECONDS`).

### 2.4 Advanced Features (f1 → f10)

- f1 Conversational follow-up theo session.
- f2 Archetype profiler theo lịch sử đọc bài.
- f3 Voice emotion analysis.
- f4 Oracle report theo chu kỳ tháng.
- f5 Gợi ý câu hỏi tiếp theo.
- f6 Gợi ý kiểu trải bài (spread recommender).
- f7 Duo reading (REST + WebSocket realtime).
- f8 Community reading room + moderation.
- f9 Accuracy rating loop + reminder qua email.
- f10 Dream journal integration.

Module: `src/advanced/*.py`

### 2.5 Unique Features v0.2 (Daily Engagement)

- **Daily Card + Streak**: 1 lá/user/ngày, đếm streak, reflection note + mood. Module `src/advanced/daily_card.py`.
- **Time Capsule Reading**: khoá dự đoán, mở vào ngày tương lai, verify accuracy. Module `src/advanced/time_capsule.py`.
- **Card Affirmation**: deterministic affirmation per (card, orientation, date), không gọi LLM, dùng cho widget. Module `src/advanced/affirmations.py`.

### 2.6 Scheduler

- Rating reminder scheduler (5 phút/lần).
- Weekly archetype (Mon 02:00).
- Monthly oracle (day 1, 03:00).
- Time capsule auto-reveal (15 phút/lần) — `mark_due_capsules_notified`.
- Bật/tắt qua biến môi trường, áp dụng `APP_TIMEZONE`.

### 2.7 DB & Persistence

- ORM models đầy đủ cho core + advanced + unique features.
- Auto init DB khi startup, seed `tarot_cards`.
- Lưu reading session, recognized cards, generated reading.
- Migration baseline Alembic + revision mới `20260428_000002` cho `daily_cards` + `time_capsules`.
- Lightweight migration ở startup giữ tương thích ngược.

## 3) API map theo nhóm endpoint

### 3.1 System

- `GET /` - status string
- `GET /api/health` - version + DB connectivity

### 3.2 Auth

- `POST /api/auth/register` (rate limited)
- `POST /api/auth/login` (rate limited)
- `GET  /api/auth/me`

### 3.3 Reading core

- `POST /api/ask`
- `POST /api/ask_with_media`
- `POST /api/ask_with_image`

### 3.4 Conversation, Suggestions, Spread

- `POST /api/sessions/{session_id}/followup`
- `GET  /api/sessions/{session_id}/conversation`
- `GET  /api/question_suggestions`
- `POST /api/spread/recommend`

### 3.5 Rating & User analytics

- `POST /api/readings/{session_id}/rating`
- `GET  /api/users/{user_id}/pending_ratings`
- `GET  /api/users/{user_id}/archetype_profile`
- `GET  /api/users/{user_id}/oracle_reports`
- `GET  /api/users/{user_id}/oracle_reports/latest`

### 3.6 Duo reading

- `POST /api/duo/sessions`
- `POST /api/duo/sessions/{id}/join`
- `POST /api/duo/sessions/join_by_invite`
- `POST /api/duo/sessions/{id}/card`
- `GET  /api/duo/sessions/{id}`
- `WS   /ws/duo/{id}`

### 3.7 Community room

- `POST /api/community/posts`
- `GET  /api/community/feed`
- `POST /api/community/posts/{id}/interpretations`
- `POST /api/community/interpretations/{id}/vote`
- `POST /api/community/interpretations/{id}/resonate`
- `GET  /api/admin/community/moderation_queue`
- `POST /api/admin/community/posts/{id}/approve`
- `POST /api/admin/community/posts/{id}/reject`

### 3.8 Dream journal

- `POST /api/dreams`
- `GET  /api/dreams`
- `GET  /api/dreams/{id}`

### 3.9 Daily Card + Streak (NEW)

- `POST /api/daily-card/draw`
- `GET  /api/daily-card/today`
- `POST /api/daily-card/{id}/reflect`
- `GET  /api/daily-card/streak`
- `GET  /api/daily-card/history`

### 3.10 Time Capsule (NEW)

- `POST /api/time-capsules`
- `GET  /api/time-capsules`
- `GET  /api/time-capsules/{id}`
- `POST /api/time-capsules/{id}/reveal`
- `POST /api/time-capsules/{id}/verdict`

### 3.11 Affirmations (NEW, no auth)

- `GET /api/affirmations/{card_name}?orientation=upright|reversed`

## 4) Ghi chú trạng thái hiện tại

- Trạng thái tổng thể backend: **đầy đủ + có 3 tính năng độc đáo cho daily engagement**.
- API cũ vẫn hoạt động để giữ tương thích frontend hiện có.
- Mặc định DB là SQLite (`data/app.db`), phù hợp local/staging nhỏ.
- Scheduler chạy in-process; phù hợp MVP, chưa tối ưu scale lớn.
- Test suite: **52 passed**, không cần GPU/local LLM.
