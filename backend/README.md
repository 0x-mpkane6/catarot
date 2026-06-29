# Tarot Multimodal MVP

Ứng dụng đọc bài Tarot 3 lá (quá khứ/hiện tại/tương lai) với văn bản + giọng nói + hình ảnh, kèm bộ tính năng nâng cao + gamification giữ chân người dùng.

## TL;DR 60 giây (Docker, khuyến nghị)

```bash
cd /mnt/d/LTWeb/github
# Cần file backend/.env (có GEMINI_API_KEY). Lần đầu & sau mỗi lần đổi code: LUÔN kèm --build
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8000> (health: <http://localhost:8000/api/health>)

> Docker đóng băng code lúc build, nên đổi code xong phải chạy lại `docker compose up --build`, nếu không container vẫn chạy code cũ.

## Dữ liệu (bắt buộc)

- Dữ liệu đã được đưa lên Google Drive: <https://drive.google.com/drive/folders/1o5j_VyxJSikVsPM0w2PQfMgT5_Ljml7d?usp=sharing>
- Sau khi tải về, giải nén thư mục `data` vào thư mục gốc của source (cùng cấp với `README.md`, `requirements.txt`) để có đường dẫn `./data/...`.
- Nếu đặt sai vị trí, các bước build index/vision có thể bị lỗi.

## Bạn sẽ thấy gì khi chạy xong

- Frontend: `http://127.0.0.1:5173`
- Backend API docs (Swagger UI): `http://127.0.0.1:8000/docs`
- Health check: `GET http://127.0.0.1:8000/api/health` trả về version + DB status
- Root: `GET http://127.0.0.1:8000/` trả về `{"status":"api running"}`

## Quy trình cho máy mới

1. Clone repo về máy.
2. Chạy backend quickstart.
3. Chạy frontend quickstart.
4. Chạy smoke test (vision/random/voice) để xác nhận hệ thống hoạt động.

## Chọn môi trường chạy

### WSL/Linux (chạy trực tiếp, không Docker)

```bash
# Backend
cd /mnt/d/LTWeb/github/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # điền GEMINI_API_KEY (hoặc bật Ollama)
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000

# Frontend quickstart
cd /mnt/d/LTWeb/github/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

### Windows native (PowerShell)

```powershell
# Backend
cd D:\LTWeb\github
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# Dùng GEMINI_API_KEY trong .env là đủ. (Tùy chọn Ollama: terminal khác chạy `ollama serve` + `ollama pull qwen2.5:3b-instruct`.)
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# Frontend
cd D:\LTWeb\github\frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Tính năng nổi bật

### Core (đọc bài đa phương thức)

- 3-card spread (past / present / future) qua text, voice (ASR), ảnh lá bài.
- Vision card recognition + RAG snippets + LLM diễn giải, nhiều tầng fallback.

### Advanced (f1 đến f10)

| ID | Tính năng | Endpoint chính |
|---|---|---|
| f1 | Conversational follow-up | `POST /api/sessions/{id}/followup` |
| f2 | Archetype profiler | `GET /api/users/{id}/archetype_profile` |
| f3 | Voice emotion analysis | tích hợp trong reading flow |
| f4 | Pattern Oracle (monthly) | `GET /api/users/{id}/oracle_reports` |
| f5 | Question Suggestion Engine | `GET /api/question_suggestions` |
| f6 | Spread Recommender | `POST /api/spread/recommend` |
| f7 | Duo Reading (REST + WS) | `POST /api/duo/sessions` + `WS /ws/duo/{id}` |
| f8 | Community Reading Room | `POST /api/community/posts` + moderation |
| f9 | Accuracy Rating Loop | `POST /api/readings/{id}/rating` |
| f10 | Dream Journal | `POST /api/dreams` |

### Tính năng độc đáo (v0.2)

| Tên | Mô tả ngắn | Endpoint chính |
|---|---|---|
| **Daily Card + Streak** | Mỗi user 1 lá/ngày, đếm streak (Duolingo-style), kèm reflection note + mood pre/post. | `POST /api/daily-card/draw`, `GET /api/daily-card/streak` |
| **Time Capsule Reading** | Khoá một dự đoán cho ngày mở trong tương lai; đến ngày, user verify accuracy rồi feed vào rating loop. | `POST /api/time-capsules`, `POST /api/time-capsules/{id}/reveal` |
| **Card Affirmation widget** | Sinh affirmation deterministic theo card + ngày, dùng cho widget lock-screen. | `GET /api/affirmations/{card_name}` |

Xem chi tiết tại [`../docs/BAO-CAO-DO-AN.md`](../docs/BAO-CAO-DO-AN.md).

### Hardening v0.2

- Rate limit cho `auth_register` (5/min) và `auth_login` (10/min); bật/tắt qua `RATE_LIMIT_ENABLED`.
- Email validator chuẩn (regex) thay vì chỉ check `@`.
- `request_id` middleware: mọi response có header `X-Request-Id`, log có id để debug.
- Global exception handler trả JSON 500 sạch + cảnh báo nếu `JWT_SECRET_KEY` còn placeholder.
- Endpoint `/api/health` cho DB connectivity + version.

## Lưu ý kỹ thuật hiện tại

- `spread_type` hiện tại được normalize về `three` ở backend.
- Vision retrieval mặc định yêu cầu OpenCLIP (`VISION_STRICT_OPENCLIP=true`).
- Endpoint chính cho frontend: `POST /api/ask_with_media`.
- JSON output gồm: `transcript`, `cards[].topk_candidates`, `warnings`, `final_answer`, `session_id` (nếu bật DB persistence).
- SQL DB mặc định: `sqlite:///./data/app.db` (tự tạo + seed bảng `tarot_cards` khi startup).
- Timezone mặc định: `APP_TIMEZONE=Asia/Ho_Chi_Minh` (fallback cuối là `UTC`).
- Cảnh báo trễ generation mặc định bật ở ngưỡng `SLOW_GENERATION_WARNING_SECONDS=45`.

## Smoke test nhanh

1. Vision flow: upload 3 ảnh tarot, bấm `Reading`.
2. Random flow: bấm `Random Draw` không cần ảnh.
3. Voice flow: record hoặc upload audio, xác nhận UI hiển thị `TRANSCRIPT`.
4. Kiểm tra `warnings` nếu transcript rỗng hoặc confidence thấp.
5. Daily card: `POST /api/daily-card/draw` (cần JWT), check `streak_at_draw=1`.
6. Time capsule: `POST /api/time-capsules` với `reveal_at` 1 ngày sau, list ra trạng thái `sealed`.

## Test suite

```bash
# Đặt API_UPLOAD_DIR ra ngoài repo nếu sandbox không cho ghi/xóa trong tmp_uploads
API_UPLOAD_DIR=/tmp/tarot_test_uploads pytest tests/ --ignore=tests/test_vision_smoke.py --ignore=tests/test_rag_smoke.py
```

Trạng thái bản final: **174 hàm test trên 26 file** (pytest), bao phủ pipeline, auth/security, DB persistence, migration, LLM fallback, RAG, vision và các tính năng nâng cao.

## Link tài liệu chi tiết

- Báo cáo đồ án đầy đủ: [`../docs/BAO-CAO-DO-AN.md`](../docs/BAO-CAO-DO-AN.md)
- Sơ đồ kiến trúc (Mermaid): [`../docs/SO-DO-KIEN-TRUC.md`](../docs/SO-DO-KIEN-TRUC.md)
- Backend runbook chi tiết: [README.backend.md](./README.backend.md)
