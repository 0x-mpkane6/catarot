"""TTS — đọc luận giải tiếng Việt thành giọng nói (tầng Text-To-Speech).

synthesize_vietnamese(): sinh giọng nói tiếng Việt bằng mô hình VITS
`facebook/mms-tts-vie` chạy qua `transformers` (cùng họ kiến trúc với MeloTTS
nhưng KHÔNG thêm dependency nào — transformers đã có sẵn cho RAG/ASR). Văn bản
tiếng Việt là chữ Latin nên KHÔNG cần g2p/uroman. Trả về WAV PCM 16-bit, đóng gói
bằng thư viện chuẩn `wave` để không phụ thuộc soundfile/scipy (không có trong
image slim). Mọi lỗi suy biến mềm: trả None + cảnh báo, API không sập. Model được
nạp một lần và cache lại (lru_cache) đúng như pattern của tầng ASR.
"""
from __future__ import annotations

import importlib.util
import io
import os
import wave
from functools import lru_cache

import numpy as np

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

DEFAULT_TTS_MODEL = "facebook/mms-tts-vie"
DEFAULT_MAX_CHARS = 1200
DEFAULT_SAMPLE_RATE = 16000
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}
_PCM16_PEAK = 32767


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _tts_enabled() -> bool:
    return os.getenv("TTS_ENABLED", "true").strip().lower() in _BOOL_TRUE


def _max_chars() -> int:
    try:
        value = int(os.getenv("TTS_MAX_CHARS", str(DEFAULT_MAX_CHARS)))
    except (TypeError, ValueError):
        return DEFAULT_MAX_CHARS
    return max(1, value)


def _prepare_text(text: str | None, max_chars: int | None = None) -> tuple[str, list[str]]:
    """Chuẩn hoá + cắt bớt văn bản. Trả (text_đã_xử_lý, cảnh_báo)."""
    warnings: list[str] = []
    cleaned = (text or "").strip()
    if not cleaned:
        warnings.append("Không có nội dung để đọc.")
        return "", warnings

    limit = max_chars if max_chars is not None else _max_chars()
    if len(cleaned) > limit:
        cleaned = cleaned[:limit].rstrip()
        warnings.append(f"Văn bản dài hơn {limit} ký tự nên đã được cắt bớt khi đọc.")
    return cleaned, warnings


def _waveform_to_wav_bytes(waveform: np.ndarray, sample_rate: int) -> bytes:
    """Chuyển waveform float32 [-1, 1] -> WAV PCM 16-bit mono (little-endian)."""
    audio = np.asarray(waveform, dtype="float32").reshape(-1)
    audio = np.clip(audio, -1.0, 1.0)
    pcm16 = (audio * _PCM16_PEAK).astype("<i2")

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm16.tobytes())
    return buffer.getvalue()


@lru_cache(maxsize=1)
def _get_model_and_tokenizer():
    """Nạp model VITS + tokenizer một lần. Nặng → cache lại như ASR singleton."""
    from transformers import AutoTokenizer, VitsModel  # type: ignore

    model_name = os.getenv("TTS_MODEL", DEFAULT_TTS_MODEL)
    model = VitsModel.from_pretrained(model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model.eval()

    # Tốc độ đọc: mms VITS điều khiển qua speaking_rate (>1 nhanh hơn, <1 chậm hơn).
    speaking_rate = os.getenv("TTS_SPEAKING_RATE", "").strip()
    if speaking_rate:
        try:
            model.speaking_rate = float(speaking_rate)
        except (TypeError, ValueError):
            LOGGER.warning("TTS_SPEAKING_RATE không hợp lệ: %r", speaking_rate)
    return model, tokenizer


def synthesize_vietnamese(text: str | None) -> tuple[bytes | None, list[str]]:
    """Sinh WAV tiếng Việt từ văn bản. Trả (audio_bytes | None, cảnh_báo).

    Không bao giờ ném lỗi: thiếu thư viện / model lỗi -> None + cảnh báo.
    """
    warnings: list[str] = []

    if not _tts_enabled():
        warnings.append("Chức năng đọc giọng nói đang tắt (TTS_ENABLED=false).")
        return None, warnings

    cleaned, prep_warnings = _prepare_text(text)
    warnings.extend(prep_warnings)
    if not cleaned:
        return None, warnings

    if not _module_available("transformers"):
        warnings.append("Thiếu thư viện transformers; không thể tạo giọng đọc.")
        return None, warnings

    try:
        import torch  # type: ignore

        model, tokenizer = _get_model_and_tokenizer()
        inputs = tokenizer(cleaned, return_tensors="pt")

        seed = os.getenv("TTS_SEED", "").strip()
        if seed:
            try:
                torch.manual_seed(int(seed))  # VITS có duration ngẫu nhiên -> seed để tất định
            except (TypeError, ValueError):
                LOGGER.warning("TTS_SEED không hợp lệ: %r", seed)

        with torch.no_grad():
            output = model(**inputs)

        waveform = output.waveform.squeeze().detach().cpu().numpy()
        sample_rate = int(getattr(model.config, "sampling_rate", DEFAULT_SAMPLE_RATE))
        audio_bytes = _waveform_to_wav_bytes(waveform, sample_rate)
        return audio_bytes, warnings
    except Exception as exc:  # suy biến mềm — không làm sập API
        LOGGER.warning("TTS synthesis failed: %s", exc)
        warnings.append("Tạo giọng đọc thất bại; vui lòng thử lại sau.")
        return None, warnings
