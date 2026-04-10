# Báo Cáo Kiến Trúc Dự Án Tarot AI (Backend)

Ngày cập nhật: 2026-04-10  
Phạm vi: backend API, DB, scheduler, migration, test

## 1) Tổng quan nhanh

Hệ thống hiện tại đã ở mức MVP nâng cao. Backend đi theo hướng monolith nhưng chia module rõ ràng:

- API layer: FastAPI (`src/main.py`)
- Service layer: các module `src/advanced/*`, `src/auth/*`
- Pipeline chính: `src/pipeline/tarot_pipeline.py`
- Adapter AI: Vision + ASR + RAG + LLM
- Lưu trữ dữ liệu: SQLAlchemy ORM (`src/db/models.py`, `src/db/persistence.py`)
- Migration: Alembic + bootstrap migration nhẹ (`src/db/init_db.py`)
- Tác vụ nền: APScheduler (rating reminders + analytics jobs)

Trạng thái tính năng nâng cao: backend đã có đủ 10/10 feature trong phạm vi hiện tại.

## 2) Mục tiêu kiến trúc

Kiến trúc hiện tại ưu tiên:

- Giữ tương thích ngược với API cũ (`/api/ask`, `/api/ask_with_media`, `/api/ask_with_image`)
- Tích hợp AI theo nhiều lớp fallback (OpenAI -> Ollama -> deterministic fallback)
- Triển khai đơn giản để chạy demo nhanh (scheduler chạy in-process, DB mặc định là SQLite)
- Mở rộng tính năng theo module, chưa ràng buộc frontend trong vòng này

## 3) Kiến trúc theo tầng (layered architecture)

### 3.1 Transport/API layer

- Route handlers đặt tại `src/main.py`
- Giao tiếp gồm:
  - REST JSON
  - REST multipart form-data (upload audio/image)
  - WebSocket cho Duo session (`/ws/duo/{id}?token=...`)

### 3.2 Application/Service layer

- Reading flow: `src/pipeline/tarot_pipeline.py`
- Persist reading + cards: `src/db/persistence.py`
- Auth/JWT: `src/auth/service.py`, `src/auth/deps.py`, `src/auth/security.py`
- Advanced modules:
  - Conversation follow-up: `src/advanced/conversation.py`
  - Question suggestions: `src/advanced/question_suggestions.py`
  - Spread recommender: `src/advanced/spread_recommender.py`
  - Rating reminders: `src/advanced/rating_reminders.py`
  - Archetype profiler: `src/advanced/archetype_profiler.py`
  - Oracle reports: `src/advanced/oracle_reports.py`
  - Duo reading: `src/advanced/duo_reading.py`
  - Community room: `src/advanced/community_room.py`
  - Dream journal: `src/advanced/dream_journal.py`
  - Emotion analysis: `src/advanced/emotion_analysis.py`

### 3.3 Infra/Adapters layer

- Vision card recognition: `src/vision/*`
- RAG retrieval: `src/rag/retrieve.py`
- ASR (faster-whisper/transformers): `src/asr/transcribe.py`
- LLM generation adapters: `src/llm/generate.py`
- DB session/engine: `src/db/session.py`
- Config loading + env override: `src/utils/config.py`

### 3.4 Data layer

- ORM models: `src/db/models.py`
- Alembic schema revisions: `alembic/versions/20260410_000001_initial_advanced.py`
- Seed tarot cards: `src/db/seed.py`

## 4) Luồng xử lý chính

### 4.1 Reading flow (API cũ vẫn được giữ)

1. Client gọi `/api/ask` hoặc `/api/ask_with_media` hoặc `/api/ask_with_image`.
2. `TarotPipeline.run_pipeline()` xử lý theo thứ tự:
   - ASR transcript (nếu có audio)
   - Emotion signal + emotion_state (nếu có audio)
   - Vision predict cards hoặc random draw
   - RAG snippets theo card/question
   - LLM generate final answer (có fallback)
3. Persist vào DB:
   - `reading_sessions`
   - `recognized_cards`
   - `readings`
   - `rating_reminders` (nếu có `user_id`)
4. Trả kết quả về client, gồm `session_id` nếu lưu DB thành công.

### 4.2 Conversational follow-up

1. `POST /api/sessions/{session_id}/followup`
2. Lưu turn của user vào `conversation_turns`
3. Tải context reading gốc + lịch sử turn
4. Cắt gọn context:
   - giữ tối đa 8 turn gần nhất
   - turn cũ được tóm tắt deterministic (không tạo LLM call riêng)
5. Sinh câu trả lời follow-up và lưu thêm turn assistant

### 4.3 Rating reminder loop

