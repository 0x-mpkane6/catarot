# 📚 Tài liệu dự án — Tarot Multimodal Web App

Thư mục này chứa toàn bộ tài liệu báo cáo, thuyết trình và vận hành của đồ án.

## Mục lục

| Tài liệu | Nội dung | Dùng khi |
|----------|----------|----------|
| [**BAO-CAO-DO-AN.md**](./BAO-CAO-DO-AN.md) | Báo cáo kỹ thuật đầy đủ: kiến trúc, công nghệ, chức năng, bảo mật, deploy, kiểm thử | Đọc/nộp báo cáo chính |
| [**SO-DO-KIEN-TRUC.md**](./SO-DO-KIEN-TRUC.md) | 11 sơ đồ Mermaid: kiến trúc, pipeline AI, LLM fallback, ERD, sequence, state… | Chèn vào báo cáo / minh hoạ |
| [**HUONG-DAN-DEPLOY.md**](./HUONG-DAN-DEPLOY.md) | Triển khai HF + Cloudflare + Neon, bật Google login, chạy local | Deploy / vận hành |

## Số liệu hệ thống (đối chiếu code, bản final)

- **24 bảng** quan hệ (SQLAlchemy 2.0)
- **hơn 60 route** (REST + 1 WebSocket)
- **137 hàm test** trên 24 file (pytest)
- ~11.600 dòng Python (`backend/src`) + ~20.900 dòng JS/JSX/CSS (`frontend/src`)
- Bố cục mã nguồn chi tiết: [**BO-CUC-CODE.md**](./BO-CUC-CODE.md)
- LLM 4 tầng dự phòng: **Gemini → OpenAI → Groq → Ollama → template tất định**
