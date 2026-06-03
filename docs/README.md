# 📚 Tài liệu dự án — Tarot Multimodal Web App

Thư mục này chứa toàn bộ tài liệu báo cáo, thuyết trình và vận hành của đồ án.

## Mục lục

| Tài liệu | Nội dung | Dùng khi |
|----------|----------|----------|
| [**BAO-CAO-DO-AN.md**](./BAO-CAO-DO-AN.md) | Báo cáo kỹ thuật đầy đủ: kiến trúc, công nghệ, chức năng, bảo mật, deploy, kiểm thử | Đọc/nộp báo cáo chính |
| [**SO-DO-KIEN-TRUC.md**](./SO-DO-KIEN-TRUC.md) | 11 sơ đồ Mermaid: kiến trúc, pipeline AI, LLM fallback, ERD, sequence, state… | Chèn vào báo cáo / minh hoạ |
| [**slide-thuyet-trinh.html**](./slide-thuyet-trinh.html) | Bộ slide thuyết trình 15 trang (mở bằng trình duyệt) | Trình bày trước hội đồng |
| [**KICH-BAN-DEMO.md**](./KICH-BAN-DEMO.md) | Kịch bản demo 10 bước + phương án phòng sự cố + checklist | Chuẩn bị & chạy demo |
| [**HUONG-DAN-DEPLOY.md**](./HUONG-DAN-DEPLOY.md) | Triển khai HF + Cloudflare + Neon, bật Google login, chạy local | Deploy / vận hành |

## Số liệu hệ thống (đối chiếu code, bản final)

- **23 bảng** quan hệ (SQLAlchemy 2.0)
- **61 route** (~60 REST + 1 WebSocket)
- **109 hàm test** trên 21 file (pytest)
- ~8.600 dòng Python (`backend/src`) + ~17.600 dòng JS/JSX/CSS (`frontend/src`)
- LLM 4 tầng dự phòng: **Gemini → OpenAI → Groq → Ollama → template tất định**

## Mở slide thuyết trình

Nhấp đúp `slide-thuyet-trinh.html`, hoặc:
```powershell
Start-Process docs\slide-thuyet-trinh.html
```
Điều hướng: `→`/`Space` sang · `←` lùi · `F` toàn màn hình · phím số nhảy slide. Xuất PDF: duyệt hết slide một lượt (để sơ đồ render) rồi `Ctrl+P` → *Save as PDF* (bật *Background graphics*).

> Runbook vận hành chi tiết của từng phần nằm tại [`backend/README.md`](../backend/README.md) và [`frontend/README.md`](../frontend/README.md).
