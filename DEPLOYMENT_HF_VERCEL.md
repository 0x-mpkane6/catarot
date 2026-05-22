# Deploy lên HuggingFace Spaces + Vercel (Free)

Hướng dẫn từng bước để mọi người truy cập được ứng dụng tarot của bạn:
- **Backend** (FastAPI + Vision + RAG + LLM) → HuggingFace Spaces (free, 16GB RAM)
- **Frontend** (Vite + React) → Vercel (free, có CDN + HTTPS)
- **Tổng chi phí: 0đ**, không cần credit card

Thời gian setup lần đầu: **~45 phút** (chủ yếu chờ HF build container).

---

## Chuẩn bị (5 phút)

### 0.1. Sinh JWT secret mới

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Lưu output này lại — sẽ dùng ở bước 1.4.

### 0.2. Lấy Gemini API key mới

Vào https://aistudio.google.com/apikey → **Create API key**. Copy key dạng `AIzaSy...`. Đừng share key này cho ai qua chat.

### 0.3. Push code lên GitHub

```bash
cd D:\LTWeb\github
git push origin tuananh
```

(Bạn đang ahead 17 commits, push lên để dùng cho các bước sau.)

---

## Phần 1: Backend → HuggingFace Spaces (20 phút)

### 1.1. Tạo HuggingFace account

1. Vào https://huggingface.co/join, đăng ký miễn phí
2. Verify email
3. Vào https://huggingface.co/settings/tokens → **Create new token** (chọn `write`), lưu lại

### 1.2. Tạo Space mới

Vào https://huggingface.co/new-space, điền:

| Field | Giá trị |
|---|---|
| **Space name** | `tarot-backend` (hoặc tên bạn thích) |
| **License** | MIT |
| **Select the Space SDK** | **Docker** → "Blank" |
| **Hardware** | CPU basic · 2 vCPU · 16GB (Free) |
| **Visibility** | Public |

Click **Create Space**.

### 1.3. Clone Space repo về máy và push code backend lên

Trong terminal:

```bash
# Vào thư mục tạm, clone Space về
cd D:\LTWeb
git clone https://huggingface.co/spaces/<your-hf-username>/tarot-backend hf-tarot-backend
cd hf-tarot-backend

# Copy toàn bộ backend từ project chính sang
# (LƯU Ý: KHÔNG copy .env, sẽ set qua HF Settings)
cp -r D:/LTWeb/github/backend/* .
cp -r D:/LTWeb/github/backend/.dockerignore .
cp -r D:/LTWeb/github/backend/.gitignore .

# Đổi tên SPACE_README.md thành README.md (HF Space dùng file này)
# Nếu Space đã có README.md mặc định, xoá đi rồi rename
rm -f README.md
mv SPACE_README.md README.md

# Xoá .env nếu có copy nhầm + xoá local data
rm -rf .env data/ tmp_uploads/ __pycache__/

# Git LFS nếu có file > 10MB (kiểm tra)
find . -size +10M -not -path "./.git/*" 2>/dev/null
# Nếu có output → cần `git lfs track "*.faiss"` v.v.

# Commit + push
git add .
git commit -m "Initial deploy to HF Spaces"
git push
```

Push xong, HF tự động build container. Theo dõi tại:
```
https://huggingface.co/spaces/<your-hf-username>/tarot-backend
```

Tab **Logs** → **Build logs** xem progress. Khoảng 10-15 phút.

### 1.4. Set environment variables / secrets

Trong khi chờ build, vào Space → **Settings** (icon ⚙️ ở góc trên) → **Variables and secrets**.

**Click "New secret"** rồi add từng cái:

| Key | Value | Loại |
|---|---|---|
| `GEMINI_API_KEY` | Key Gemini từ bước 0.2 | 🔒 Secret |
| `JWT_SECRET_KEY` | Random string từ bước 0.1 | 🔒 Secret |
| `GOOGLE_CLIENT_ID` | (optional, nếu dùng Google login) | 🔒 Secret |

**Click "New variable"** add các cái public:

