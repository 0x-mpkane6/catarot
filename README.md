# 🔮 Tarot Multimodal Web App

Ứng dụng web đọc bài Tarot **đa phương thức** — đặt câu hỏi bằng **văn bản, giọng nói, hoặc ảnh chụp lá bài thật**; hệ thống nhận diện lá bài, tra cứu ý nghĩa (RAG) và sinh **luận giải tiếng Việt** bằng AI. Kèm hệ tính năng giữ chân: lá bài hằng ngày + streak, viên nang thời gian, nhật ký giấc mơ, đọc bài đôi realtime, cộng đồng có kiểm duyệt.

| | |
|---|---|
| **Frontend** | React 19 + Vite 7 → Cloudflare Workers |
| **Backend** | FastAPI (Vision + RAG + ASR + LLM) → Hugging Face Spaces |
| **Database** | PostgreSQL (Neon) / SQLite (dev) |
| **Live** | FE: `throbbing-bar-16f0.trangtuananh.workers.dev` · API: `tranganh06uit-tarot-backend.hf.space/docs` |

## 🚀 Chạy nhanh (Docker)

```bash
# cần backend/.env (có GEMINI_API_KEY)
docker compose up --build
```
Frontend `http://localhost:5173` · Backend `http://localhost:8000/docs`

## 📚 Tài liệu

Toàn bộ báo cáo và sơ đồ nằm trong thư mục [**`docs/`**](./docs/):

- 📄 [Báo cáo đồ án](./docs/BAO-CAO-DO-AN.md) — kiến trúc · công nghệ · chức năng
- 🗺️ [Sơ đồ kiến trúc (Mermaid)](./docs/SO-DO-KIEN-TRUC.md)

Runbook vận hành: [`backend/README.md`](./backend/README.md) · [`frontend/README.md`](./frontend/README.md)

## 🧱 Cấu trúc repo

```
.
├── backend/      # FastAPI: pipeline AI, auth, DB, schedulers
├── frontend/     # React SPA
├── alembic/      # DB migrations
├── docs/         # 📚 báo cáo, sơ đồ, hướng dẫn
└── docker-compose.yml
```

## ✨ Điểm kỹ thuật nổi bật

- **Pipeline đa phương thức**: ASR (faster-whisper) · Vision (OpenCLIP + FAISS) · RAG (sentence-transformers) · LLM · TTS (mms-tts-vie, đọc luận giải tiếng Việt).
- **Graceful degradation**: mỗi tầng AI đều có dự phòng; LLM 4 tầng **Gemini → OpenAI → Groq → Ollama → template tất định** (chạy được cả khi mất mạng).
- **Bảo mật**: PBKDF2 200k vòng · JWT fail-fast · chống IDOR · rate limit · chống enumeration.
- **24 bảng**, **hơn 60 endpoint REST + 1 WebSocket**, **137 hàm test**.
