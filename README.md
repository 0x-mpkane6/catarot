# Tarot Multimodal MVP

Ứng dụng đọc bài Tarot 3 lá (quá khứ/hiện tại/tương lai) với văn bản + giọng nói + hình ảnh.

## TL;DR 60 giây

```bash
# Terminal 1 (backend, khuyến nghị cho người mới)
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

## Dữ liệu (bắt buộc)

- Dữ liệu đã được đưa lên Google Drive: <https://drive.google.com/drive/folders/1o5j_VyxJSikVsPM0w2PQfMgT5_Ljml7d?usp=sharing>
- Sau khi tải về, giải nén thư mục `data` vào thư mục gốc của source (cùng cấp với `README.md`, `requirements.txt`) để có đường dẫn `./data/...`.
- Nếu đặt sai vị trí, các bước build index/vision có thể bị lỗi.

## Bạn sẽ thấy gì khi chạy xong

- Frontend: `http://127.0.0.1:5173`
- Backend API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/` trả về `{"status":"api running"}`

## Quy trình cho máy mới

1. Clone repo về máy.
2. Chạy backend quickstart.
3. Chạy frontend quickstart.
4. Chạy smoke test (vision/random/voice) để xác nhận hệ thống hoạt động.

## Chọn môi trường chạy

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

# Script one-shot yêu cầu bash/WSL. Nếu không dùng WSL, chạy thủ công:
# 1) mở terminal khác: ollama serve
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

## Link tài liệu chi tiết

- Backend runbook: [README.backend.md](./README.backend.md)
- Frontend runbook: [frontend/README.md](./frontend/README.md)
