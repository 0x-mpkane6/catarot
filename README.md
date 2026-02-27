# Tarot 3-Card MVP

MVP nay tap trung vao 2 thao tac:

1. Bam nut de random 3 la (Past / Present / Future).
2. Bam nut de model tra ra:
   - y nghia tung la rieng le
   - y nghia tong hop cua ca 3 la

## 1) Cai dat nhanh

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

## 2) Cau hinh model

Ung dung duoc cau hinh theo huong `Ollama local` (khong dung API tra phi).

Mac dinh `LLM_PROVIDER=ollama`:

- App goi Ollama local (`http://localhost:11434`).
- Neu Ollama chua san sang, app dung fallback heuristic (khong dung API).

Co the doi model trong `.env`:

- `OLLAMA_MODEL=llama3.1:8b`

## 3) Chay app

```bash
python scripts/60_run_app.py
```

Sau khi mo app:

1. Bam `Random 3 la`
2. (Tuy chon) nhap cau hoi
3. Bam `Giai nghia 3 la`

App se hien thi:

- 3 la bai da rut
- y nghia tung la
- y nghia tong hop
