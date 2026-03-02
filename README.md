# Tarot Multimodal MVP

MVP cho seminar #1: nhận `question` + (optional) `audio` + ảnh lá bài, sau đó trả JSON chuẩn gồm `cards`, `rag_snippets`, `final_answer`, `warnings`.

## Quickstart
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
bash scripts/10_download_data.sh
python scripts/20_build_gallery.py
python scripts/30_build_vision_index.py
python scripts/40_build_rag_index.py
python scripts/60_run_app.py
```

## Expected UI output
- Input: question, optional audio, 1-3 ảnh tarot, spread type.
- Button: `Run Demo`.
- Output:
  - JSON đầy đủ theo schema (`question`, `transcript`, `spread_type`, `cards`, `rag_snippets`, `final_answer`, `warnings`)
  - Final answer text
  - Warning list nếu confidence thấp hoặc thiếu dữ liệu
  - Dropdown top candidates để user chọn lại cho card confidence thấp

## Smoke tests
```bash
pytest -q
```

## Notes
- Không yêu cầu training.
- Nếu thiếu model/index/API key, hệ thống tự fallback để không crash.
- Có thể bật share link Gradio bằng `GRADIO_SHARE=true` hoặc `python scripts/60_run_app.py --share`.
- ASR audio: lần chạy đầu sẽ tải model Whisper nhỏ (`openai/whisper-tiny`) nên có thể chậm 1 lần.
- Final answer: ưu tiên OpenAI nếu có `OPENAI_API_KEY`, nếu không sẽ gọi Ollama local (`OLLAMA_MODEL`, mặc định `qwen2.5:3b-instruct`), cuối cùng mới fallback template.
