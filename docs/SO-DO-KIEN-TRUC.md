# [CATAROT] SƠ ĐỒ KIẾN TRÚC

Phần này tập hợp các sơ đồ mô tả cách CATAROT được dựng nên: kiến trúc tổng thể, pipeline AI, cách dữ liệu chảy qua hệ thống khi đọc bài, và cách triển khai lên ba hạ tầng khác nhau. Mỗi sơ đồ đi kèm một đoạn diễn giải ngắn để người đọc nắm được ý chính trước khi nhìn vào hình.

---

## 1. Kiến trúc tổng thể (3 hạ tầng tách rời)

Hệ thống chia làm ba phần chạy độc lập. Frontend là một ứng dụng React 19 dựng bằng Vite 7, lo phần giao diện và điều hướng. Backend là một dịch vụ FastAPI gom mọi logic nghiệp vụ vào một chỗ, từ tầng HTTP xuống tầng dữ liệu. Sau cùng là cơ sở dữ liệu PostgreSQL, dùng Neon khi chạy thật và SQLite khi phát triển. Ba phần này được deploy ở ba nơi khác nhau, mỗi nơi hợp với một nhu cầu riêng.

```mermaid
flowchart TB
    User([" Người dùng / Trình duyệt"])

    subgraph FE["FRONTEND — React 19 + Vite 7"]
        direction TB
        Router["React Router v7 (SPA, lazy-load)"]
        Axios["axios + interceptor JWT<br/>tự logout khi 401"]
        Services["Service layer theo domain<br/>auth / tarot / daily / community / duo / history / visions"]
        Router --> Axios --> Services
    end

    subgraph BE["BACKEND — FastAPI monolith"]
        direction TB
        HTTP["Tầng HTTP (main.py)<br/>~50 REST + 1 WebSocket"]
        Svc["Tầng service (advanced/*, pipeline/*)"]
        Data["Tầng dữ liệu (SQLAlchemy 2.0)"]
        Sched["Schedulers (APScheduler, in-process)"]
        HTTP --> Svc --> Data
        Svc -.-> Sched
    end

    DB[("PostgreSQL — Neon (prod)<br/>SQLite (dev)")]
    LLM{{"LLM ngoài (chuỗi dự phòng)<br/>Gemini → OpenAI → Groq → Ollama"}}

    User -->|"HTTPS / WSS"| FE
    FE -->|"REST JSON + multipart<br/>JWT Bearer"| BE
    Data --> DB
    Svc -->|"HTTPS"| LLM

    FE -.->|"deploy"| CF["Cloudflare Workers (CDN)"]
    BE -.->|"deploy"| HF["Hugging Face Spaces (Docker)"]
    DB -.->|"deploy"| NE["Neon serverless"]
```

---

## 2. Pipeline AI đa phương thức (7 bước của `run_pipeline`)

Khi người dùng gửi một lượt đọc bài, hàm `run_pipeline` xử lý tuần tự qua nhiều bước. Giọng nói nếu có sẽ được chuyển thành chữ và phân tích cảm xúc; ảnh lá bài được nhận diện bằng thị giác máy. Câu hỏi dạng chữ, phần chuyển từ giọng nói và các lá bài nhận ra được gộp lại thành một truy vấn chung. Truy vấn đó đi qua bước RAG để lấy về các đoạn nghĩa lá liên quan, rồi đưa cho LLM sinh phần luận giải cuối cùng bằng tiếng Việt.

