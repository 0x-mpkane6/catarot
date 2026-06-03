# Hướng dẫn Triển khai (Deploy) — Tarot Multimodal Web App

> Hệ thống chạy **hoàn toàn miễn phí** trên free tier, tách thành 3 hạ tầng độc lập:
> **Frontend → Cloudflare Workers · Backend → Hugging Face Spaces · Database → Neon (Postgres)**.

---

## 0. Bản đồ triển khai thực tế

| Thành phần | Nền tảng | Địa chỉ |
|------------|----------|---------|
| Frontend (SPA) | Cloudflare Workers | `https://throbbing-bar-16f0.trangtuananh.workers.dev` |
| Backend (API) | Hugging Face Spaces (Docker) | `https://tranganh06uit-tarot-backend.hf.space` |
| API docs | (trên backend) | `…/docs` (Swagger) · `…/api/health` |
| Database | Neon (PostgreSQL serverless) | qua `DATABASE_URL` |

---

## 1. Backend → Hugging Face Spaces

**Đóng gói:** `backend/Dockerfile` (multi-stage, Python 3.11-slim), cài `torch/torchvision` bản **CPU-only**, có sẵn `ffmpeg` + `libsndfile1` (cần cho ASR/audio), chạy non-root UID 1000, expose `8000`, có `HEALTHCHECK` gọi `/api/health`. Metadata Space ở `backend/SPACE_README.md` (`sdk: docker`, `app_port: 8000`).

**Settings → Variables and secrets** trên Space:

**Secrets:**
- `GEMINI_API_KEY` — lấy tại https://aistudio.google.com/apikey
- `JWT_SECRET_KEY` — **bắt buộc** khi `APP_ENV=production` (≥32 ký tự). Sinh: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `GOOGLE_CLIENT_ID` — cho Google login; **phải khớp** `VITE_GOOGLE_CLIENT_ID` ở frontend
- `DATABASE_URL` — **khuyến nghị** trỏ Neon (xem mục 3)

**Variables:**
```
APP_ENV=production
OLLAMA_ENABLED=false
EXPOSE_RESET_TOKEN_IN_RESPONSE=false
API_ALLOWED_ORIGINS=https://throbbing-bar-16f0.trangtuananh.workers.dev
GEMINI_MODEL=gemini-2.5-flash
ASK_RATE_LIMIT_MAX=20
ASK_RATE_LIMIT_WINDOW=60
```

> ⚠️ **ASR (giọng nói):** mặc định `ASR_MODEL_FASTER=large-v3` rất nặng trên CPU 2 vCPU của HF free tier (một câu nói có thể mất 30–90s + tải ~3GB lần đầu). Nếu cần demo giọng nói mượt, thêm Variable **`ASR_MODEL_FASTER=base`** (hoặc `small`) rồi restart Space.

**Lưu ý:** build lần đầu 10–15 phút (tải model); có cold-start; SQLite trong container **không bền vững** qua rebuild → dùng Neon.

---

## 2. Frontend → Cloudflare Workers

**Build & deploy:**
```bash
cd frontend
npm install
npm run build          # sinh ./dist
npx wrangler deploy    # đẩy lên Worker "throbbing-bar-16f0"
```

`wrangler.jsonc` cấu hình `assets.directory = ./dist` + `not_found_handling: single-page-application` (mọi route không khớp → `index.html` cho React Router).

**Biến môi trường build** (Vite "nướng" `VITE_*` lúc build — phải đặt TRƯỚC khi build):
- `VITE_API_BASE_URL = https://tranganh06uit-tarot-backend.hf.space`
- `VITE_GOOGLE_CLIENT_ID = <Google Web Client ID>`

> Khi build trên CI/dashboard Cloudflare, khai báo 2 biến này trong **Environment variables** của dashboard (file `.env.production` nằm trong `.gitignore` nên CI không thấy).

---

## 3. Database → Neon (PostgreSQL serverless)

Dữ liệu người dùng/lịch sử cần **bền vững** qua các lần rebuild Space.

- Tạo project Neon (free), lấy connection string, đặt vào secret `DATABASE_URL`:
  ```
  postgresql+psycopg2://USER:PASS@HOST/DB?sslmode=require
  ```
