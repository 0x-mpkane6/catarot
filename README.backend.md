# Backend Runbook

Tai lieu nay danh cho backend API (`FastAPI`) tai repo root.

## 1) Preflight Checklist

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

Neu thieu:

- `ffmpeg`: can de xu ly audio khong phai wav.
- `ollama`: can de sinh answer LLM local.
- `open-clip-torch`: can cho vision retrieval mac dinh.

## Data package (bat buoc)

- Data da duoc tach rieng khoi source va luu tai: <https://drive.google.com/drive/folders/1o5j_VyxJSikVsPM0w2PQfMgT5_Ljml7d?usp=sharing>
- Giai nen folder data vao root source de dam bao duong dan `data/...` dung truoc khi chay cac script build index.

## 2) Dependency Bat Buoc vs Tuy Chon

- Bat buoc:
  - Python 3.10+
  - ffmpeg
  - Ollama
  - OpenCLIP (`open-clip-torch`)
  - SQLAlchemy (`sqlalchemy`)
- Tuy chon:
  - `OPENAI_API_KEY` (neu muon uu tien OpenAI thay vi Ollama)

## 3) Quickstart 1 Lenh (Khuyen nghi)

```bash
cd /mnt/d/LTWeb/github
bash scripts/61_run_api_with_ollama.sh
```

Script se:

1. Tao `.env` tu `.env.example` neu chua co.
2. Dat `OLLAMA_ENABLED=true`.
3. Start `ollama serve` neu chua chay.
4. Pull model trong `OLLAMA_MODEL` neu chua co.
5. Tao/kich hoat `.venv`, cai deps can thiet.
6. Chay API `uvicorn` tai `127.0.0.1:8000`.

## 4) Manual Setup (WSL/Linux)

```bash
cd /mnt/d/LTWeb/github
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env

# data/index (chay 1 lan)
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
python scripts/50_init_db.py

# ollama
ollama serve
# terminal khac
ollama pull qwen2.5:3b-instruct

# run API
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 5) Manual Setup (Windows native PowerShell)

```powershell
cd D:\LTWeb\github
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# data/index (chay 1 lan)
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
python scripts/50_init_db.py

# mo terminal khac
ollama serve
# terminal hien tai
ollama pull qwen2.5:3b-instruct

python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Goi y cai tool tren Windows:

- Ollama: `winget install Ollama.Ollama`
- ffmpeg: `winget install Gyan.FFmpeg`

## 6) ASR Quality Defaults (vi/en)

Mac dinh trong `.env.example`:

- `ASR_MODEL_FASTER=large-v3`
- `ASR_MODEL_TRANSFORMERS=openai/whisper-small`
- `ASR_LANGUAGE_MODE=auto_vi_en`
- `ASR_CANDIDATE_LANGS=vi,en`

Y nghia:

- Uu tien do chinh xac cao cho tieng Viet/tieng Anh.
- Neu `faster-whisper` loi, se fallback sang `transformers`.

## 7) API Cong Khai Cho Frontend

Endpoint chinh:

- `POST /api/ask_with_media`

Form fields:

- `question` (required)
- `spread_type` (`three`; backend normalize ve `three`)
- `random_draw` (`true` / `false`)
- `image[]` (optional)
- `audio` (optional)

Output JSON quan trong:

- `question`, `transcript`, `spread_type`
- `cards[]` (co `topk_candidates`)
- `rag_snippets`, `warnings`, `final_answer`
- `session_id` (neu DB persistence thanh cong)

## SQL DB persistence

Mac dinh backend tu dong tao SQLite DB tai `./data/app.db` va seed `tarot_cards` luc startup.

Bien moi truong lien quan:

- `DB_ENABLED=true|false`: bat/tat luu DB
- `DATABASE_URL`: ket noi SQLAlchemy (mac dinh `sqlite:///./data/app.db`)
- `DB_ECHO=true|false`: in SQL de debug

## 8) Health Checks

### Health endpoint

```bash
curl -s http://127.0.0.1:8000/
```

### Mau request media

```bash
curl -s -X POST http://127.0.0.1:8000/api/ask_with_media \
  -F "question=test" \
  -F "spread_type=three" \
  -F "random_draw=true"
```

## 9) Troubleshooting

| Van de | Dau hieu | Cach xu ly |
|---|---|---|
| `No module named open_clip` | Backend die ngay khi load vision | Cai deps: `pip install -r requirements.txt`; dam bao `VISION_STRICT_OPENCLIP=true` hoac tam thoi set `VISION_STRICT_OPENCLIP=false` de demo |
| `Audio format is not WAV and ffmpeg is not installed` | `transcript` rong + warning ASR | Cai ffmpeg, restart backend |
| Ollama unavailable | `warnings` co thong diep fallback deterministic | Chay `ollama serve`, kiem tra `OLLAMA_BASE_URL`, pull lai model |
| Port 8000 da duoc dung | `Address already in use` | `fuser -k 8000/tcp` (Linux/WSL) hoac doi port uvicorn |

## 10) Restart nhanh backend

```bash
fuser -k 8000/tcp 2>/dev/null || true
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

## 11) Kiem thu nhanh

```bash
cd /mnt/d/LTWeb/github
source .venv/bin/activate
python -m pytest -q
```
