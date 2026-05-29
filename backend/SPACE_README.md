---
title: Tarot Backend
emoji: 🔮
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 8000
pinned: false
license: mit
short_description: FastAPI backend for tarot reading (Vision + RAG + LLM)
---

# Tarot Backend trên HuggingFace Spaces

Backend FastAPI cho ứng dụng tarot, gồm:
- 🔮 **Vision pipeline** (OpenCLIP) nhận diện lá bài từ ảnh
- 📚 **RAG** (sentence-transformers + FAISS) tra cứu ý nghĩa lá bài
- 🎙️ **ASR** (faster-whisper) chuyển giọng nói sang text
- 🤖 **LLM** sinh luận giải tiếng Việt: Gemini → OpenAI → Ollama → template fallback
- 🔐 **Auth**: JWT, register/login by username|email, forgot/reset password, Google OAuth
- 👤 **Profile**: GET/PATCH avatar, bio, display_name, username
- 📜 **Sessions**: list + detail history của user

## API docs

Sau khi Space build xong, vào URL:
```
https://<username>-<space-name>.hf.space/docs
```

Để xem Swagger UI và test endpoints.

## Environment variables (Settings → Variables and secrets)

**Secrets** (KHÔNG bao giờ log/expose):
- `GEMINI_API_KEY` — lấy tại https://aistudio.google.com/apikey
- `JWT_SECRET_KEY` — sinh: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
- `GOOGLE_CLIENT_ID` — optional, cho Google login

**Variables** (config public):
- `APP_ENV=production`
- `OLLAMA_ENABLED=false`
- `EXPOSE_RESET_TOKEN_IN_RESPONSE=false`
- `API_ALLOWED_ORIGINS=https://<your-vercel-domain>.vercel.app`
- `GEMINI_MODEL=gemini-2.5-flash` (optional, mặc định flash)
- `ASK_RATE_LIMIT_MAX=20`
- `ASK_RATE_LIMIT_WINDOW=60`

## Health check

```
GET /api/health
→ {"status":"ok","version":"0.2.0","db":"ok",...}
```

## Lưu ý

- Lần build đầu mất 10-15 phút (tải vision/RAG/ASR models)
- Free tier 16GB RAM + 2 vCPU đủ cho demo
- DB SQLite lưu trong `/app/data/app.db` — Space sẽ persist qua restart
- Nếu cold-start chậm, đó là Space đang load model vào RAM lần đầu