- Code tự chuẩn hoá scheme `postgres://` → `postgresql://`, bật `pool_pre_ping` + `pool_recycle=300` để chịu được Neon đóng kết nối nhàn rỗi.

---

## 4. Bật Đăng nhập Google (OAuth) — 3 bước cấu hình

> Code đã hoàn tất (FE + BE). Chỉ cần cấu hình, không sửa code.

**Bước 1 — Tạo OAuth Client ID:** vào https://console.cloud.google.com/apis/credentials → Create Credentials → OAuth client ID → **Web application**. Thêm **Authorized JavaScript origins** (không có `/` cuối):
- `https://throbbing-bar-16f0.trangtuananh.workers.dev`
- `http://localhost:5173` (để dev)

Copy **Client ID** dạng `xxxxx.apps.googleusercontent.com`. Dùng **cùng một Client ID** cho cả FE và BE (BE dùng làm *audience* khi verify token; lệch sẽ lỗi 401).

**Bước 2 — Frontend (Cloudflare):** đặt `VITE_GOOGLE_CLIENT_ID` + `VITE_API_BASE_URL` trong Environment variables → build lại.

**Bước 3 — Backend (HF Space):** đặt secret `GOOGLE_CLIENT_ID` (đúng bằng `VITE_GOOGLE_CLIENT_ID`) → Restart/Rebuild Space.

**Kiểm tra nhanh:**
```bash
curl -X POST https://tranganh06uit-tarot-backend.hf.space/api/auth/google \
  -H "Content-Type: application/json" -d '{"id_token":"test"}'
```
- `401 invalid google id_token` ⇒ ĐÚNG (lib có, client id đã set, chỉ token giả).
- `503 GOOGLE_CLIENT_ID is not configured` ⇒ chưa set secret.
- `503 google-auth library not installed` ⇒ Space chưa rebuild.

---

## 5. Chạy local (backup khi demo / chấm offline)

### Cách 1 — Docker Compose (khuyến nghị)
```bash
cd D:\LTWeb\github
# cần backend/.env (có GEMINI_API_KEY). Đổi code xong LUÔN kèm --build.
docker compose up --build
```
- Frontend: `http://localhost:5173` · Backend: `http://localhost:8000` (docs: `/docs`, health: `/api/health`)
- Docker đã có sẵn `ffmpeg` → giọng nói chạy được ngay.

### Cách 2 — Thủ công
```bash
# Backend
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # điền GEMINI_API_KEY
uvicorn src.main:app --reload --port 8000

# Frontend (terminal khác)
cd frontend && npm install
npm run dev
```
> ⚠️ Chạy backend local trên Windows cần **ffmpeg trong PATH** để xử lý audio `.webm` (cài: `winget install Gyan.FFmpeg`). Không có ffmpeg → ASR bỏ qua audio.

---

## 6. Checklist trước go-live

- [ ] `JWT_SECRET_KEY` ≥ 32 ký tự, không phải placeholder
- [ ] `APP_ENV=production` (bật strict mode auth)
- [ ] `EXPOSE_RESET_TOKEN_IN_RESPONSE=false`
- [ ] `API_ALLOWED_ORIGINS` chỉ chứa domain thật (không `localhost`, không `/` cuối)
- [ ] `GEMINI_API_KEY` đã hoạt động (test bằng `/api/ask`)
- [ ] `DATABASE_URL` trỏ Neon (để không mất dữ liệu khi rebuild)
- [ ] `GOOGLE_CLIENT_ID` (BE) = `VITE_GOOGLE_CLIENT_ID` (FE)
- [ ] `/api/health` trả `{"status":"ok","db":"ok"}`
- [ ] `pytest` toàn bộ pass · `npm run build` thành công

---

## 7. Hạn chế đã biết khi vận hành

1. **Rate limit & analytics in-memory** — chỉ đúng khi 1 process; multi-worker cần Redis.
2. **SQLite không bền** trên free tier — dùng Postgres (Neon).
3. **Model nặng RAM (~4GB)** — host nhỏ bật `VISION_DEMO_MODE=true`.
4. **ASR `large-v3` chậm trên CPU** — hạ xuống `base`/`small` cho demo mượt.
5. **Bundle có `three`/`ogl`** (~545KB cho WebGL) — có thể cắt nếu cần nhẹ hơn.
