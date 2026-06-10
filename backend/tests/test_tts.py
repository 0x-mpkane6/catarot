"""Kiểm thử tầng TTS (đọc luận giải tiếng Việt) + endpoint /api/tts.

Theo triết lý của repo: test các hàm THUẦN (chuẩn hoá văn bản, đóng gói WAV) nhanh
và offline; phần nạp model thật (facebook/mms-tts-vie ~145MB, cần mạng) chỉ chạy khi
bật cờ TTS_INTEGRATION_TEST — giống cách test vision smoke bị skip khi thiếu index.
"""
from __future__ import annotations

import importlib
import io
import os
import wave

import numpy as np
import pytest

from src.tts import synthesize as tts


# --- Chuẩn hoá văn bản đầu vào --------------------------------------------------

def test_prepare_text_empty_returns_warning() -> None:
    cleaned, warnings = tts._prepare_text("   ")
    assert cleaned == ""
    assert any("Không có nội dung" in w for w in warnings)


def test_prepare_text_passthrough_no_warning() -> None:
    cleaned, warnings = tts._prepare_text("Xin chào thế giới")
    assert cleaned == "Xin chào thế giới"
    assert warnings == []


def test_prepare_text_truncates_long_input() -> None:
    cleaned, warnings = tts._prepare_text("a" * 50, max_chars=10)
    assert len(cleaned) == 10
    assert any("cắt bớt" in w for w in warnings)


# --- Đóng gói waveform -> WAV PCM 16-bit (thư viện chuẩn, không cần soundfile) ---

def test_waveform_to_wav_bytes_is_valid_riff() -> None:
    sample_rate = 16000
    t = np.linspace(0, 1, sample_rate, endpoint=False)
    waveform = (0.5 * np.sin(2 * np.pi * 220 * t)).astype("float32")

    data = tts._waveform_to_wav_bytes(waveform, sample_rate)

    assert data[:4] == b"RIFF"
    assert data[8:12] == b"WAVE"
    with wave.open(io.BytesIO(data), "rb") as handle:
        assert handle.getnchannels() == 1
        assert handle.getsampwidth() == 2
        assert handle.getframerate() == sample_rate
        assert handle.getnframes() == sample_rate


def test_waveform_to_wav_bytes_clips_out_of_range() -> None:
    loud = np.array([5.0, -5.0, 0.0], dtype="float32")  # vượt biên [-1, 1]
    data = tts._waveform_to_wav_bytes(loud, 8000)

    with wave.open(io.BytesIO(data), "rb") as handle:
        frames = handle.readframes(handle.getnframes())
    pcm = np.frombuffer(frames, dtype="<i2")

    assert pcm.max() <= 32767
    assert pcm.min() >= -32768
    assert pcm[0] == 32767   # +5.0 -> clip +1.0 -> 32767
    assert pcm[1] == -32767  # -5.0 -> clip -1.0 -> -32767


# --- Orchestration: suy biến mềm, không bao giờ raise ---------------------------

def test_synthesize_disabled_returns_none(monkeypatch) -> None:
    monkeypatch.setenv("TTS_ENABLED", "false")
    audio, warnings = tts.synthesize_vietnamese("Xin chào")
    assert audio is None
    assert any("tắt" in w for w in warnings)


def test_synthesize_empty_text_returns_none(monkeypatch) -> None:
    monkeypatch.setenv("TTS_ENABLED", "true")
    audio, warnings = tts.synthesize_vietnamese("   ")
    assert audio is None
    assert warnings


def test_synthesize_handles_model_failure_gracefully(monkeypatch) -> None:
    monkeypatch.setenv("TTS_ENABLED", "true")
    monkeypatch.setattr(tts, "_module_available", lambda name: True)

    def _boom():
        raise RuntimeError("model load failed")

    tts._get_model_and_tokenizer.cache_clear()
    monkeypatch.setattr(tts, "_get_model_and_tokenizer", _boom)

    audio, warnings = tts.synthesize_vietnamese("Xin chào")
    assert audio is None
    assert warnings  # đã ghi cảnh báo thay vì ném lỗi


