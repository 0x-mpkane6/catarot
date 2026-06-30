```text                                                                                                                          
 ▄████████    ▄████████     ███        ▄████████    ▄████████  ▄██████▄      ███     
███    ███   ███    ███ ▀█████████▄   ███    ███   ███    ███ ███    ███ ▀█████████▄ 
███    █▀    ███    ███    ▀███▀▀██   ███    ███   ███    ███ ███    ███    ▀███▀▀██ 
███          ███    ███     ███   ▀   ███    ███  ▄███▄▄▄▄██▀ ███    ███     ███   ▀ 
███        ▀███████████     ███     ▀███████████ ▀▀███▀▀▀▀▀   ███    ███     ███     
███    █▄    ███    ███     ███       ███    ███ ▀███████████ ███    ███     ███     
███    ███   ███    ███     ███       ███    ███   ███    ███ ███    ███     ███     
████████▀    ███    █▀     ▄████▀     ███    █▀    ███    ███  ▀██████▀     ▄████▀   
                                                   ███    ███                         
                                                  
```

> **Thông tin nộp bài:** Link triển khai, bảng phân công công việc và các tài nguyên liên quan được tổng hợp tại [SUBMISSION.md](docs/SUBMISSION.md).

---

# CATAROT - Nền tảng xem Tarot trực tuyến bằng AI

**CATAROT** là ứng dụng web xem Tarot trực tuyến, kết hợp AI để hỗ trợ người dùng đặt câu hỏi, rút bài, lưu lại trải nghiệm cá nhân và tương tác với cộng đồng.

Dự án hướng đến một trải nghiệm xem Tarot hiện đại hơn: không chỉ dừng ở việc hiển thị ý nghĩa lá bài, mà còn hỗ trợ luận giải bằng tiếng Việt, xem bài hằng ngày, đọc bài đôi realtime và lưu trữ hành trình cảm xúc của người dùng.

---

## Tổng quan công nghệ

CATAROT được xây dựng theo kiến trúc **frontend và backend tách biệt**. Frontend chịu trách nhiệm hiển thị giao diện, điều hướng người dùng và gọi API; backend phụ trách xác thực, xử lý nghiệp vụ, AI pipeline, dữ liệu và các kết nối thời gian thực. Cách tổ chức này giúp hệ thống dễ bảo trì, dễ mở rộng và thuận tiện khi triển khai độc lập từng phần.

| Thành phần | Công nghệ sử dụng | Phiên bản |
| ---------- | ----------------- | --------- |
| FE | React + Vite + React Router DOM | React `19.2.0`, Vite `7.3.1`, React Router DOM `7.14.2` |
| BE | FastAPI + SQLAlchemy + Uvicorn, chạy trên Python | FastAPI `>=0.115`, SQLAlchemy `>=2.0`, Uvicorn `>=0.30`, Python `3.11` |
| Database | SQLite mặc định trong môi trường Docker; có hỗ trợ PostgreSQL khi cần mở rộng | SQLite `3` (mặc định), PostgreSQL qua `psycopg2-binary >=2.9` |
| Triển khai realtime | WebSocket cho trải bài đôi, có polling ở frontend để đồng bộ trạng thái khi cần | FastAPI WebSocket `>=0.115`, frontend polling dùng `setInterval` |
| Môi trường triển khai | Docker Compose, frontend build bằng Node và phục vụ qua Nginx, backend dùng Python slim image | Docker Compose, Node `20-alpine`, Nginx `alpine`, Python `3.11-slim` |

---

## Tính năng chính

* **Trải bài (Xem tarot cơ bản)**: Là nơi người dùng có thể đặt câu hỏi, tham gia rút bài ngay trên trang web để nhận được thông điệp. Ngoài ra tính năng còn hỗ trợ voice và nhận diện hình ảnh lá bài do người dùng tải lên.
* **Tarot hằng ngày**: Mỗi ngày, người dùng có thể rút một lá bài Tarot để nhận thông điệp dành riêng cho ngày hôm đó. Sau khi xem bài, họ có thể lưu lại thông điệp cùng những tâm sự cá nhân, đồng thời theo dõi chuỗi ngày liên tiếp rút bài thông qua hệ thống Streak.
* **Trải bài đôi**: Cho phép 2 người dùng tham gia cùng một phiên trải bài, mỗi người tải 1 lá bài của mình lên và nhận được thông điệp chung cho cả 2.
* **Phòng cộng đồng**: Một mạng xã hội thu nhỏ, nơi người dùng có thể chia sẽ trải nghiệm của mình cho những người khác.
* **Kho tầm nhìn**: Không gian lưu giữ những trải nghiệm cá nhân như giấc mơ, cảm xúc hoặc các “viên nang thời gian”, nơi người dùng có thể gói lại một thông điệp và hẹn ngày mở lại trong tương lai.

--- 

## Cấu trúc repo

```text
.
├── backend/              # FastAPI backend, auth, database, AI pipeline
├── frontend/             # React frontend
├── alembic/              # Database migrations
├── docs/                 # Báo cáo, sơ đồ kiến trúc, tài liệu kỹ thuật
├── docker-compose.yml    # Cấu hình chạy project bằng Docker
└── README.md
```

Các phần kỹ thuật, kiến trúc hệ thống và báo cáo đồ án được đặt trong thư mục [`docs/`](./docs/):

* [Báo cáo đồ án](./docs/BAO-CAO-DO-AN.md)
* [Bố cục mã nguồn](./docs/BO-CUC-CODE.md)
* [Sơ đồ kiến trúc](./docs/SO-DO-KIEN-TRUC.md)
* [Báo cáo triển khai trên mobile](./docs/BAO-CAO-MOBILE.md)

## Chạy với Docker

> Cần tạo file `backend/.env` trước khi chạy. Có thể tham khảo từ `.env.example` nếu có.

```bash
docker compose up --build
```

Sau khi chạy:

* Frontend: `http://localhost:5173`
* Backend API Docs: `http://localhost:8000/docs`

Nếu chỉ muốn chạy backend:

```bash
docker compose up --build backend
```

## Demo
CATAROT được triển khai tại: [**catarot.me**](https://catarot.me)

## CATAROT dành cho Android
Truy cập phiên bản Android của CATAROT tại: [catarot.apk](https://drive.google.com/file/d/1dT-3KA1HU891th71RXKiOeCdhEgM0wuv/view?usp=drive_link) 

---

> *Chúng em đã biết làm web và hiểu hệ thống web hoạt động như thế nào.*



