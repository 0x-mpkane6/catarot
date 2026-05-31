# Hướng dẫn bật Đăng nhập Google + Checklist Deploy

> Phần **code** đã hoàn tất (frontend + backend). Để Google login chạy thật trên web đã
> deploy, bạn chỉ cần làm **3 bước cấu hình** dưới đây (không cần sửa code nữa).

---

## Tóm tắt những gì đã được sửa trong code

**Frontend (React/Vite)**
- Thêm script Google Identity Services vào `index.html`.
- Component dùng chung `features/login/GoogleLoginButton.jsx`: nạp GIS, render nút Google
  chính thức, lấy `id_token` rồi gọi backend. Nếu thiếu `VITE_GOOGLE_CLIENT_ID` thì hiện nút
  dự phòng + báo "chưa cấu hình" (không crash).
- `services/authService.jsx`: thêm `loginWithGoogle`, `requestPasswordReset`, `resetPassword`;
  khôi phục `id` user; fallback username cho tài khoản Google.
- `LoginForm` + `SigninForm`: nút Google đã hoạt động (trước đây bấm không làm gì).
- `ForgotPasswordForm`: nút "Gửi" đã gọi API thật (trước đây là nút chết).
- Toàn bộ giao diện đã được **Việt hoá**.

**Backend (FastAPI)**
- `requirements.txt`: thêm `google-auth` (trước đây thiếu → endpoint Google luôn lỗi 503).
- `main.py`: kiểm tra JWT lúc khởi động (fail-fast ở production thay vì lỗi 500 âm thầm).
- `.env`: sửa tên biến cho khớp code (`JWT_SECRET_KEY`, `JWT_EXPIRE_MINUTES`).

---

## Bước 1 — Tạo OAuth Client ID trên Google Cloud Console

1. Vào https://console.cloud.google.com/apis/credentials → **Create Credentials** →
   **OAuth client ID** → Application type: **Web application**.
2. Mục **Authorized JavaScript origins**, thêm CHÍNH XÁC các origin (không có dấu `/` cuối):
   - `https://throbbing-bar-16f0.trangtuananh.workers.dev`  (frontend đã deploy)
   - `http://localhost:5173`  (để test khi dev)
3. Bấm **Create** → copy giá trị **Client ID** dạng `xxxxx.apps.googleusercontent.com`.

> Lưu ý: dùng **cùng một Client ID** cho cả frontend và backend (backend dùng nó làm
> *audience* để xác thực token; lệch nhau sẽ bị lỗi 401).

---

## Bước 2 — Cấu hình Frontend (Cloudflare)

Vite "nướng" biến `VITE_*` vào lúc **build**, nên phải đặt biến rồi **build lại**:

- Trên dashboard Cloudflare (Workers/Pages Build → Environment variables), thêm:
  - `VITE_GOOGLE_CLIENT_ID = <Client ID ở Bước 1>`
  - `VITE_API_BASE_URL = https://tranganh06uit-tarot-backend.hf.space`
- Build lại / redeploy frontend.

> Nếu build local: điền `VITE_GOOGLE_CLIENT_ID` vào `frontend/.env.production` rồi chạy
> `npm run build` (file này nằm trong `.gitignore` nên CI sẽ không thấy — phải khai báo trên dashboard).

---

## Bước 3 — Cấu hình Backend (HuggingFace Space)

Vào Space **Settings → Variables and secrets**, đặt **Secret**:
- `GOOGLE_CLIENT_ID = <Client ID ở Bước 1>` (đúng bằng `VITE_GOOGLE_CLIENT_ID`)

Rồi **Restart/Rebuild** Space để cài `google-auth` mới thêm vào `requirements.txt`.

Kiểm tra nhanh sau khi rebuild:
```
curl -X POST https://tranganh06uit-tarot-backend.hf.space/api/auth/google \
  -H "Content-Type: application/json" -d '{"id_token":"test"}'
```
- Trả `401 invalid google id_token` ⇒ ĐÚNG (lib đã cài, client id đã set, chỉ là token giả).
- Trả `503 GOOGLE_CLIENT_ID is not configured` ⇒ chưa set secret.
- Trả `503 google-auth library not installed` ⇒ Space chưa rebuild.

---

## Checklist Deploy (trạng thái hiện tại đã kiểm tra)

| Hạng mục | Trạng thái |
|---|---|
| Backend HF Space `/api/health` | ✅ `ok`, DB `ok` |
| CORS cho origin Cloudflare | ✅ đã cho phép (preflight trả đúng) |
| Đăng nhập thường (email/mật khẩu) | ✅ hoạt động (401 đúng cho sai mật khẩu, không 500) |
| JWT ở production | ✅ đã cấu hình trên Space |
| Google login – CODE | ✅ đã hoàn tất |
| Google login – CONFIG | ⛔ cần làm Bước 1–3 ở trên |
| Frontend build (`vite build`) | ✅ pass, lint sạch |
| Giao diện tiếng Việt | ✅ đã Việt hoá |

### Khuyến nghị thêm (không chặn deploy)
- **Dữ liệu lâu dài:** DB đang là SQLite trên Space → mất khi rebuild. Đặt `DATABASE_URL`
  trỏ Postgres (Neon free) để giữ user/lịch sử. Code đã hỗ trợ sẵn.
- **Khoá Gemini trong `backend/.env`:** chỉ nằm ở máy local (đã `.gitignore`, không bị commit).
  Nếu từng chia sẻ repo/màn hình, nên **xoay (rotate)** lại khoá cho an toàn.