| Key | Value |
|---|---|
| `APP_ENV` | `production` |
| `OLLAMA_ENABLED` | `false` |
| `EXPOSE_RESET_TOKEN_IN_RESPONSE` | `false` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `ASK_RATE_LIMIT_MAX` | `20` |
| `ASK_RATE_LIMIT_WINDOW` | `60` |

(`API_ALLOWED_ORIGINS` chưa set vội — set sau khi có URL Vercel ở bước 2.5.)

Sau khi set xong, Space tự restart. Chờ build + boot lại ~5 phút.

### 1.5. Verify backend hoạt động

Khi Space chuyển status **Running** (xanh), test:

```
https://<your-hf-username>-tarot-backend.hf.space/api/health
```

Phải thấy JSON:
```json
{
  "status": "ok",
  "version": "0.2.0",
  "db": "ok",
  ...
}
```

Cũng thử Swagger UI:
```
https://<your-hf-username>-tarot-backend.hf.space/docs
```

Note lại URL `https://<your-hf-username>-tarot-backend.hf.space` để dùng ở bước 2.

---

## Phần 2: Frontend → Vercel (15 phút)

### 2.1. Tạo Vercel account

Vào https://vercel.com/signup → đăng nhập bằng GitHub. Authorize Vercel access repos.

### 2.2. Import project

1. Dashboard → **Add New** → **Project**
2. Chọn repo `llm-tarot-reader` (hoặc tên repo của bạn)
3. Vercel sẽ hỏi config:

| Field | Giá trị |
|---|---|
| **Project Name** | `tarot-frontend` (hoặc tên bạn thích) |
| **Framework Preset** | Vite (auto-detect) |
| **Root Directory** | Click **Edit** → chọn **`frontend`** ⚠️ |
| **Build Command** | `npm run build` (mặc định) |
| **Output Directory** | `dist` (mặc định) |

⚠️ **Quan trọng**: Phải set Root Directory = `frontend` vì repo là monorepo (cả backend + frontend).

### 2.3. Environment Variables

Expand **Environment Variables**, add:

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<your-hf-username>-tarot-backend.hf.space` (URL từ bước 1.5) |
| `VITE_GOOGLE_CLIENT_ID` | (optional) |

### 2.4. Deploy

Click **Deploy**. Khoảng 2-3 phút.

Khi xong, Vercel cho URL kiểu:
```
https://tarot-frontend-abcdef.vercel.app
```

Note lại URL này.

### 2.5. Update CORS ở backend (quan trọng!)

Quay lại HF Space → Settings → Variables → **New variable**:

| Key | Value |
|---|---|
| `API_ALLOWED_ORIGINS` | `https://tarot-frontend-abcdef.vercel.app` (URL Vercel từ 2.4) |

Click **Restart Space**.

(Nếu sau này bạn có custom domain, thêm vào list, ngăn cách bằng dấu phẩy.)

---

## Phần 3: Test end-to-end (5 phút)

Mở URL Vercel `https://tarot-frontend-xxxxx.vercel.app` trên browser:

| Test | Cách | Kết quả mong đợi |
|---|---|---|
| **Đăng ký** | Click "Sign up" → nhập email + password + username | Vào trang home |
| **Đăng nhập username** | Logout → login với username | Vào được |
| **Đăng nhập email** | Logout → login với email | Vào được |
| **Quên mật khẩu** | Click "Forgot password" → nhập email | Hiện message "Nếu email tồn tại..." |
| **Hỏi tarot** | Nhập câu hỏi tiếng Việt → submit | LLM trả lời tiếng Việt + markdown đẹp |
| **Profile** | Vào /profile → đổi avatar URL + bio → save | Refresh vẫn còn |
| **History** | Sidebar hiện list session đã hỏi | Click vào → xem lại |

Nếu thấy lỗi:
- **CORS error**: chưa set `API_ALLOWED_ORIGINS` đúng → quay lại 2.5
- **502/503 từ HF**: Space chưa boot xong → đợi thêm 2-3 phút, F5
- **LLM trả về English**: `GEMINI_API_KEY` chưa set hoặc sai
- **Login fail**: check Space logs, có thể DB chưa migrate