```mermaid
flowchart LR
    A["Audio"] --> ASR["① ASR<br/>faster-whisper"]
    A --> EMO["② Emotion<br/>phân tích tín hiệu"]
    IMG["Ảnh lá bài"] --> VIS["③ Vision<br/>OpenCLIP + FAISS"]
    Q["Câu hỏi (text)"] --> MERGE

    ASR -->|transcript| MERGE["⑤ Gộp query<br/>question + transcript"]
    VIS -->|cards| MERGE
    NOIMG["hoặc rút ngẫu nhiên<br/>(random_draw)"] -.-> MERGE

    MERGE --> RAG["⑥ RAG<br/>sentence-transformers + FAISS<br/>lọc theo lá + chiều"]
    RAG -->|"rag_snippets (≥3)"| LLM["⑦ LLM<br/>chuỗi dự phòng 4 tầng"]
    EMO -->|emotion_state| LLM
    LLM --> OUT["Luận giải Markdown<br/>tiếng Việt"]

    style ASR fill:#3b2a5a,stroke:#a855f7,color:#fff
    style VIS fill:#3b2a5a,stroke:#a855f7,color:#fff
    style RAG fill:#3b2a5a,stroke:#a855f7,color:#fff
    style LLM fill:#5a3a2a,stroke:#f5b042,color:#fff
    style OUT fill:#1f5a3a,stroke:#4ade80,color:#fff
```

---

## 3. Điểm nhấn — Chuỗi dự phòng LLM 4 tầng (graceful degradation)

Việc sinh luận giải phụ thuộc vào LLM bên ngoài, mà các dịch vụ này có thể hết quota hoặc lỗi mạng bất cứ lúc nào. Nhóm xử lý bằng một chuỗi dự phòng bốn tầng: thử Gemini trước, nếu hỏng thì chuyển dần xuống OpenAI, Groq rồi Ollama chạy cục bộ. Tầng nào trả về trước thì dùng tầng đó và ghi lại model đã dùng. Nếu cả bốn cùng hỏng, hệ thống vẫn còn một lớp fallback tất định dựng từ template và từ điển nghĩa lá, chạy được mà không cần internet, nên người dùng không bị kẹt ở màn hình trắng.

```mermaid
flowchart TD
    Start(["Cần sinh luận giải"]) --> G{"Tier 1: Gemini<br/>(xoay vòng nhiều key)"}
    G -->|OK| Done(["Trả luận giải<br/>+ ghi last_used_model"])
    G -->|"429 / lỗi"| O{"Tier 2: OpenAI<br/>(nếu có key)"}
    O -->|OK| Done
    O -->|"lỗi / bỏ qua"| GR{"Tier 3: Groq<br/>llama-3.3-70b (free)"}
    GR -->|OK| Done
    GR -->|"lỗi / bỏ qua"| OL{"Tier 4: Ollama<br/>local qwen2.5:3b"}
    OL -->|OK| Done
    OL -->|"lỗi / bỏ qua"| FB["Fallback tất định<br/>template + từ điển nghĩa lá<br/>(KHÔNG cần internet)"]
    FB --> Done

    style G fill:#3b2a5a,stroke:#a855f7,color:#fff
    style O fill:#2a3b5a,stroke:#60a5fa,color:#fff
    style GR fill:#2a3b5a,stroke:#60a5fa,color:#fff
    style OL fill:#2a3b5a,stroke:#60a5fa,color:#fff
    style FB fill:#5a3a2a,stroke:#f5b042,color:#fff
    style Done fill:#1f5a3a,stroke:#4ade80,color:#fff
```

---

## 4. Luồng đọc bài (Sequence Diagram)

Sơ đồ dưới đây theo chân một lượt đọc bài từ lúc người dùng gửi câu hỏi cho tới khi nhận lại kết quả. Sau khi đi qua rate limit và kiểm tra dữ liệu bằng Pydantic, backend lấy `user_id` từ JWT chứ không tin phần thân request, rồi gọi pipeline xử lý đa phương thức và LLM. Một điểm đáng chú ý là bước lưu kết quả vào cơ sở dữ liệu nuốt lỗi mềm: nếu ghi thất bại thì người dùng vẫn nhận được luận giải, chỉ là lần đọc đó không được lưu lại.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant FE as Frontend (axios)
    participant API as FastAPI (main.py)
    participant P as TarotPipeline
    participant L as LLM (4 tầng)
    participant DB as Database

    U->>FE: Nhập câu hỏi (+ ảnh / giọng nói)
    FE->>API: POST /api/ask* (JWT Bearer)
    API->>API: Rate limit + Pydantic validate
    API->>API: Lấy user_id từ JWT (không tin body)
    API->>P: run_pipeline(question, audio, images)
    P->>P: ASR → Emotion → Vision/Random
    P->>P: Gộp query → RAG (≥3 snippet)
    P->>L: generate(prompt)
    L-->>P: luận giải (hoặc fallback tất định)
    P-->>API: {cards, final_answer, warnings, llm_model}
    API->>DB: persist_reading_result (nuốt lỗi mềm)
    API-->>FE: JSON kết quả
    FE-->>U: Render Markdown + lá bài
