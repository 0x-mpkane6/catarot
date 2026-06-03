# Kịch bản Demo cho buổi báo cáo — Tarot Multimodal Web App

> Mục tiêu: demo trơn tru 8–10 phút, làm nổi bật **đa phương thức (text/ảnh/giọng nói)** + **AI sinh luận giải** + **graceful degradation**, và **không bị "khựng"** khi sự cố.

---

## 0. Địa chỉ & lệnh cần nhớ

| Thành phần | Địa chỉ / lệnh |
|------------|----------------|
| **Frontend (live)** | <https://throbbing-bar-16f0.trangtuananh.workers.dev> |
| **Backend (live)** | <https://tranganh06uit-tarot-backend.hf.space> |
| **Swagger API docs** | <https://tranganh06uit-tarot-backend.hf.space/docs> |
| **Health check** | <https://tranganh06uit-tarot-backend.hf.space/api/health> |
| **Chạy local (full stack)** | `docker compose up --build` → FE `http://localhost:5173`, BE `http://localhost:8000` |
| **Chạy local (thủ công)** | BE: `cd backend && uvicorn src.main:app --port 8000` · FE: `cd frontend && npm run dev` |

---

## 1. CHUẨN BỊ TRƯỚC (làm 15–20 phút trước khi lên)

> ⚠️ Hugging Face free tier có **cold-start**: lần gọi đầu phải load model AI (~4GB) vào RAM, có thể mất **1–3 phút**. ĐỪNG để thầy thấy màn hình treo lần đầu.

**Checklist:**

- [ ] **"Đánh thức" backend:** mở `…/api/health` trước. Đợi đến khi trả `{"status":"ok","db":"ok"}`. Bấm thử một lần đọc bài text để model nạp sẵn vào RAM.
- [ ] **Mở sẵn các tab** (theo thứ tự demo): `health` → `/docs` (Swagger) → trang chủ frontend → 1 tab ẩn danh thứ 2 (để demo Duo cần 2 tài khoản).
- [ ] **Tạo sẵn 1–2 tài khoản test** (vì SQLite trên HF free tier có thể **mất dữ liệu** sau rebuild — xem mục 5). Đăng nhập sẵn 1 tài khoản.
- [ ] **Chuẩn bị tài nguyên demo:**
  - 1–3 **ảnh lá bài Tarot** rõ nét (để demo Vision). Lưu sẵn trong máy.
  - 1 **file ghi âm câu hỏi** (.wav/.mp3) hoặc mic hoạt động tốt (để demo ASR + cảm xúc).
- [ ] **Backup local sẵn sàng:** chạy `docker compose up --build` ở máy (hoặc đã build sẵn) để nếu HF/mạng hỏng thì chuyển sang `localhost` ngay. Local dùng SQLite riêng nên luôn chạy được.
- [ ] **Quay sẵn 1 video demo (2–3 phút)** làm "phao cứu sinh": nếu mạng phòng học chập chờn, chiếu video thay vì demo trực tiếp.
- [ ] (Nếu demo phần Admin) Xác nhận email của bạn nằm trong biến `ADMIN_EMAILS` trên HF Space để có quyền vào hàng đợi kiểm duyệt.

---

## 2. KỊCH BẢN DEMO (trình tự kể chuyện, ~8–10 phút)

### Bước 1 — "Backend sống và có tài liệu tự sinh" (30 giây)

- Mở `/api/health` → chỉ vào `{"status":"ok","version":"0.2.0","db":"ok"}`.
- Mở `/docs` (Swagger UI) → "Toàn bộ ~50 endpoint được FastAPI tự sinh tài liệu, có thể test trực tiếp."
- **Câu nói:** *"Backend là FastAPI, mọi API đều được mô tả và test được ngay tại đây."*

### Bước 2 — Đăng nhập (45 giây)

