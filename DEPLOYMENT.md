# Hướng dẫn deploy

## Cấu trúc

```
github/
├── backend/        FastAPI + Vision/RAG/ASR + Gemini
├── frontend/       Vite + React
└── docker-compose.yml
```

## Bắt buộc trước khi deploy

### 1. Backend secrets

Tạo `backend/.env` (file đã có trong `.gitignore`):

```bash
# Generate JWT_SECRET_KEY:
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Các biến **bắt buộc** ở production:

```env
APP_ENV=production
JWT_SECRET_KEY=<random 48+ chars, KHÔNG dùng placeholder>
DATABASE_URL=sqlite:///./data/app.db    # hoặc Postgres URL
API_ALLOWED_ORIGINS=https://your-frontend-domain.com
EXPOSE_RESET_TOKEN_IN_RESPONSE=false     # production tuyệt đối false

# LLM (chọn 1 hoặc nhiều, fallback theo thứ tự):
GEMINI_API_KEY=<key thật, tạo tại https://aistudio.google.com/apikey>
GEMINI_MODEL=gemini-2.5-flash
OPENAI_API_KEY=                          # optional
OLLAMA_ENABLED=false                     # production thường false

# Rate limit cho /api/ask*
ASK_RATE_LIMIT_MAX=20
ASK_RATE_LIMIT_WINDOW=60

# Optional features
GOOGLE_CLIENT_ID=                        # cho /api/auth/google
SMTP_HOST=                                # cho email reminder
```

### 2. Frontend env

Tạo `frontend/.env`:

```env
VITE_API_BASE_URL=https://api.your-domain.com
VITE_GOOGLE_CLIENT_ID=                    # optional
```

### 3. Database migration

```bash
cd backend
alembic upgrade head
```

Nếu là DB cũ đã tạo bảng bằng `Base.metadata.create_all()`:
```bash
alembic stamp head    # mark là đã ở baseline, không re-create
```

## Cách 1: Docker Compose (đơn giản)

```bash
# Set env vars
cp backend/.env.example backend/.env       # rồi sửa giá trị thật
cp frontend/.env.example frontend/.env

# Build + run
docker compose up --build -d

# Logs
docker compose logs -f backend

# Stop
docker compose down
```

Truy cập: `http://localhost:5173` (frontend), `http://localhost:8000/docs` (API docs).

## Cách 2: Deploy riêng từng phần

### Backend (Render / Railway / Fly.io)

1. Tạo dịch vụ Python, build command:
   ```bash
   pip install -r requirements.txt
   ```
2. Start command:
   ```bash
   alembic upgrade head && uvicorn src.main:app --host 0.0.0.0 --port $PORT --workers 2
   ```
3. Set env vars theo phần 1 ở trên.
4. Mount persistent disk vào `/app/data` và `/app/models`.

### Frontend (Vercel / Netlify / Cloudflare Pages)

1. Build command: `npm run build`
2. Output dir: `dist`
3. Set env vars `VITE_API_BASE_URL` trỏ về backend đã deploy.
4. Cấu hình SPA fallback: nếu Vercel → tự động, nếu Netlify → file `_redirects`:
   ```
   /*    /index.html   200
   ```

## Tối ưu sau deploy

### Ảnh quá to (≥ 1 MB mỗi cái)

```
src/assets/images/landing/Tarot.png         1.5 MB
src/assets/images/homepage/magic-cat.png    2.2 MB
src/assets/images/landing/draft/*.png       2 MB mỗi cái
```

Convert sang WebP / resize bằng:

```bash
# Cài Pillow
pip install Pillow

# Script resize tất cả ảnh > 500KB xuống 1200px max, convert WebP
python -c "
from pathlib import Path
from PIL import Image
root = Path('frontend/src/assets/images')
for f in root.rglob('*.png'):
    if f.stat().st_size > 500_000:
        img = Image.open(f).convert('RGBA')
        img.thumbnail((1200, 1200))
        out = f.with_suffix('.webp')
        img.save(out, 'WEBP', quality=85)
        print(f'{f.name} -> {out.name}: {out.stat().st_size//1024}KB')
"
```

Sau đó sửa các `import` từ `.png` sang `.webp`.

### Tăng concurrency backend

Sửa `WEB_CONCURRENCY` trong docker-compose hoặc env:
```env
WEB_CONCURRENCY=4    # mặc định 2
```

Lưu ý: mỗi worker giữ 1 bản model vision/RAG trong RAM (~2 GB). 4 workers cần ~8 GB RAM.

### Vision/RAG models

Models faiss/sentence-transformers cần download lúc khởi động. Để tránh download mỗi lần restart:
- Mount `/app/models` từ persistent volume
- Pre-build vision/RAG index bằng `scripts/build_vision_index.py` và `scripts/build_rag_index.py` (nếu có)

## Checklist trước go-live

- [ ] `JWT_SECRET_KEY` set ≥ 32 chars, không phải placeholder
- [ ] `APP_ENV=production` (auth security sẽ enforce strict mode)
- [ ] `EXPOSE_RESET_TOKEN_IN_RESPONSE=false`
- [ ] `API_ALLOWED_ORIGINS` chỉ chứa domain thật, không có localhost
- [ ] `GEMINI_API_KEY` hoặc `OPENAI_API_KEY` set; key đã hoạt động (test bằng `/api/ask`)
- [ ] HTTPS bật (Let's Encrypt hoặc Cloudflare)
- [ ] Database backup schedule (SQLite: copy file, Postgres: pg_dump)
- [ ] Monitoring: gọi `/api/health` mỗi 30s, alert nếu fail
- [ ] Log rotation cấu hình
- [ ] `npm audit` báo 0 vulnerabilities
- [ ] `pytest` toàn bộ pass

## Known limitations

1. **Rate limit in-memory**: chỉ hoạt động khi 1 process. Multi-worker dùng Redis backend.
2. **Schedulers**: `start_analytics_scheduler` + `start_rating_scheduler` cần APScheduler (`pip install APScheduler`). Nếu không có sẽ log warning và disable.
3. **Vision/ASR/RAG**: cần dung lượng RAM lớn (~4 GB) cho model. Nếu host nhỏ, set `VISION_DEMO_MODE=true` để dùng fallback.
4. **Frontend bundle**: vendor-three.js là 545 KB (cho WebGL effects). Nếu không cần, bỏ `three`, `ogl` khỏi dependencies.