```

---

## 5. Vision — Nhận diện lá bài & lá ngược

Để nhận ra một lá bài và biết nó đang xuôi hay ngược, hệ thống embed ảnh gốc bằng OpenCLIP rồi đem xoay 180° và embed thêm lần nữa. Cả hai bản đều được dò trong FAISS bằng cosine similarity; ảnh xoay nếu khớp thì đảo lại chiều cho đúng. Sau khi gộp ứng viên và chọn điểm cao nhất, độ tin cậy được tính từ khoảng cách giữa hai kết quả dẫn đầu. Nếu độ tin cậy chưa đạt ngưỡng, hệ thống không đoán bừa mà báo người dùng chụp lại hoặc tự chọn trong top-5.

```mermaid
flowchart TB
    IMG["Ảnh lá bài"] --> P1["Embed ảnh GỐC<br/>OpenCLIP ViT-B-32 → L2 norm"]
    IMG --> ROT["Xoay 180°"]
    ROT --> P2["Embed ảnh XOAY"]

    P1 --> S1["FAISS IndexFlatIP<br/>(= cosine similarity)"]
    P2 --> S2["FAISS IndexFlatIP"]
    S2 --> FLIP["Đảo orientation<br/>upright ↔ reversed"]

    S1 --> MERGE["Gộp ứng viên<br/>chọn điểm cao nhất"]
    FLIP --> MERGE
    MERGE --> CONF["confidence = (margin + 0.2) / 0.8<br/>margin = top1 − top2"]
    CONF --> CHK{"confidence ≥ 0.18?"}
    CHK -->|"Có"| OK["Lá + chiều + top-5"]
    CHK -->|"Không"| WARN["Cảnh báo chụp lại<br/>/ chọn từ top-5"]

    style MERGE fill:#3b2a5a,stroke:#a855f7,color:#fff
    style CONF fill:#5a3a2a,stroke:#f5b042,color:#fff
