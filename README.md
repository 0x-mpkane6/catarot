# Tarot Multimodal MVP

Ung dung doc bai Tarot 3 la (past/present/future) voi text + voice + image.

## TL;DR 60s
```bash
# Terminal 1 (backend, khuyen nghi cho nguoi moi)
cd /mnt/d/LTWeb/github
bash scripts/61_run_api_with_ollama.sh
```

```bash
# Terminal 2 (frontend)
cd /mnt/d/LTWeb/github/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Ban se thay gi
- Frontend: `http://127.0.0.1:5173`
- Backend API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/` tra ve `{"status":"api running"}`

## Fresh Machine Flow
1. Clone repo vao may moi.
2. Chay backend quickstart.
3. Chay frontend quickstart.
4. Chay smoke test (vision/random/voice) de xac nhan he thong.

## Chon moi truong

### WSL/Linux
```bash
# Backend quickstart
cd /mnt/d/LTWeb/github
bash scripts/61_run_api_with_ollama.sh

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

# Script one-shot yeu cau bash/WSL. Neu khong dung WSL, chay thu cong:
# 1) mo terminal khac: ollama serve
# 2) pull model: ollama pull qwen2.5:3b-instruct
# 3) run API:
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# Frontend
cd D:\LTWeb\github\frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Known Constraints
- `spread_type` hien tai duoc normalize ve `three` o backend.
- Vision retrieval mac dinh yeu cau OpenCLIP (`VISION_STRICT_OPENCLIP=true`).
- Endpoint chinh cho frontend: `POST /api/ask_with_media`.
- JSON output gom: `transcript`, `cards[].topk_candidates`, `warnings`, `final_answer`.

## Smoke Test Nhanh
1. Vision flow: upload 3 anh tarot, bam `Reading`.
2. Random flow: bam `Random Draw` khong can anh.
3. Voice flow: record hoac upload audio, xac nhan UI hien `TRANSCRIPT`.
4. Kiem tra `warnings` neu transcript rong hoac confidence thap.

## Link Tai Lieu Chi Tiet
- Backend runbook: [README.backend.md](./README.backend.md)
- Frontend runbook: [frontend/README.md](./frontend/README.md)
