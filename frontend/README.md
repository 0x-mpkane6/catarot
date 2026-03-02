# Frontend Runbook

Frontend dùng `React + Vite`, gọi backend API `POST /api/ask_with_media`.

## 1) Yêu cầu
- Node.js 18+ (khuyến nghị 20+)
- npm

## 2) Cài đặt lần đầu
```bash
cd /mnt/d/LTWeb/github/frontend
cp .env.example .env
npm install
```

## 3) Cấu hình môi trường
File `.env`:
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 4) Chạy dev server
```bash
cd /mnt/d/LTWeb/github/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

## 5) Build và lint
```bash
cd /mnt/d/LTWeb/github/frontend
npm run lint
npm run build
```

## 6) Restart nhanh frontend
```bash
fuser -k 5173/tcp 2>/dev/null || true
npm run dev -- --host 127.0.0.1 --port 5173
```

## 7) Tính năng chính UI
- Three-card spread cố định (`past / present / future`)
- `Reading`: cần đủ 3 ảnh
- `Random Draw`: không cần ảnh
- Voice input:
  - `Start Voice` / `Stop Voice` (record trực tiếp)
  - `Upload Audio`
  - `Clear Voice`
  - Preview audio trước khi gửi

## 8) Checklist khi test local
1. Backend chạy ở `127.0.0.1:8000`.
2. Frontend mở ở `127.0.0.1:5173`.
3. Bấm `Reading` với 3 ảnh để test vision flow.
4. Bấm `Random Draw` để test random flow.
5. Test cả upload audio và record audio.
