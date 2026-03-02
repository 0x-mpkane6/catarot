from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import tempfile
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _convert_to_wav_if_needed(audio_path: Path, warnings: list[str]) -> tuple[Path | None, Path | None]:
    if audio_path.suffix.lower() == ".wav":
        return audio_path, None

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        warnings.append(
            "Audio format is not WAV and ffmpeg is not installed. "
            "Please upload WAV audio or install ffmpeg."
        )
        return None, None

    temp_dir = Path(tempfile.mkdtemp(prefix="tarot_asr_"))
    wav_path = temp_dir / "input.wav"

    cmd = [ffmpeg_bin, "-y", "-i", str(audio_path), "-ac", "1", "-ar", "16000", str(wav_path)]
    process = subprocess.run(cmd, capture_output=True, text=True)
    if process.returncode != 0 or not wav_path.exists():
        LOGGER.warning("ffmpeg conversion failed: %s", process.stderr[-400:])
        warnings.append("Could not decode audio file. Please upload WAV audio.")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return None, None

    return wav_path, temp_dir


def _load_wav_mono(audio_path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(audio_path), "rb") as handle:
        sample_rate = handle.getframerate()
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        frame_count = handle.getnframes()
        raw = handle.readframes(frame_count)

    dtype_map = {1: np.uint8, 2: np.int16, 4: np.int32}
    if sample_width not in dtype_map:
        raise ValueError(f"Unsupported WAV sample width: {sample_width}")

    audio = np.frombuffer(raw, dtype=dtype_map[sample_width]).astype("float32")
    if sample_width == 1:
        audio = (audio - 128.0) / 128.0
    else:
        audio /= float(2 ** (8 * sample_width - 1))

    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)

    if audio.size == 0:
        return np.zeros((1,), dtype="float32"), sample_rate

    return audio.astype("float32"), sample_rate


def _resample_linear(audio: np.ndarray, source_sr: int, target_sr: int = 16000) -> np.ndarray:
    if source_sr == target_sr:
        return audio.astype("float32")

    duration_sec = len(audio) / float(source_sr)
    target_len = max(1, int(duration_sec * target_sr))
    source_idx = np.linspace(0, len(audio) - 1, num=len(audio), dtype=np.float64)
    target_idx = np.linspace(0, len(audio) - 1, num=target_len, dtype=np.float64)
    return np.interp(target_idx, source_idx, audio).astype("float32")


@lru_cache(maxsize=1)
def _get_faster_whisper_model():
    from faster_whisper import WhisperModel  # type: ignore

    model_name = os.getenv("ASR_MODEL_FASTER", "small")
    return WhisperModel(model_name, device="cpu", compute_type="int8")


def _transcribe_with_faster_whisper(audio_path: Path) -> str:
    model = _get_faster_whisper_model()
    segments, _ = model.transcribe(str(audio_path))
    return " ".join(segment.text.strip() for segment in segments).strip()


@lru_cache(maxsize=1)
def _get_transformers_asr_pipeline():
    from transformers import pipeline  # type: ignore

    model_name = os.getenv("ASR_MODEL_TRANSFORMERS", "openai/whisper-tiny")
    return pipeline(
        task="automatic-speech-recognition",
        model=model_name,
        device=-1,
    )


def _transcribe_with_transformers(audio_path: Path) -> str:
    audio, sample_rate = _load_wav_mono(audio_path)
    audio = _resample_linear(audio, sample_rate, 16000)

    asr_pipeline = _get_transformers_asr_pipeline()
    result = asr_pipeline({"array": audio, "sampling_rate": 16000})
    if isinstance(result, dict):
        return str(result.get("text", "")).strip()
    return str(result).strip()


def transcribe_audio(audio_path: str | None) -> tuple[str | None, list[str]]:
    warnings: list[str] = []
    if not audio_path:
        return None, warnings

    path = Path(audio_path)
    if not path.exists():
        warnings.append(f"Audio file not found: {audio_path}")
        return None, warnings

    working_path: Path | None = path
    temp_dir: Path | None = None

    if path.suffix.lower() != ".wav":
        working_path, temp_dir = _convert_to_wav_if_needed(path, warnings)
        if working_path is None:
            return None, warnings

    try:
        # 1) Preferred local ASR when available.
        if _module_available("faster_whisper"):
            try:
                transcript = _transcribe_with_faster_whisper(working_path)
                if transcript:
                    return transcript, warnings
            except Exception as exc:
                LOGGER.warning("faster_whisper ASR failed: %s", exc)
                warnings.append("faster_whisper failed; falling back to transformers ASR.")

        # 2) Fallback ASR using transformers whisper (CPU).
        if _module_available("transformers"):
            try:
                transcript = _transcribe_with_transformers(working_path)
                if transcript:
                    return transcript, warnings
                warnings.append("Audio provided but no speech was detected.")
                return None, warnings
            except Exception as exc:
                LOGGER.warning("transformers ASR failed: %s", exc)
                warnings.append("ASR failed; continuing without transcript.")
                return None, warnings

        warnings.append("No ASR backend available. Install faster-whisper or transformers.")
        return None, warnings
    finally:
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)