- Đăng nhập tài khoản test (hoặc **Đăng nhập Google** nếu muốn khoe OAuth).
- **Câu nói:** *"Hệ thống dùng JWT; mật khẩu băm PBKDF2 200.000 vòng; có cả đăng nhập Google qua OAuth."*

### Bước 3 — ⭐ Đọc bài bằng VĂN BẢN (1,5 phút) — **luồng an toàn nhất, demo đầu tiên**

- Nhập một câu hỏi đời thường, ví dụ: *"Tháng này chuyện công việc của em sẽ thế nào?"*
- Chọn 3 lá ở lưới → chờ kết quả luận giải Markdown hiện ra.
- **Câu nói:** *"Đây là pipeline lõi: câu hỏi → tra cứu ý nghĩa lá bài bằng RAG → LLM sinh luận giải tiếng Việt. RAG giúp AI bám vào nghĩa lá thật, giảm bịa."*
- Mẹo: chỉ vào phần kết quả có cấu trúc (tổng quan, từng lá, lời khuyên) để cho thấy AI viết mạch lạc.

### Bước 4 — ⭐ Đọc bài bằng ẢNH (1,5 phút) — **điểm nhấn đa phương thức**

- Tải lên ảnh lá bài thật đã chuẩn bị → hệ thống nhận diện lá + chiều (xuôi/ngược).
- **Câu nói:** *"Phần này dùng OpenCLIP sinh embedding ảnh rồi FAISS tìm lá giống nhất bằng cosine similarity. Đặc biệt: để nhận biết lá NGƯỢC, em xoay ảnh 180° rồi so khớp lại — không cần ảnh huấn luyện riêng."*
- Nếu nhận diện sai/độ tin cậy thấp: chỉ vào cảnh báo "chụp lại / chọn từ top-5" → *"hệ thống tự đánh giá độ tin cậy dựa trên khoảng cách điểm giữa ứng viên nhất và nhì."*

### Bước 5 — Đọc bài bằng GIỌNG NÓI (1 phút) — nếu mic/file ổn

- Thu âm hoặc tải file câu hỏi → cho thấy transcript hiện ra + luận giải.
- **Câu nói:** *"Giọng nói được faster-whisper chuyển thành chữ, tự nhận biết Việt/Anh. Em còn phân tích cảm xúc giọng nói bằng tín hiệu âm thanh để AI điều chỉnh giọng văn đồng cảm hơn."*

### Bước 6 — Hỏi tiếp trong cùng phiên (45 giây)

- Gõ câu hỏi nối tiếp, ví dụ *"Vậy em nên ưu tiên điều gì trước?"*
- **Câu nói:** *"Hội thoại giữ ngữ cảnh: 8 lượt gần nhất giữ nguyên, các lượt cũ được tóm tắt để AI trả lời mạch lạc mà không tốn token."*

### Bước 7 — Tính năng giữ chân: Daily Card + Streak (45 giây)

- Mở mục Tarot hằng ngày → rút lá hôm nay → chỉ vào streak + câu khẳng định (affirmation).
- **Câu nói:** *"Mỗi ngày 1 lá, có chuỗi streak kiểu Duolingo để tạo thói quen quay lại. Câu khẳng định sinh tất định theo lá+ngày nên không tốn LLM."*

### Bước 8 — Cộng đồng (1 phút)

- Đăng 1 bài (ẩn danh) → vào feed → thêm luận giải / vote.
- **Câu nói:** *"Đăng ẩn danh dưới bí danh Seeker-XXXX. Bài phải qua kiểm duyệt mới hiển thị. Có cả bot tự kiểm duyệt opt-in, nhưng nghi ngờ thì luôn chuyển cho người duyệt — an toàn là trên hết."*

### Bước 9 — Đọc bài đôi / Visions Vault (1 phút) — chọn 1 nếu còn thời gian