# --- Endpoint /api/tts ----------------------------------------------------------

def test_tts_endpoint_returns_wav(monkeypatch) -> None:
    pytest.importorskip("fastapi")
    import src.main as main_module

    main_module = importlib.reload(main_module)
    fake_wav = b"RIFF\x00\x00\x00\x00WAVEfake-pcm"
    monkeypatch.setattr(main_module, "synthesize_vietnamese", lambda text: (fake_wav, []))

    response = main_module.text_to_speech(
        req=main_module.TtsRequest(text="Xin chào"),
        request=None,
    )

    assert response.media_type == "audio/wav"
    assert response.body == fake_wav


def test_tts_endpoint_empty_text_returns_400() -> None:
    pytest.importorskip("fastapi")
    from fastapi import HTTPException

    import src.main as main_module

    main_module = importlib.reload(main_module)

    with pytest.raises(HTTPException) as exc_info:
        main_module.text_to_speech(req=main_module.TtsRequest(text="   "), request=None)
    assert exc_info.value.status_code == 400


def test_tts_endpoint_unavailable_returns_503(monkeypatch) -> None:
    pytest.importorskip("fastapi")
    from fastapi import HTTPException

    import src.main as main_module

    main_module = importlib.reload(main_module)
    monkeypatch.setattr(
        main_module,
        "synthesize_vietnamese",
        lambda text: (None, ["Thiếu thư viện transformers; không thể tạo giọng đọc."]),
    )

    with pytest.raises(HTTPException) as exc_info:
        main_module.text_to_speech(req=main_module.TtsRequest(text="Xin chào"), request=None)
    assert exc_info.value.status_code == 503


def test_tts_endpoint_vietnamese_warning_header_is_latin1_safe(monkeypatch) -> None:
    """Cảnh báo tiếng Việt có dấu phải được encode an toàn trong HTTP header.

    Starlette encode header bằng latin-1; nếu nhét thẳng chuỗi có dấu ('ă', 'ơ'…)
    vào X-TTS-Warnings thì Response() ném UnicodeEncodeError → client nhận 500
    đúng lúc văn bản dài bị cắt bớt. Header phải là ASCII (percent-encoded) và
    decode ngược lại đúng nội dung gốc.
    """
    pytest.importorskip("fastapi")
    from urllib.parse import unquote

    import src.main as main_module

    main_module = importlib.reload(main_module)
    fake_wav = b"RIFF\x00\x00\x00\x00WAVEfake-pcm"
    warning = "Văn bản dài hơn 1200 ký tự nên đã được cắt bớt khi đọc."
    monkeypatch.setattr(
        main_module, "synthesize_vietnamese", lambda text: (fake_wav, [warning])
    )

    response = main_module.text_to_speech(
        req=main_module.TtsRequest(text="Xin chào"), request=None
    )

    header = response.headers["X-TTS-Warnings"]
    header.encode("latin-1")  # không được ném UnicodeEncodeError
    assert unquote(header) == warning


# --- Integration thật (opt-in): nạp model mms-tts-vie + sinh audio --------------

def test_synthesize_real_model_integration() -> None:
    flag = os.getenv("TTS_INTEGRATION_TEST", "").strip().lower()
    if flag not in {"1", "true", "yes"}:
        pytest.skip("Đặt TTS_INTEGRATION_TEST=1 để chạy tổng hợp thật (tải ~145MB từ HF).")
    if not tts._module_available("transformers"):
        pytest.skip("Chưa cài transformers.")

    tts._get_model_and_tokenizer.cache_clear()
    audio, _warnings = tts.synthesize_vietnamese("Xin chào, đây là một bài đọc thử.")

    assert audio is not None
    assert audio[:4] == b"RIFF"
    with wave.open(io.BytesIO(audio), "rb") as handle:
        assert handle.getnframes() > 0