```

---

## 6. ERD — Cụm lõi đọc bài (7 bảng chính)

Đây là cụm bảng trung tâm của tính năng đọc bài. Mỗi lần đọc tạo ra một `READING_SESSIONS`, từ đó kéo theo các lá nhận diện được, phần luận giải (quan hệ 1-1), các lượt hội thoại và nhắc đánh giá. Tài khoản người dùng liên kết với phiên đọc theo kiểu SET NULL, nên khi xoá tài khoản thì các phiên cũ vẫn còn lại dưới dạng ẩn danh thay vì biến mất.

```mermaid
erDiagram
    USERS ||--o{ READING_SESSIONS : "sở hữu (SET NULL)"
    READING_SESSIONS ||--o{ RECOGNIZED_CARDS : "CASCADE"
    READING_SESSIONS ||--|| READINGS : "1-1 CASCADE"
    READING_SESSIONS ||--o{ CONVERSATION_TURNS : "CASCADE"
    READING_SESSIONS ||--o{ RATING_REMINDERS : "CASCADE"
    TAROT_CARDS ||--o{ RECOGNIZED_CARDS : "tham chiếu"

    USERS {
        int id PK
        string email UK "unique, index"
        string username UK "nullable"
        string password_hash "nullable (Google login)"
        string role "member / admin"
        string google_id UK "OAuth"
    }
    READING_SESSIONS {
        int id PK
        int user_id FK "SET NULL (khách ẩn danh)"
        text question_text
        string emotion_state
        string status "CHECK enum"
    }
    RECOGNIZED_CARDS {
        int id PK
        int session_id FK
        int card_id FK
        string orientation "CHECK: upright/reversed"
        float confidence
    }
    READINGS {
        int id PK
        int session_id FK "unique 1-1"
        text generated_text
        string llm_model
        int accuracy_score "1..5 nullable"
    }
    CONVERSATION_TURNS {
        int id PK
        int session_id FK
        string role "CHECK: user/assistant/system"
        int turn_index
    }
    TAROT_CARDS {
        int id PK
        string name UK
        string arcana_type
    }
```

---

## 7. Bản đồ 24 bảng theo cụm chức năng

Toàn bộ lược đồ có 24 bảng, nhưng để dễ hình dung thì nên nhóm chúng theo chức năng. Cụm lõi đọc bài là phần đã mô tả ở trên. Quanh nó là các cụm phụ trợ cho phân tích, đọc bài đôi, cộng đồng và một nhóm tính năng khác như nhật ký giấc mơ hay lá bài hằng ngày. Bảng `users` đóng vai trò trục chung, liên kết tới hầu hết các cụm.

```mermaid
flowchart TB
    subgraph C1["Lõi đọc bài (7)"]
        users
        tarot_cards
        reading_sessions
        recognized_cards
        readings
        conversation_turns
        rating_reminders
    end
    subgraph C2["Phân tích (3)"]
        user_archetype_profiles
        oracle_reports
        analytics_events
    end
    subgraph C3["Đọc bài đôi (4)"]
        duo_sessions
        duo_participants
        duo_cards
        duo_readings
    end
    subgraph C4["Cộng đồng (4)"]
        community_posts
        community_interpretations
        community_votes
        community_moderation_logs
    end
    subgraph C5["Tính năng khác (5)"]
        dream_entries
        daily_cards
        time_capsules
        notification_preferences
        notifications
    end

    users --> C2
    users --> C3
    users --> C4
    users --> C5
    reading_sessions --> C2
```

---

## 8. Đọc bài đôi — máy trạng thái (State Diagram)

Một phiên đọc bài đôi đi qua vài trạng thái rõ ràng. Chủ phòng tạo phòng và giữ slot A, hệ thống chờ người thứ hai vào slot B, rồi chờ cả hai rút đủ lá. Khi đã đủ hai lá, phiên chuyển sang gọi LLM, và việc gọi này được đặt ngoài transaction để cuộc gọi mạng kéo dài không giữ khoá cơ sở dữ liệu. Nếu sinh luận giải lỗi thì vẫn có fallback tất định để phiên không kẹt giữa chừng.

```mermaid
stateDiagram-v2
    [*] --> waiting_partner: tạo phòng (chủ phòng = slot A)
    waiting_partner --> waiting_cards: người thứ 2 join (slot B)
    waiting_cards --> generating: đủ 2 lá → gọi LLM (ngoài transaction)
    generating --> completed: có luận giải đôi
    generating --> failed: lỗi (có fallback tất định)
    completed --> [*]
    failed --> [*]
```

---

## 9. Cộng đồng + Auto-moderation (luồng kiểm duyệt)

Bài đăng cộng đồng ở chế độ ẩn danh và bắt đầu với trạng thái pending. Việc duyệt có thể do người thật làm, hoặc giao cho bot tự động. Bot này mặc định tắt và phải bật thủ công. Khi bật, nó chạy hai lớp: lớp đầu áp các luật cứng như độ dài, từ cấm, thông tin cá nhân và spam; lớp sau nhờ Gemini phân loại sâu hơn, có chống prompt injection. Chỉ những bài lớp hai khẳng định an toàn mới được duyệt; phần còn nghi ngờ hoặc khi LLM lỗi thì đẩy về cho người duyệt thay vì để bot tự quyết.

```mermaid
flowchart TD
    POST["Đăng bài (ẩn danh Seeker-XXXX)"] --> PEND["status = pending"]
    PEND --> Q{"Kiểm duyệt"}
    Q -->|"Admin thật"| H1["approve / reject"]
    Q -->|"Bot automod (opt-in, mặc định TẮT)"| L1["Lớp 1: luật<br/>độ dài, từ cấm, PII, spam"]
    L1 -->|"từ cấm rõ ràng"| REJ["reject (nếu bật autoreject)"]
    L1 -->|"nghi ngờ / sạch"| L2["Lớp 2: Gemini phân loại<br/>chống prompt injection"]
    L2 -->|"chắc chắn an toàn"| APP["approve"]
    L2 -->|"nghi ngờ / LLM lỗi"| ESC["escalate → giữ pending<br/>cho người duyệt"]
    H1 --> APP
    H1 --> REJ
    APP --> FEED["Hiện ở feed công khai"]

    style ESC fill:#5a3a2a,stroke:#f5b042,color:#fff
    style APP fill:#1f5a3a,stroke:#4ade80,color:#fff
    style REJ fill:#5a2a2a,stroke:#f87171,color:#fff
```

---

## 10. Triển khai (Deploy) — 3 nơi vì 3 nhu cầu

Sở dĩ ba phần được đặt ở ba nơi khác nhau là vì mỗi phần có nhu cầu riêng. Backend mang theo model AI nên cần nhiều RAM, hợp với Hugging Face Spaces chạy Docker. Frontend chỉ là tài nguyên tĩnh, cần phân phối nhanh nên đặt trên Cloudflare Workers. Còn cơ sở dữ liệu cần độ bền và sẵn sàng cao nên dùng PostgreSQL serverless của Neon. Trình duyệt nói chuyện với frontend, frontend gọi backend kèm JWT, và backend kết nối tới Neon qua kênh bắt buộc mã hoá.

```mermaid
flowchart LR
    subgraph U["Người dùng"]
        B["Trình duyệt"]
    end
    subgraph CF["Cloudflare Workers"]
        FE["Frontend static (dist/)<br/>SPA fallback<br/>throbbing-bar-16f0"]
    end
    subgraph HF["Hugging Face Spaces"]
        BE["FastAPI + model AI<br/>Docker, 16GB RAM CPU<br/>tranganh06uit-tarot-backend"]
    end
    subgraph NE["Neon"]
        DB[("PostgreSQL serverless")]
    end

    B -->|HTTPS| FE
    FE -->|"REST + JWT"| BE
    BE -->|"sslmode=require"| DB

    note["Lý do tách: BE cần RAM (model),<br/>FE cần CDN nhanh, DB cần bền vững"]
```

---

## 11. Xác thực (Auth) — Login & Google OAuth

Hệ thống hỗ trợ hai cách đăng nhập. Với cách thường, mật khẩu được kiểm bằng PBKDF2 200k vòng và so sánh theo `compare_digest` để tránh rò rỉ thời gian, đăng nhập thành công thì trả về JWT HS256 hạn 120 phút. Với Google, frontend nhận `id_token` từ Google rồi gửi lên backend; backend xác minh token với đúng audience là `GOOGLE_CLIENT_ID`, sau đó liên kết `google_id` vào tài khoản cũ hoặc tạo tài khoản mới với vai trò member trước khi cấp JWT.

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant FE as Frontend
    participant API as FastAPI
    participant G as Google

    rect rgb(40, 30, 60)
    note over U,API: Đăng nhập thường
    U->>FE: username/email + password
    FE->>API: POST /api/auth/login
    API->>API: verify PBKDF2 (200k vòng, compare_digest)
    API-->>FE: JWT HS256 (hạn 120 phút)
    end

    rect rgb(30, 40, 60)
    note over U,G: Đăng nhập Google
    U->>G: chọn tài khoản
    G-->>FE: id_token
    FE->>API: POST /api/auth/google
    API->>G: verify_oauth2_token(audience = GOOGLE_CLIENT_ID)
    G-->>API: payload (sub, email)
    API->>API: link google_id / tạo user (role member)
    API-->>FE: JWT
    end
```
