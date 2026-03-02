# Backend Runbook

Tài liệu này dành cho backend API (`FastAPI`) ở repo root.

## 1) Yêu cầu
- Python 3.10+ (khuyến nghị 3.11/3.12)
- `pip`
- `ffmpeg` (khuyến nghị để ASR xử lý audio non-wav)
- Ollama (nếu chạy local LLM fallback)

## 2) Cài đặt lần đầu trên máy mới (WSL/Linux)
```bash
cd /mnt/d/LTWeb/github
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

## 3) Chuẩn bị dữ liệu/index (chạy 1 lần)
```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate

bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
```

## 4) Ollama lần đầu trên máy mới
Nếu chưa cài Ollama:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Chạy Ollama server và pull model:
```bash
# Terminal A
ollama serve

# Terminal B
ollama pull qwen2.5:3b-instruct
```

Lưu ý:
- Tên model phải khớp `OLLAMA_MODEL` trong `.env` (mặc định `qwen2.5:3b-instruct`).
- Nếu có `OPENAI_API_KEY`, app sẽ ưu tiên OpenAI trước Ollama.

## 5) Chạy backend API
```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 6) Chạy Gradio (tuỳ chọn)
```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate
python scripts/60_run_app.py
```

## 7) Endpoint chính dùng bởi frontend
- `POST /api/ask_with_media`
  - `question` (required)
  - `spread_type` (fixed: `three`)
  - `random_draw` (`true` / `false`)
  - `image[]` (optional)
  - `audio` (optional)

## 8) Restart nhanh backend
```bash
fuser -k 8000/tcp 2>/dev/null || true
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 9) Kiểm thử
```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate
python -m pytest -q
```