- **Duo:** mở 2 tab (2 tài khoản), tạo phòng → join bằng invite code → mỗi bên nộp 1 lá → nhận luận giải tương hợp.
- **Hoặc Visions Vault:** tạo 1 Time Capsule (niêm phong dự đoán) hoặc ghi 1 giấc mơ → cho thấy ánh xạ biểu tượng → lá bài.

### Bước 10 — Lịch sử + đóng (30 giây)

- Mở Lịch sử trải bài → mở lại 1 phiên cũ.
- **Câu chốt:** *"Toàn bộ chạy miễn phí trên free tier, và quan trọng nhất: kể cả khi LLM hết quota hay mất mạng, hệ thống vẫn trả luận giải nhờ chuỗi dự phòng 4 tầng — đó là nguyên tắc graceful degradation xuyên suốt đồ án."*

---

## 3. (Tuỳ chọn) Khoe điểm kỹ thuật trên Swagger

Nếu thầy muốn xem "ruột":

- Trong response của `/api/ask`, chỉ vào trường **`llm_model`** (ví dụ `gemini:gemini-2.5-flash` hoặc `deterministic-fallback`) → *"hệ thống ghi lại đúng tầng nào đã trả lời."*
- Chỉ vào mảng **`warnings`** → *"mọi sự cố mềm được gom vào đây thay vì ném lỗi 500."*

---

## 4. XỬ LÝ SỰ CỐ KHI DEMO (quan trọng)

| Tình huống | Cách xử lý tại chỗ |
|------------|---------------------|
| **Lần gọi đầu treo lâu** | Bình tĩnh: *"Đây là cold-start, Space đang nạp ~4GB model vào RAM."* (Nên đã đánh thức trước ở mục 1.) |
| **LLM chậm / trả fallback tất định** | **Biến thành điểm cộng:** *"Gemini đang hết quota nên hệ thống tự nhảy sang tầng dự phòng — đây chính là graceful degradation em trình bày."* |
| **Mạng phòng học chập chờn** | Chuyển sang **local** (`localhost:5173` đã chạy `docker compose`), hoặc chiếu **video demo** đã quay sẵn. |
| **Nhận diện ảnh sai** | Chỉ vào cảnh báo độ tin cậy + danh sách top-5: *"hệ thống không giả vờ chắc chắn; nó báo người dùng chọn lại."* |
| **Mất dữ liệu tài khoản** (HF rebuild) | Đăng ký nhanh tài khoản mới ngay tại chỗ (10 giây), hoặc dùng tài khoản local. |
| **Google login lỗi** | Chuyển sang đăng nhập username/password thường (đã chuẩn bị tài khoản test). |

---

## 5. Lưu ý về dữ liệu (đọc kỹ trước khi demo)

- SQLite trong container HF **không bền vững** qua restart/rebuild free tier → có thể mất user/lịch sử bất ngờ.
- **Khuyến nghị:** đảm bảo biến `DATABASE_URL` trên HF Space đã trỏ **Postgres (Neon)** để dữ liệu bền. Nếu chưa, hãy **tạo tài khoản + vài phiên đọc mẫu ngay trước buổi demo** để có sẵn lịch sử minh hoạ.
- Phương án chắc ăn nhất cho phần "lịch sử": demo trên **bản local** (dữ liệu nằm trong volume Docker của bạn, không mất).

---

## 6. Tài nguyên cần mang theo (checklist cuối)

- [ ] Laptop đã `docker compose up` sẵn (backup local đang chạy).
- [ ] 1–3 ảnh lá bài Tarot rõ nét.
- [ ] 1 file audio câu hỏi (hoặc mic tốt).
- [ ] 2 tài khoản test (cho Duo) + 1 tài khoản admin (nếu demo kiểm duyệt).
- [ ] Video demo dự phòng (2–3 phút).
- [ ] Mở sẵn: `health`, `/docs`, frontend, slide thuyết trình.
- [ ] Sạc đầy pin + mang sạc; thử mạng phòng học trước nếu được.