1. Khi tạo reading có `user_id`, hệ thống tạo reminder `pending` theo `rating_reminder_days` (7/14/30)
2. Job APScheduler chạy mỗi 5 phút để xử lý reminder đến hạn
3. SMTP gửi email nếu có cấu hình
4. Chuyển trạng thái:
   - `pending -> sent`
   - `pending/failed -> failed` (retry tối đa 3)
   - `pending/failed -> skipped` (thiếu email)
   - `* -> rated` khi user submit score

### 4.4 Weekly/Monthly analytics

- Weekly archetype job:
  - cron thứ 2 lúc 02:00 (timezone app)
  - tính profile cho user có >=5 reading sessions
- Monthly oracle job:
  - ngày 1 hằng tháng lúc 03:00
  - tổng hợp dữ liệu tháng trước, tạo narrative, lưu report
  - email là side effect tùy chọn

## 5) API surface hiện tại

### 5.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### 5.2 Core reading (legacy-compatible)

- `POST /api/ask`
- `POST /api/ask_with_media`
- `POST /api/ask_with_image`

### 5.3 Advanced features

- f1 Conversation:
  - `POST /api/sessions/{session_id}/followup`
  - `GET /api/sessions/{session_id}/conversation`
- f5 Suggestions:
  - `GET /api/question_suggestions`
- f6 Spread recommender:
  - `POST /api/spread/recommend`
- f9 Rating:
  - `POST /api/readings/{session_id}/rating`
  - `GET /api/users/{user_id}/pending_ratings`
- f2 Archetype:
  - `GET /api/users/{user_id}/archetype_profile`
- f4 Oracle:
  - `GET /api/users/{user_id}/oracle_reports`
  - `GET /api/users/{user_id}/oracle_reports/latest`
- f7 Duo:
  - `POST /api/duo/sessions`
  - `POST /api/duo/sessions/{id}/join`
  - `POST /api/duo/sessions/join_by_invite`
  - `POST /api/duo/sessions/{id}/card`
  - `GET /api/duo/sessions/{id}`
  - `WS /ws/duo/{id}?token=...`
- f8 Community:
  - `POST /api/community/posts`
  - `GET /api/community/feed`
  - `POST /api/community/posts/{id}/interpretations`
  - `POST /api/community/interpretations/{id}/vote`
  - `POST /api/community/interpretations/{id}/resonate`
  - `GET /api/admin/community/moderation_queue`
  - `POST /api/admin/community/posts/{id}/approve`
  - `POST /api/admin/community/posts/{id}/reject`
- f10 Dream journal:
  - `POST /api/dreams`
  - `GET /api/dreams`
  - `GET /api/dreams/{id}`

## 6) Mô hình dữ liệu (DB schema)

### 6.1 Core entities

- `users`
- `tarot_cards`
- `reading_sessions`
- `recognized_cards`
- `readings`

### 6.2 Advanced entities

- Conversation/rating:
  - `conversation_turns`
  - `rating_reminders`
- Archetype/oracle:
  - `user_archetype_profiles`
  - `oracle_reports`
- Duo:
  - `duo_sessions`
  - `duo_participants`
  - `duo_cards`
  - `duo_readings`
- Community:
  - `community_posts`
  - `community_interpretations`
  - `community_votes`
  - `community_moderation_logs`
- Dream:
  - `dream_entries`

### 6.3 Ràng buộc đáng chú ý

- Check constraints cho status/role/action ở nhiều bảng
- Unique constraints:
  - email users
  - vote idempotency (`interpretation_id`, `user_id`)
  - duo participant slot uniqueness
- One-to-one:
  - `readings.session_id` unique
  - `duo_readings.duo_session_id` unique
  - `user_archetype_profiles.user_id` unique

## 7) Bảo mật và phân quyền

- JWT access token only (chưa dùng refresh token)
- Password hash: PBKDF2-SHA256 (200k iterations)
- REST auth: Bearer token
- WS auth: query param token
- Role control:
  - `member`: dùng API cấp người dùng
  - `admin`: moderation queue + approve/reject
- Ownership guard:
  - API theo user (oracle/archetype) chỉ cho chính chủ hoặc admin

## 8) Migration và khởi tạo DB

- Alembic đã được thêm với revision baseline:
  - `20260410_000001_initial_advanced`
- Startup bootstrap vẫn có `create_all` + lightweight `ALTER TABLE` để giữ backward compatibility cho các cột:
  - `reading_sessions.emotion_state`
  - `reading_sessions.emotion_signal_json`
  - `readings.accuracy_score`
  - `readings.accuracy_note`
  - `readings.rated_at`

Nhận xét:

- Migration hiện tại là mô hình hybrid (Alembic + bootstrap migration nhẹ), phù hợp giai đoạn MVP. Khi lên production lớn nên chuẩn hóa dần về Alembic-only.

## 9) Scheduler và tác vụ nền

- `start_rating_scheduler()`:
  - chạy mỗi 5 phút
  - xử lý rating reminders đến hạn
