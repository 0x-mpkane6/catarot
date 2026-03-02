# Tarot Multimodal MVP

Ứng dụng đọc bài Tarot 3 lá (past/present/future) với:
- Nhận ảnh tarot, hoặc random draw nếu không có ảnh.
- Nhận voice (record/upload) để ASR transcript.
- Backend trả JSON gồm `question`, `transcript`, `spread_type`, `cards`, `rag_snippets`, `final_answer`, `warnings`.

## Tài liệu theo phần
- Backend: xem [README.backend.md](./README.backend.md)
- Frontend: xem [frontend/README.md](./frontend/README.md)

## Quickstart fullstack (WSL/Linux)
```bash
# Terminal 1: backend
cd /mnt/d/LTWeb/github
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# chuẩn bị data/index (chạy 1 lần)
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py

# Ollama local (chạy 1 lần trên máy mới)
# Terminal khác:
#   ollama serve
# Terminal hiện tại:
ollama pull qwen2.5:3b-instruct

# run API
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: frontend
cd /mnt/d/LTWeb/github/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## API chính cho frontend
- `POST /api/ask_with_media`
  - Form fields:
  - `question` (required)
  - `spread_type` (`three`)
  - `random_draw` (`true` / `false`)
  - `image[]` (optional)
  - `audio` (optional)

## Test nhanh
```bash
python -m pytest -q
```
