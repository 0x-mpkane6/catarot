# Hướng dẫn Frontend (Runbook)

Frontend dùng `React + Vite`, gọi backend qua API `POST /api/ask_with_media`.

## 1) Kiểm tra trước khi chạy

- Node.js: khuyến nghị `20.19+` (Vite có thể cảnh báo nếu dùng Node 18).
- npm đã cài sẵn.

Kiểm tra:

```bash
node -v
npm -v
```

## 2) Quickstart WSL/Linux

```bash
cd /mnt/d/LTWeb/github/frontend
cp .env.example .env
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 3) Quickstart Windows PowerShell

```powershell
cd D:\LTWeb\github\frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## 4) Cấu hình môi trường

File `.env`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Nếu backend chạy máy khác hoặc port khác, sửa URL cho phù hợp.

## 5) Hành vi mong đợi khi chạy

Sau khi gửi request:

- UI hiển thị `TRANSCRIPT` nếu có voice input.
- `DETECTED CARD` hiển thị tên lá + orientation + confidence.
- Nếu có vấn đề, `WARNINGS` hiển thị rõ lý do.
- Khi đang `Reading`, UI hiện trạng thái loading + thời gian đã chờ (request local LLM có thể mất khoảng 120 giây).

## 6) Build và lint

```bash
cd /mnt/d/LTWeb/github/frontend
npm run lint
npm run build
```

## 7) Troubleshooting

| Vấn đề | Dấu hiệu | Cách xử lý |
|---|---|---|
| CORS/API URL sai | Frontend báo backend error, không gọi được API | Kiểm tra `VITE_API_BASE_URL` trùng `http://127.0.0.1:8000`, và backend đang chạy |
| Node version mismatch | Vite cảnh báo Node 18 | Nâng cấp Node lên `20.19+` |
| Mic permission | Bấm `Start Voice` không record | Cấp quyền microphone cho browser/site |
| Browser không hỗ trợ MediaRecorder | Không record được audio | Dùng Chrome/Edge mới hoặc upload audio file thay vì record |

## 8) Checklist test local

1. Backend chạy ở `127.0.0.1:8000`.
2. Frontend mở ở `127.0.0.1:5173`.
3. Bấm `Reading` với 3 ảnh để test vision flow.
4. Bấm `Random Draw` để test random flow.
5. Test upload/record voice và xác nhận `TRANSCRIPT` hiển thị đúng.
