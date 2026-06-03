# Sơ đồ kiến trúc (Mermaid) — Tarot Multimodal Web App

> Dán các khối này vào báo cáo Markdown (GitHub/VS Code render trực tiếp), hoặc xem trong slide HTML.
> Mọi sơ đồ bám sát mã nguồn thực tế ở trạng thái bản final.

---

## 1. Kiến trúc tổng thể (3 hạ tầng tách rời)

```mermaid
flowchart TB
    User([" Người dùng / Trình duyệt"])

    subgraph FE["🌐 FRONTEND — React 19 + Vite 7"]
        direction TB
        Router["React Router v7 (SPA, lazy-load)"]
        Axios["axios + interceptor JWT<br/>tự logout khi 401"]
        Services["Service layer theo domain<br/>auth / tarot / daily / community / duo / history / visions"]
        Router --> Axios --> Services
    end

    subgraph BE["⚙️ BACKEND — FastAPI monolith"]
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

    FE -.->|"deploy"| CF["☁️ Cloudflare Workers (CDN)"]
    BE -.->|"deploy"| HF["🤗 Hugging Face Spaces (Docker)"]
    DB -.->|"deploy"| NE["🟢 Neon serverless"]
```

---

## 2. Pipeline AI đa phương thức (7 bước của `run_pipeline`)

```mermaid
flowchart LR
    A["🎤 Audio"] --> ASR["① ASR<br/>faster-whisper"]
    A --> EMO["② Emotion<br/>phân tích tín hiệu"]
    IMG["📷 Ảnh lá bài"] --> VIS["③ Vision<br/>OpenCLIP + FAISS"]
    Q["⌨️ Câu hỏi (text)"] --> MERGE

    ASR -->|transcript| MERGE["⑤ Gộp query<br/>question + transcript"]
    VIS -->|cards| MERGE
    NOIMG["hoặc rút ngẫu nhiên<br/>(random_draw)"] -.-> MERGE

    MERGE --> RAG["⑥ RAG<br/>sentence-transformers + FAISS<br/>lọc theo lá + chiều"]
    RAG -->|"rag_snippets (≥3)"| LLM["⑦ LLM<br/>chuỗi dự phòng 4 tầng"]
    EMO -->|emotion_state| LLM
    LLM --> OUT["📜 Luận giải Markdown<br/>tiếng Việt"]

    style ASR fill:#3b2a5a,stroke:#a855f7,color:#fff
    style VIS fill:#3b2a5a,stroke:#a855f7,color:#fff
    style RAG fill:#3b2a5a,stroke:#a855f7,color:#fff
    style LLM fill:#5a3a2a,stroke:#f5b042,color:#fff
    style OUT fill:#1f5a3a,stroke:#4ade80,color:#fff
```

---

## 3. Điểm nhấn — Chuỗi dự phòng LLM 4 tầng (graceful degradation)

```mermaid
flowchart TD
    Start(["Cần sinh luận giải"]) --> G{"Tier 1: Gemini<br/>(xoay vòng nhiều key)"}
    G -->|OK| Done(["✅ Trả luận giải<br/>+ ghi last_used_model"])
    G -->|"429 / lỗi"| O{"Tier 2: OpenAI<br/>(nếu có key)"}
    O -->|OK| Done
    O -->|"lỗi / bỏ qua"| GR{"Tier 3: Groq<br/>llama-3.3-70b (free)"}
    GR -->|OK| Done
    GR -->|"lỗi / bỏ qua"| OL{"Tier 4: Ollama<br/>local qwen2.5:3b"}
    OL -->|OK| Done
    OL -->|"lỗi / bỏ qua"| FB["🛟 Fallback tất định<br/>template + từ điển nghĩa lá<br/>(KHÔNG cần internet)"]
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

```mermaid
flowchart TB
    IMG["📷 Ảnh lá bài"] --> P1["Embed ảnh GỐC<br/>OpenCLIP ViT-B-32 → L2 norm"]
    IMG --> ROT["Xoay 180°"]
    ROT --> P2["Embed ảnh XOAY"]

    P1 --> S1["FAISS IndexFlatIP<br/>(= cosine similarity)"]
    P2 --> S2["FAISS IndexFlatIP"]
    S2 --> FLIP["Đảo orientation<br/>upright ↔ reversed"]

    S1 --> MERGE["Gộp ứng viên<br/>chọn điểm cao nhất"]
    FLIP --> MERGE
    MERGE --> CONF["confidence = (margin + 0.2) / 0.8<br/>margin = top1 − top2"]
    CONF --> CHK{"confidence ≥ 0.18?"}
    CHK -->|"Có"| OK["✅ Lá + chiều + top-5"]
    CHK -->|"Không"| WARN["⚠️ Cảnh báo chụp lại<br/>/ chọn từ top-5"]

    style MERGE fill:#3b2a5a,stroke:#a855f7,color:#fff
    style CONF fill:#5a3a2a,stroke:#f5b042,color:#fff
```

---

## 6. ERD — Cụm lõi đọc bài (7 bảng chính)

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

## 7. Bản đồ 23 bảng theo cụm chức năng

```mermaid
flowchart TB
    subgraph C1["🔮 Lõi đọc bài (7)"]
        users
        tarot_cards
        reading_sessions
        recognized_cards
        readings
        conversation_turns
        rating_reminders
    end
    subgraph C2["📊 Phân tích (3)"]
        user_archetype_profiles
        oracle_reports
        analytics_events
    end
    subgraph C3["👥 Đọc bài đôi (4)"]
        duo_sessions
        duo_participants
        duo_cards
        duo_readings
    end
    subgraph C4["💬 Cộng đồng (4)"]
        community_posts
        community_interpretations
        community_votes
        community_moderation_logs
    end
    subgraph C5["✨ Tính năng khác (5)"]
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

```mermaid
flowchart LR
    subgraph U["Người dùng"]
        B["Trình duyệt"]
    end
    subgraph CF["☁️ Cloudflare Workers"]
        FE["Frontend static (dist/)<br/>SPA fallback<br/>throbbing-bar-16f0"]
    end
    subgraph HF["🤗 Hugging Face Spaces"]
        BE["FastAPI + model AI<br/>Docker, 16GB RAM CPU<br/>tranganh06uit-tarot-backend"]
    end
    subgraph NE["🟢 Neon"]
        DB[("PostgreSQL serverless")]
    end

    B -->|HTTPS| FE
    FE -->|"REST + JWT"| BE
    BE -->|"sslmode=require"| DB

    note["Lý do tách: BE cần RAM (model),<br/>FE cần CDN nhanh, DB cần bền vững"]
```

---

## 11. Xác thực (Auth) — Login & Google OAuth

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
