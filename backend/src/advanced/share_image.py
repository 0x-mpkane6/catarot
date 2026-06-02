"""Compose ảnh share PNG cho daily card (Pillow).

Module tách bạch để các loại reading khác tái dùng sau. Nguyên tắc:
- Import PIL LAZY (trong hàm) để app KHÔNG vỡ lúc khởi động nếu Pillow thiếu.
- Font có fallback an toàn (ImageFont.load_default) nếu thiếu font hệ thống.
- Cache file theo (user_id, date) để không vẽ lại.
"""
from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Any

from src.utils.config import resolve_path
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

_WIDTH = 800
_HEIGHT = 1200
_BG = (15, 8, 28)
_ACCENT = (168, 85, 247)
_TEXT = (240, 235, 250)
_MUTED = (150, 140, 170)

# Font hệ thống hay gặp trên Linux (HF/Docker) + Windows; fallback default nếu không có.
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
]


def _cache_dir() -> Path:
    directory = resolve_path(os.getenv("SHARE_IMAGE_CACHE_DIR", "./data/share_cache"))
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _cache_path(user_id: int, date_key: str) -> Path:
    safe_date = "".join(ch for ch in str(date_key) if ch.isalnum() or ch in "-_")
    return _cache_dir() / f"daily_{int(user_id)}_{safe_date}.png"


def _load_font(size: int):
    from PIL import ImageFont  # lazy

    env_font = os.getenv("DAILY_SHARE_FONT", "").strip()
    candidates = ([env_font] if env_font else []) + _FONT_CANDIDATES
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    # Fallback an toàn: font bitmap mặc định của Pillow (luôn có sẵn).
    return ImageFont.load_default()


def _wrap(draw, text: str, font, max_width: int) -> list[str]:
    words = (text or "").split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        try:
            width = draw.textlength(trial, font=font)
        except Exception:
            width = len(trial) * (font.size if hasattr(font, "size") else 8) * 0.6
        if width <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def render_daily_card_png(card: dict[str, Any], *, app_name: str = "Tarot AI") -> bytes:
    """Vẽ 1 ảnh PNG từ dữ liệu daily card. Ném ImportError nếu Pillow thiếu (người gọi xử lý)."""
    from PIL import Image, ImageDraw  # lazy

    img = Image.new("RGB", (_WIDTH, _HEIGHT), _BG)
    draw = ImageDraw.Draw(img)

    margin = 64
    inner_w = _WIDTH - 2 * margin

    # Khung viền nhẹ
    draw.rectangle([24, 24, _WIDTH - 24, _HEIGHT - 24], outline=(60, 40, 90), width=2)

    font_app = _load_font(34)
    font_title = _load_font(66)
    font_sub = _load_font(30)
    font_body = _load_font(34)
    font_foot = _load_font(26)

    # Header: tên app
    draw.text((margin, 60), app_name.upper(), font=font_app, fill=_ACCENT)
    draw.line([margin, 116, _WIDTH - margin, 116], fill=(60, 40, 90), width=2)

    # Tên lá bài (giữa, có thể xuống dòng)
    name = str(card.get("card_name") or "Lá bài của bạn")
    y = 280
    for line in _wrap(draw, name, font_title, inner_w):
        draw.text((margin, y), line, font=font_title, fill=_TEXT)
        y += 80

    # Dấu hiệu NGƯỢC
    if str(card.get("orientation")) == "reversed":
        draw.text((margin, y + 6), "↺ NGƯỢC", font=font_sub, fill=(255, 170, 120))
        y += 50

    # Message ngắn (affirmation/message)
    message = str(card.get("affirmation") or card.get("message") or "").strip()
    if message:
        y += 40
        for line in _wrap(draw, message, font_body, inner_w):
            draw.text((margin, y), line, font=font_body, fill=_TEXT)
            y += 48

    # Footer: ngày + watermark
    date_text = str(card.get("draw_date") or card.get("date") or "")
    draw.line([margin, _HEIGHT - 150, _WIDTH - margin, _HEIGHT - 150], fill=(60, 40, 90), width=2)
    if date_text:
        draw.text((margin, _HEIGHT - 130), date_text, font=font_foot, fill=_MUTED)
    draw.text((margin, _HEIGHT - 90), f"✦ {app_name} · lá bài hằng ngày", font=font_foot, fill=_MUTED)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def get_or_render_daily_card_image(
    card: dict[str, Any], *, user_id: int, date_key: str, use_cache: bool = True
) -> bytes:
    """Trả PNG bytes; cache theo (user_id, date) để không vẽ lại."""
    path = _cache_path(user_id, date_key)
    if use_cache:
        try:
            if path.exists():
                return path.read_bytes()
        except Exception as exc:  # pragma: no cover - cache đọc lỗi -> vẽ lại
            LOGGER.debug("Đọc cache ảnh share lỗi: %s", exc)

    data = render_daily_card_png(card)
    try:
        path.write_bytes(data)
    except Exception as exc:  # pragma: no cover - cache ghi lỗi không chặn trả ảnh
        LOGGER.debug("Ghi cache ảnh share lỗi: %s", exc)
    return data
