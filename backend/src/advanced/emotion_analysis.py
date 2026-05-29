from __future__ import annotations

import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)


def _to_wav_if_needed(audio_path: Path) -> tuple[Path | None, Path | None]:
    if audio_path.suffix.lower() == ".wav":
        return audio_path, None

    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin:
        return None, None

    tmp_dir = Path(tempfile.mkdtemp(prefix="emotion_"))
    wav_path = tmp_dir / "emotion.wav"
    cmd = [ffmpeg_bin, "-y", "-i", str(audio_path), "-ac", "1", "-ar", "16000", str(wav_path)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not wav_path.exists():
        LOGGER.warning("Emotion audio conversion failed: %s", result.stderr[-400:])
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return None, None
    return wav_path, tmp_dir


def _load_wav_mono(audio_path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(audio_path), "rb") as handle:
        sample_rate = handle.getframerate()
        channels = handle.getnchannels()
        sample_width = handle.getsampwidth()
        frame_count = handle.getnframes()
        raw = handle.readframes(frame_count)

    dtype_map = {1: np.uint8, 2: np.int16, 4: np.int32}
    if sample_width not in dtype_map:
        raise ValueError("unsupported wav sample width")

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


def _pause_ratio(audio: np.ndarray, threshold: float = 0.01) -> float:
    if audio.size == 0:
        return 1.0
    return float(np.mean(np.abs(audio) < threshold))


def _zero_crossing_rate(audio: np.ndarray) -> float:
    if audio.size < 2:
        return 0.0
    signs = np.sign(audio)
    crossings = np.sum(np.abs(np.diff(signs)) > 0)
    return float(crossings) / float(audio.size - 1)


def classify_emotion_from_signal(signal: dict[str, float]) -> str:
    pause_ratio = signal.get("pause_ratio", 0.0)
    energy_mean = signal.get("energy_mean", 0.0)
    energy_std = signal.get("energy_std", 0.0)
    zcr = signal.get("zero_crossing_rate", 0.0)

    if pause_ratio > 0.48 and energy_mean < 0.035:
        return "sad"
    if zcr > 0.16 and energy_std > 0.07:
        return "anxious"
    if energy_mean > 0.09 and zcr > 0.10 and pause_ratio < 0.24:
        return "excited"
    if pause_ratio > 0.35 or zcr > 0.11:
        return "uncertain"
    return "calm"


def analyze_voice_emotion(audio_path: str | None) -> tuple[str | None, dict[str, float], list[str]]:
    warnings: list[str] = []
    if not audio_path:
        return None, {}, warnings

    path = Path(audio_path)
    if not path.exists():
        warnings.append("audio file missing for emotion analysis")
        return None, {}, warnings

    wav_path: Path | None
    temp_dir: Path | None
    wav_path, temp_dir = _to_wav_if_needed(path)
    if wav_path is None:
        warnings.append("emotion analysis skipped: wav conversion unavailable")
        return None, {}, warnings

    try:
        audio, sample_rate = _load_wav_mono(wav_path)
        duration_sec = float(audio.size) / float(max(sample_rate, 1))
        signal = {
            "duration_sec": round(duration_sec, 4),
            "energy_mean": float(np.mean(np.abs(audio))),
            "energy_std": float(np.std(np.abs(audio))),
            "pause_ratio": _pause_ratio(audio),
            "zero_crossing_rate": _zero_crossing_rate(audio),
        }
        signal["speech_density"] = max(0.0, 1.0 - signal["pause_ratio"])
        emotion_state = classify_emotion_from_signal(signal)
        return emotion_state, signal, warnings
    except Exception as exc:
        LOGGER.warning("emotion analysis failed: %s", exc)
        warnings.append("emotion analysis failed")
        return None, {}, warnings
    finally:
        if temp_dir is not None:
            shutil.rmtree(temp_dir, ignore_errors=True)

