"""TTS — đọc luận giải tiếng Việt thành giọng nói (tầng Text-To-Speech).

synthesize_vietnamese(): sinh giọng nói tiếng Việt bằng **edge-tts** (giọng neural của
Microsoft Edge, mặc định `vi-VN-HoaiMyNeural`). Gọi dịch vụ online MIỄN PHÍ, KHÔNG cần
API key, KHÔNG cần GPU → nhanh hơn nhiều và tự nhiên hơn so với chạy model trên CPU. Trả
về MP3. Mọi lỗi suy biến mềm: trả None + cảnh báo, API không sập.

Trước đây dùng `facebook/mms-tts-vie` (VITS) chạy local qua transformers — chính xác nhưng
rất chậm trên CPU (vài chục giây cho một luận giải) và giọng máy móc.
"""
from __future__ import annotations

import asyncio
import importlib.util
import io
import os
import re
import wave

import numpy as np

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

DEFAULT_TTS_VOICE = "vi-VN-HoaiMyNeural"
DEFAULT_MAX_CHARS = 2000
DEFAULT_TTS_TIMEOUT = 30.0
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}
_PCM16_PEAK = 32767


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _tts_enabled() -> bool:
    return os.getenv("TTS_ENABLED", "true").strip().lower() in _BOOL_TRUE


def _voice() -> str:
    """Giọng đọc; đổi qua env TTS_VOICE (vd vi-VN-NamMinhNeural cho giọng nam)."""
    return os.getenv("TTS_VOICE", "").strip() or DEFAULT_TTS_VOICE


def _tts_timeout() -> float:
    """Hạn chờ edge-tts (giây); tránh treo vô hạn khi dịch vụ ngoài đơ. Đổi qua TTS_TIMEOUT_SECONDS."""
    try:
        return max(1.0, float(os.getenv("TTS_TIMEOUT_SECONDS", str(DEFAULT_TTS_TIMEOUT))))
    except (TypeError, ValueError):
        return DEFAULT_TTS_TIMEOUT


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


def _strip_markdown(text: str) -> str:
    """Bỏ ký hiệu markdown để giọng đọc KHÔNG phát thành tiếng các ký tự ## ** ` - 1. ...

    Chỉ phục vụ TTS (đầu vào giọng đọc); KHÔNG ảnh hưởng văn bản hiển thị trên UI.
    """
    t = text or ""
    t = re.sub(r"```[\s\S]*?```", " ", t)          # code fence
    t = re.sub(r"`([^`]*)`", r"\1", t)               # inline code
    t = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", t)      # heading
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)         # bold
    t = re.sub(r"\*([^*]+)\*", r"\1", t)             # italic
    t = re.sub(r"__([^_]+)__", r"\1", t)
    t = re.sub(r"(?m)^\s{0,3}>\s?", "", t)           # blockquote
    t = re.sub(r"(?m)^\s{0,3}[-*+]\s+", "", t)       # bullet
    t = re.sub(r"(?m)^\s{0,3}\d+\.\s+", "", t)       # numbered
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)   # link -> text
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def _waveform_to_wav_bytes(waveform: np.ndarray, sample_rate: int) -> bytes:
    """Chuyển waveform float32 [-1, 1] -> WAV PCM 16-bit mono (little-endian).

    Tiện ích thuần (vẫn có test); không còn dùng cho luồng tổng hợp hiện tại (edge-tts trả MP3).
    """
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


async def _edge_synthesize(text: str, voice: str) -> bytes:
    """Gọi edge-tts, gom các chunk audio MP3 thành bytes."""
    import edge_tts  # type: ignore

    communicate = edge_tts.Communicate(text, voice)
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            audio.extend(chunk["data"])
    return bytes(audio)


def synthesize_vietnamese(text: str | None) -> tuple[bytes | None, int, list[str]]:
    """Sinh MP3 tiếng Việt từ văn bản. Trả (audio_bytes | None, spoken_end, cảnh_báo).

    `spoken_end` = số ký tự của văn bản gốc mà audio THỰC SỰ đọc tới (= độ dài phần đã
    chuẩn hoá/cắt bớt). Dùng cho karaoke ở frontend để ánh xạ tiến độ giọng nói lên đúng
    đoạn văn bản được đọc (không lệ thuộc độ dài markdown đầy đủ / phần bị cắt). 0 nếu không
    sinh được audio.

    Không bao giờ ném lỗi: thiếu thư viện / lỗi mạng / dịch vụ lỗi -> (None, 0, cảnh báo).
    """
    warnings: list[str] = []

    if not _tts_enabled():
        warnings.append("Chức năng đọc giọng nói đang tắt (TTS_ENABLED=false).")
        return None, 0, warnings

    cleaned, prep_warnings = _prepare_text(text)
    warnings.extend(prep_warnings)
    if not cleaned:
        return None, 0, warnings

    if not _module_available("edge_tts"):
        warnings.append("Thiếu thư viện edge-tts; không thể tạo giọng đọc.")
        return None, 0, warnings

    try:
        spoken = _strip_markdown(cleaned) or cleaned
        # edge-tts là async; endpoint chạy trong threadpool nên asyncio.run an toàn (không có
        # event loop sẵn trong thread đó).
        # Bọc timeout: edge-tts goi dich vu mang ngoai; neu treo, asyncio.TimeoutError se duoc
        # khoi except ben duoi bat -> tra None + canh bao mem (khong giu thread vo han).
        audio_bytes = asyncio.run(
            asyncio.wait_for(_edge_synthesize(spoken, _voice()), timeout=_tts_timeout())
        )
        if not audio_bytes:
            warnings.append("Không nhận được dữ liệu giọng đọc.")
            return None, 0, warnings
        # spoken_end tính theo `cleaned` (đã cắt bớt nếu quá dài) — đây là đoạn văn bản gốc
        # mà audio bao phủ; frontend ánh xạ tiến độ audio lên [0, spoken_end].
        return audio_bytes, len(cleaned), warnings
    except Exception as exc:  # suy biến mềm — không làm sập API
        LOGGER.warning("TTS synthesis failed: %s", exc)
        warnings.append("Tạo giọng đọc thất bại; vui lòng thử lại sau.")
        return None, 0, warnings