---

## Phần 4: Custom domain (optional, +10 phút)

### 4.1. Mua domain (rẻ nhất ~$1/năm tại Namecheap, Porkbun)

### 4.2. Add domain vào Vercel

Project Settings → Domains → Add `your-domain.com`. Vercel chỉ DNS records cần set.

### 4.3. HF Space custom domain

Settings → **General** → **Custom Domain** (Pro plan only, free thì giữ `.hf.space`).

---

## Troubleshooting

### Build HF Space fail

Check **Build logs**. Lỗi thường gặp:

- `OSError: libGL.so.1: cannot open shared object file` → Dockerfile thiếu `libgl1`, đã có sẵn rồi
- `Killed` lúc `pip install torch` → dùng `torch>=2.2 --index-url https://download.pytorch.org/whl/cpu` để tránh GPU build nặng. Đã set trong requirements.
- `Out of disk space` → giảm số dep trong requirements.txt. HF free 50GB đủ

### Space boot 10+ phút mỗi lần restart

Lần đầu Space tải vision/RAG models (~1.5GB) → chậm. Sau khi cache vào `/app/.cache/huggingface`, restart sẽ nhanh hơn.

### Vercel build fail

- `react-hot-toast not found` → `npm install` chưa chạy. Vercel auto chạy, nếu fail check Build Logs
- `Cannot find module` → check `package.json` có đầy đủ deps không, push lại

### CORS error trên browser console

```
Access to fetch at 'https://...hf.space/api/...' from origin 'https://...vercel.app'
has been blocked by CORS policy
```

→ HF Space chưa set `API_ALLOWED_ORIGINS` đúng URL Vercel. Set + restart Space.

### Database mất sau khi Space restart

HF Spaces có **persistent storage** nhưng cần config. Mặc định `/app/data` được persist. Nếu mất, check Space settings → Storage.

### Rate limit 429 quá sớm

Default `/api/ask` là 20 req/60s. Tăng bằng env `ASK_RATE_LIMIT_MAX=50` ở HF Space.

---

## Auto-redeploy khi push code

Cả 2 platform support auto-deploy:

### HF Space
HF Space đã clone riêng → push lên Space repo, không phải GitHub. Mỗi lần update backend:

```bash
cd D:\LTWeb\hf-tarot-backend
cp -r D:/LTWeb/github/backend/src/* ./src/
# (hoặc rsync cụ thể file đã đổi)
git add . && git commit -m "Update" && git push
```

HF Space sẽ rebuild tự động.

**Hoặc setup GitHub Actions** sync GitHub → HF Space (advanced).

### Vercel
Vercel watch nhánh `tuananh` (hoặc `main`). Mỗi `git push origin tuananh` → auto deploy.

---

## URL cuối cùng

Khi xong:

- **Frontend (cho user)**: `https://tarot-frontend-xxxxx.vercel.app`
- **Backend API docs**: `https://<username>-tarot-backend.hf.space/docs`
- **Health check**: `https://<username>-tarot-backend.hf.space/api/health`

Share URL Vercel cho bạn bè / thầy cô là xong.

---

## Bảo trì

- **Gemini quota**: free 1500 req/ngày, 15 req/phút. Nếu hết, đổi `GEMINI_API_KEY` (key khác) hoặc đợi reset 00:00 UTC.
- **HF Space sleep**: Space free sẽ sleep sau 48h không có request. Truy cập 1 lần để wake up (cold start ~30s).
- **Vercel**: không sleep, luôn online.
- **Logs**: HF Space → Logs tab; Vercel → Project → Deployments → click deployment → Logs.

---

## Plan B nếu HF Space không đủ RAM

Nếu vision/RAG bị OOM trên 16GB:

1. Set env `VISION_DEMO_MODE=true` để dùng fallback embedder nhỏ
2. Hoặc upgrade Space lên CPU upgrade ($0.03/h) hoặc T4 GPU ($0.60/h)
3. Hoặc deploy backend lên VPS DigitalOcean $6/tháng (1GB RAM dư sức)
