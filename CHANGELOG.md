# Changelog

## v0.2.0 — 2026-04-29

### Added — Unique Features

- **Daily Card + Streak System** (`src/advanced/daily_card.py`)
  - One card per user per local day, idempotent draw.
  - `current_streak` / `longest_streak` / `total_draws` tracking.
  - Reflection notes + mood_pre/mood_post.
  - Endpoints:
    - `POST /api/daily-card/draw`
    - `GET  /api/daily-card/today`
    - `POST /api/daily-card/{id}/reflect`
    - `GET  /api/daily-card/streak`
    - `GET  /api/daily-card/history`

- **Time Capsule Reading** (`src/advanced/time_capsule.py`)
  - Lock a tarot prediction with a future `reveal_at` date.
  - Sealed → revealed (auto on reveal_at) → verified (after user verdict).
  - Min 6h, max 3 years window.
  - Scheduler hook flips due capsules every 15 minutes.
  - Endpoints:
    - `POST /api/time-capsules`
    - `GET  /api/time-capsules`
    - `GET  /api/time-capsules/{id}`
    - `POST /api/time-capsules/{id}/reveal`
    - `POST /api/time-capsules/{id}/verdict`

- **Card Affirmation widget** (`src/advanced/affirmations.py`)
  - Deterministic per (card, orientation, date), zero LLM calls.
  - Different tone for upright vs reversed.
  - Endpoint: `GET /api/affirmations/{card_name}?orientation=upright`

### Added — Hardening

- In-memory rate limiter (`src/utils/rate_limit.py`)
  - `auth_register`: 5/min per IP
  - `auth_login`: 10/min per IP
  - Toggle with `RATE_LIMIT_ENABLED`.
- Strict email validator with regex (`src/utils/validators.py`).
- `request_id` middleware: every response carries `X-Request-Id`.
- Global exception handler returning JSON 500 + request_id.
- Startup warning when `JWT_SECRET_KEY` still uses the placeholder.
- `GET /api/health` operator probe (db connectivity + version).

### Added — Database

- New tables `daily_cards` and `time_capsules`.
- New Alembic revision: `20260428_000002_daily_card_time_capsule`.
- SQLite-friendly: backend treats naive datetimes as UTC for time capsules.

### Tests

- 16 new test cases covering daily card lifecycle, time capsule seal/reveal/verdict, scheduler, affirmation determinism, rate limit burst, email validation, health check, request id propagation.
- Total suite: **52 passed** (was 35).

### Other notes

- API title/version exposed via FastAPI metadata for cleaner Swagger UI (`/docs`).
- `analytics_scheduler` now also runs the time-capsule reveal job (15-minute interval).

---

## v0.1.0 — 2026-04-10

Baseline release. 10/10 advanced features (f1-f10), Alembic baseline, multimodal pipeline.