- `start_analytics_scheduler()`:
  - weekly archetype (Mon 02:00)
  - monthly oracle (day 1, 03:00)
- Timezone cho toàn bộ jobs:
  - `APP_TIMEZONE` (default `Asia/Saigon`)

## 10) Tích hợp AI/ML và chiến lược fallback

- Vision:
  - nếu index/meta có sẵn: predict theo embedding + FAISS
  - nếu không: fallback candidate pool
- ASR:
  - ưu tiên faster-whisper
  - fallback transformers whisper
  - fallback bỏ transcript nếu thất bại
- LLM:
  - ưu tiên OpenAI nếu có API key
  - fallback Ollama local
  - fallback deterministic text generator

Kết quả: hệ thống vẫn trả được response khi một số dependency AI lỗi, không hard-fail toàn flow.

## 11) Mapping tính năng Advanced (f1 -> f10)

| Feature | Tên | Trạng thái backend | Module chính |
|---|---|---|---|
| f1 | Conversational Reading | Implemented | `src/advanced/conversation.py` |
| f2 | Archetype Profiler | Implemented | `src/advanced/archetype_profiler.py` |
| f3 | Voice Emotion Analysis | Implemented | `src/advanced/emotion_analysis.py` |
| f4 | Pattern Oracle | Implemented | `src/advanced/oracle_reports.py` |
| f5 | Question Suggestion Engine | Implemented | `src/advanced/question_suggestions.py` |
| f6 | Spread Recommender | Implemented (recommend-only) | `src/advanced/spread_recommender.py` |
| f7 | Duo Reading | Implemented (REST + WS) | `src/advanced/duo_reading.py` |
| f8 | Community Reading Room | Implemented | `src/advanced/community_room.py` |
| f9 | Accuracy Rating Loop + reminder | Implemented | `src/advanced/rating_reminders.py` |
| f10 | Dream Journal Integration | Implemented | `src/advanced/dream_journal.py` |

## 12) Kiểm thử và chất lượng

Test suite hiện có:

- Unit tests cho logic advanced (conversation context, suggestion, spread, rating states, emotion/archetype/dream/duo/community)
- API/integration tests cho endpoint mới + legacy
- Migration tests (Alembic + lightweight migration idempotent)

Trạng thái tại 2026-04-10:

- `pytest` pass: 35 passed

## 13) Kịch bản deploy tham chiếu

### 13.1 Runtime đề xuất cho MVP

- 1 FastAPI process (uvicorn)
- SQLite file DB (`data/app.db`) cho local/staging nhỏ
- APScheduler in-process
- Ollama local hoặc OpenAI cloud
- SMTP optional

### 13.2 Env cần quản lý chặt khi deploy

- Auth:
  - `JWT_SECRET_KEY` (production phải dài và random)
  - `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`
- DB:
  - `DATABASE_URL`, `DB_ENABLED`
- AI:
  - `OPENAI_API_KEY` hoặc `OLLAMA_*`
- Scheduler:
  - `RATING_REMINDER_SCHEDULER_ENABLED`
  - `ARCHETYPE_SCHEDULER_ENABLED`
  - `ORACLE_SCHEDULER_ENABLED`
- Email:
  - `SMTP_HOST`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_PORT`

## 14) Điểm mạnh, hạn chế và hướng nâng cấp

### Điểm mạnh

- Coverage tính năng đầy đủ theo scope advanced backend
- Fallback đa tầng giúp hệ thống ổn định khi dependency AI gặp sự cố
- API cũ được giữ nguyên, giảm rủi ro vỡ flow frontend cũ
- Test coverage đã mở rộng cho migration + advanced modules

### Hạn chế hiện tại

- Monolith process + scheduler in-process:
  - chưa tối ưu cho horizontal scaling và high availability
- SQLite mặc định:
  - chưa tối ưu cho ghi đồng thời lớn
- JWT access token only:
  - chưa có refresh/revoke/blacklist
- WS auth qua query param:
  - cần policy log/sanitize để tránh lộ token
- Migration strategy hybrid:
  - cần roadmap chuẩn hóa Alembic-only

### Hướng nâng cấp gần

1. Chuyển DB production sang PostgreSQL + connection pool tuning
2. Tách scheduler sang worker process riêng (hoặc Celery/RQ)
3. Bổ sung observability: structured log, metrics, tracing, alert
4. Hardening auth: refresh token, rotate secret, optional token revoke
5. Bổ sung rate limit và anti-abuse cho community/duo endpoints

## 15) Kết luận

Kiến trúc hiện tại đã đạt mức backend MVP nâng cao với đủ 10/10 tính năng advanced, có thể vận hành thực tế cho demo/staging và có nền tảng để mở rộng production. Giai đoạn tiếp theo nên ưu tiên hardening vận hành (DB, scheduler, security, observability) hơn là mở rộng thêm tính năng mới.
