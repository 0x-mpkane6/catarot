# Hướng dẫn Backend (Runbook)

Tài liệu này dành cho backend API (`FastAPI`) ở thư mục gốc của repo.

## 1) Kiểm tra nhanh trước khi chạy

### WSL/Linux

```bash
python3 --version
ffmpeg -version | head -n 1
ollama --version
```

### Windows PowerShell

```powershell
python --version
ffmpeg -version
ollama --version
```

Nếu thiếu:

- `ffmpeg`: cần để xử lý audio không phải wav.
- `ollama`: cần để sinh câu trả lời LLM local.
- `open-clip-torch`: cần cho vision retrieval mặc định.

## Dữ liệu (bắt buộc)

- Dữ liệu đã tách khỏi source và lưu tại: <https://drive.google.com/drive/folders/1o5j_VyxJSikVsPM0w2PQfMgT5_Ljml7d?usp=sharing>
- Giải nén thư mục `data` vào root source để đảm bảo đường dẫn `data/...` đúng trước khi chạy các script build index.

## 2) Dependency bắt buộc và tùy chọn

- Bắt buộc:
  - Python 3.10+
  - ffmpeg
  - Ollama
  - OpenCLIP (`open-clip-torch`)
  - SQLAlchemy (`sqlalchemy`)
- Tùy chọn:
  - `OPENAI_API_KEY` (nếu muốn ưu tiên OpenAI thay vì Ollama)

## 3) Quickstart bằng Docker (khuyến nghị)

```bash
cd /mnt/d/LTWeb/github
# Cần backend/.env (có GEMINI_API_KEY). Sau MỖI lần đổi code phải kèm --build.
docker compose up --build
```

- Backend: <http://localhost:8000> (health: `/api/health`) — Frontend: <http://localhost:5173>
- Docker đóng băng code lúc build (`COPY . .`) → đổi code xong **luôn** chạy lại với `--build`, nếu không container phục vụ code cũ (đây là lý do hay gặp "code mới mà vẫn ra cũ").
- LLM mặc định dùng `GEMINI_API_KEY` trong `backend/.env`. Muốn dùng Ollama trên host thì compose đã map sẵn `host.docker.internal`.

### Chạy trực tiếp không Docker (dev nhanh)

```bash
cd /mnt/d/LTWeb/github/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # điền GEMINI_API_KEY
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 4) Cài thủ công (WSL/Linux)

```bash
cd /mnt/d/LTWeb/github
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env

# data/index (chạy 1 lần)
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
python scripts/50_init_db.py

# ollama
ollama serve
# terminal khác
ollama pull qwen2.5:3b-instruct

# run API
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 5) Cài thủ công (Windows native PowerShell)

```powershell
cd D:\LTWeb\github
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# data/index (chạy 1 lần)
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
python scripts/50_init_db.py

# mở terminal khác
ollama serve
# terminal hiện tại
ollama pull qwen2.5:3b-instruct

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Gợi ý cài tool trên Windows:

- Ollama: `winget install Ollama.Ollama`
- ffmpeg: `winget install Gyan.FFmpeg`

## 6) Mặc định ASR cho tiếng Việt/tiếng Anh

Mặc định trong `.env.example`:

- `ASR_MODEL_FASTER=large-v3`
- `ASR_MODEL_TRANSFORMERS=openai/whisper-small`
- `ASR_LANGUAGE_MODE=auto_vi_en`
- `ASR_CANDIDATE_LANGS=vi,en`

Ý nghĩa:

- Ưu tiên độ chính xác cao cho tiếng Việt/tiếng Anh.
- Nếu `faster-whisper` lỗi, hệ thống tự fallback sang `transformers`.

## 7) API công khai cho frontend

Endpoint chính:

- `POST /api/ask_with_media`

Form fields:

- `question` (required)
- `spread_type` (`three`; backend normalize về `three`)
- `random_draw` (`true` / `false`)
- `image[]` (optional)
- `audio` (optional)

Output JSON quan trọng:

- `question`, `transcript`, `spread_type`
- `cards[]` (có `topk_candidates`)
- `rag_snippets`, `warnings`, `final_answer`
- `session_id` (nếu DB persistence thành công)

## SQL DB persistence

Mặc định backend tự tạo SQLite DB tại `./data/app.db` và seed `tarot_cards` lúc startup.

Biến môi trường liên quan:

- `DB_ENABLED=true|false`: bật/tắt lưu DB
- `DATABASE_URL`: kết nối SQLAlchemy (mặc định `sqlite:///./data/app.db`)
- `DB_ECHO=true|false`: in SQL để debug
- `APP_TIMEZONE`: timezone local của app (mặc định `Asia/Ho_Chi_Minh`, fallback `UTC`)
- `SLOW_GENERATION_WARNING_SECONDS`: ngưỡng giây để thêm warning generation chậm (mặc định `45`)

## 8) Health checks

### Health endpoint

```bash
curl -s http://127.0.0.1:8000/
```

### Mẫu request media

```bash
curl -s -X POST http://127.0.0.1:8000/api/ask_with_media \
  -F "question=test" \
  -F "spread_type=three" \
  -F "random_draw=true"
```

## 9) Troubleshooting

| Vấn đề | Dấu hiệu | Cách xử lý |
|---|---|---|
| `No module named open_clip` | Backend dừng ngay khi load vision | Cài deps: `pip install -r requirements.txt`; đảm bảo `VISION_STRICT_OPENCLIP=true` hoặc tạm set `VISION_STRICT_OPENCLIP=false` để demo |
| `Audio format is not WAV and ffmpeg is not installed` | `transcript` rỗng + warning ASR | Cài ffmpeg, rồi restart backend |
| Ollama unavailable | `warnings` có thông điệp fallback deterministic | Chạy `ollama serve`, kiểm tra `OLLAMA_BASE_URL`, pull lại model |
| Port 8000 đã được dùng | `Address already in use` | `fuser -k 8000/tcp` (Linux/WSL) hoặc đổi port uvicorn |

## 10) Restart nhanh backend

```bash
fuser -k 8000/tcp 2>/dev/null || true
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 11) Kiểm thử nhanh

```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate
python -m pytest -q
```
