# Bao cao kien truc hien tai (code da co)

## 1) Muc tieu MVP dang co

Ung dung hien tai la MVP cho tarot 3 la, tap trung vao:

1. Random 3 la bai.
2. Sinh y nghia cho tung la rieng le.
3. Sinh y nghia tong hop cho ca bo 3 la.

Khong bao gom nhan dien la bai tu anh upload trong phien ban nay.
He thong da duoc chuan hoa theo huong `Ollama local`, khong dung API tra phi.

## 2) Cau truc source da co

```
d:/test/
  scripts/
    60_run_app.py
  src/
    tarot_mvp/
      data.py
      engine.py
      app.py
  data/raw/tarot_json/
    tarot-images.json
    cards/*.jpg
  requirements.txt
  .env.example
  README.md
```

## 3) Kien truc thanh phan

### 3.1 Lop Data (`src/tarot_mvp/data.py`)

- `TarotCard` (dataclass): mo ta metadata 1 la bai (`name`, `number`, `arcana`, `suit`, `image_file`).
- `load_tarot_cards(data_file)`: doc `tarot-images.json`, chuyen thanh danh sach `TarotCard`.
- Co validation co ban:
  - Bao loi neu khong tim thay file data.
  - Bao loi neu tong so la < 3.

### 3.2 Lop Domain + Inference (`src/tarot_mvp/engine.py`)

- `DrawnCard` (dataclass): gom `TarotCard` + `position` (Past/Present/Future) + `orientation` (Upright/Reversed).
- `draw_three_cards(cards)`: chon ngau nhien 3 la khong trung, gan vi tri co dinh:
  - La 1 -> Past
  - La 2 -> Present
  - La 3 -> Future
  - Moi la duoc gan orientation ngau nhien.

- `TarotInterpreter`: engine sinh noi dung luan giai, co 2 che do:
  - Ollama local
  - Heuristic fallback

#### Chien luoc chon provider

- Neu `LLM_PROVIDER=ollama` -> uu tien goi Ollama local.
- Neu `LLM_PROVIDER=auto` -> hanh vi tuong duong Ollama-first.
- Neu Ollama khong san sang -> chuyen sang heuristic fallback.
- Neu `LLM_PROVIDER=heuristic` -> bo qua model, dung fallback ngay.
- Neu `LLM_PROVIDER` gia tri khac -> fallback + canh bao gia tri hop le.

#### Output contract sau khi normalize

Engine dam bao output cuoi cung co dang:

```json
{
  "card_meanings": [
    {
      "card": "string",
      "position": "Past|Present|Future",
      "orientation": "Upright|Reversed",
      "meaning": "string"
    }
  ],
  "combined_meaning": "string",
  "provider": "ollama|heuristic",
  "model": "string",
  "warning": "optional string"
}
```

Ghi chu:

- `card_meanings` luon duoc normalize theo dung 3 la da rut.
- Neu model tra ve thieu/noi dung rong, engine dien thong diep fallback de khong vo giao dien.

### 3.3 Lop UI (`src/tarot_mvp/app.py`)

Su dung Gradio Blocks voi 2 action chinh:

1. Nut `Random 3 la` (`on_draw`)
   - Goi `draw_three_cards`.
   - Luu ket qua vao `gr.State`.
   - Hien thi markdown thong tin 3 la.
   - Hien thi gallery anh tu `data/raw/tarot_json/cards`.
   - Reset vung ket qua cu.

2. Nut `Giai nghia 3 la` (`on_interpret`)
   - Doc lai state 3 la.
   - Goi `TarotInterpreter.interpret(question, drawn_cards)`.
   - Render:
     - Y nghia tung la.
     - Y nghia tong hop.
     - Provider/model dang duoc dung + warning (neu co).

### 3.4 Entry point (`scripts/60_run_app.py`)

- Tu dong them project root vao `sys.path` de import duoc `src`.
- Goi `launch_app()` trong `src/tarot_mvp/app.py`.

## 4) Luong xu ly end-to-end

```
User click "Random 3 la"
  -> on_draw
  -> draw_three_cards
  -> state + card markdown + image gallery

User click "Giai nghia 3 la"
  -> on_interpret
  -> TarotInterpreter.interpret
     -> Ollama hoac Heuristic
     -> normalize output
  -> UI hien thi tung la + tong hop + provider info
```

## 5) Cau hinh runtime (env)

Tu `.env.example`:

- `LLM_PROVIDER`: `ollama|auto|heuristic`
- `OLLAMA_HOST`
- `OLLAMA_MODEL`
- `GRADIO_SERVER_NAME`
- `GRADIO_SERVER_PORT`

## 6) Phu thuoc hien tai

Tu `requirements.txt`:

- `gradio`
- `python-dotenv`

## 7) Cac diem da dam bao trong code

- Co fallback khong phu thuoc API (heuristic), app van chay duoc offline co ban.
- Co co che parse JSON output va cat chuoi de cuu truong hop model tra ve text kem JSON.
- Co normalize output de giao dien luon nhan du format.
- Co check state: neu chua random ma bam giai nghia se bao loi huong dan.

## 8) Gioi han hien tai

- Chua co upload anh user de nhan dang la bai.
- Chua co RAG index/noi dung y nghia tu corpus rieng.
- Chua co ASR/audio pipeline.
- Chua co bo test tu dong.
- Chua co logging/telemetry va phan quyen bao mat nang cao.

## 9) Ket luan

Kien truc hien tai la mot MVP nhe, tach thanh 3 lop ro rang:

1. Data loading (`data.py`)
2. Business + model orchestration (`engine.py`)
3. Presentation/UI (`app.py`)
