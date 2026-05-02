# Frontend Runbook

Frontend dung `React + Vite`, goi backend API `POST /api/ask_with_media`.

## 1) Preflight
- Node.js: khuyen nghi `20.19+` (Vite co the canh bao neu dung Node 18).
- npm co san.

Kiem tra:
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

## 4) Cau hinh moi truong
File `.env`:
```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Neu backend chay may khac/port khac, sua URL cho phu hop.

## 5) Runtime Expectations
Sau khi gui request:
- UI phai hien `TRANSCRIPT` neu co voice input.
- `DETECTED CARD` hien ten la + orientation + confidence.
- Neu co van de, `WARNINGS` phai hien ro ly do.

## 6) Build va lint
```bash
cd /mnt/d/LTWeb/github/frontend
npm run lint
npm run build
```

## 7) Troubleshooting
| Van de | Dau hieu | Cach xu ly |
|---|---|---|
| CORS/API URL sai | Frontend bao backend error, khong goi duoc API | Kiem tra `VITE_API_BASE_URL` trung `http://127.0.0.1:8000`, backend dang chay |
| Node version mismatch | Vite canh bao Node 18 | Nang cap Node len `20.19+` |
| Mic permission | Bam `Start Voice` khong record | Cap quyen microphone cho browser/site |
| Browser khong ho tro MediaRecorder | Khong record duoc audio | Dung Chrome/Edge moi hoac upload audio file thay vi record |

## 8) Checklist test local
1. Backend chay o `127.0.0.1:8000`.
2. Frontend mo o `127.0.0.1:5173`.
3. Bam `Reading` voi 3 anh de test vision flow.
4. Bam `Random Draw` de test random flow.
5. Test upload/record voice va xac nhan `TRANSCRIPT` hien thi dung.
