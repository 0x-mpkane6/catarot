from __future__ import annotations

import os
from typing import Iterable

import numpy as np
from PIL import Image

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _l2_normalize(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector.astype("float32")
    return (vector / norm).astype("float32")


class VisionEmbedder:
    def __init__(
        self,
        model_name: str = "ViT-B-32",
        pretrained: str = "laion2b_s34b_b79k",
        device: str = "cpu",
        force_demo: bool = False,
    ) -> None:
        self.model_name = model_name
        self.pretrained = pretrained
        self.device = device
        self.demo_mode = force_demo or os.getenv("VISION_DEMO_MODE", "0") == "1"
        self.strict_open_clip = _as_bool(os.getenv("VISION_STRICT_OPENCLIP", "1"))

        self._model = None
        self._preprocess = None
        self._torch = None

        if not self.demo_mode:
            self._try_load_open_clip()

        if self.demo_mode:
            LOGGER.info("Vision embedder running in demo mode.")

    def _try_load_open_clip(self) -> None:
        try:
            import open_clip  # type: ignore
            import torch

            model, _, preprocess = open_clip.create_model_and_transforms(
                self.model_name,
                pretrained=self.pretrained,
                device=self.device,
            )
            model.eval()
            self._model = model
            self._preprocess = preprocess
            self._torch = torch
            LOGGER.info(
                "Loaded OpenCLIP model name=%s pretrained=%s",
                self.model_name,
                self.pretrained,
            )
        except Exception as exc:
            if self.strict_open_clip:
                raise RuntimeError(
                    "OpenCLIP is required by default but unavailable. "
                    "Install dependency 'open-clip-torch' or set "
                    "VISION_STRICT_OPENCLIP=0 to allow demo fallback."
                ) from exc
            LOGGER.warning("OpenCLIP unavailable (%s). Falling back to demo embedding.", exc)
            self.demo_mode = True

    def _embed_demo(self, image: Image.Image) -> np.ndarray:
        rgb = image.convert("RGB").resize((64, 64), Image.Resampling.BICUBIC)
        arr = np.asarray(rgb, dtype=np.float32) / 255.0

        hist_features = []
        for channel in range(3):
            hist, _ = np.histogram(arr[:, :, channel], bins=32, range=(0, 1), density=True)
            hist_features.append(hist.astype("float32"))

        gray = image.convert("L").resize((16, 16), Image.Resampling.BICUBIC)
        gray_arr = np.asarray(gray, dtype=np.float32).flatten() / 255.0

        dx = np.diff(gray_arr.reshape(16, 16), axis=1, prepend=0).flatten()
        dy = np.diff(gray_arr.reshape(16, 16), axis=0, prepend=0).flatten()

        vector = np.concatenate([*hist_features, gray_arr, dx, dy]).astype("float32")
        return _l2_normalize(vector)

    def embed_image(self, image: Image.Image) -> np.ndarray:
        if self.demo_mode or self._model is None or self._preprocess is None or self._torch is None:
            return self._embed_demo(image)

        tensor = self._preprocess(image).unsqueeze(0).to(self.device)
        with self._torch.inference_mode():
            encoded = self._model.encode_image(tensor)
        vector = encoded.detach().cpu().numpy().astype("float32")[0]
        return _l2_normalize(vector)

    def embed_paths(self, image_paths: Iterable[str], loader_fn) -> np.ndarray:
        vectors = []
        for image_path in image_paths:
            image = loader_fn(image_path)
            vectors.append(self.embed_image(image))
        if not vectors:
            return np.zeros((0, 0), dtype="float32")
        return np.vstack(vectors).astype("float32")
