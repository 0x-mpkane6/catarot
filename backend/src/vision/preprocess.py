from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps


def load_image(path: str | Path) -> Image.Image:
    return Image.open(path).convert("RGB")


def prepare_gallery_image(image: Image.Image, size: int = 512) -> Image.Image:
    return ImageOps.fit(image.convert("RGB"), (size, size), method=Image.Resampling.LANCZOS)


def rotate_180(image: Image.Image) -> Image.Image:
    return image.rotate(180, expand=True)
