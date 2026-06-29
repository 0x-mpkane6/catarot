"""Nhận diện lá bài Tarot từ ảnh chụp (tầng Vision).

CardPredictor.predict(): sinh embedding (OpenCLIP) cho CẢ ảnh gốc lẫn ảnh XOAY 180°,
tìm lá gần nhất trong FAISS index (vector đã L2-norm nên inner product = cosine
similarity). Ứng viên từ ảnh xoay được đảo chiều (xuôi↔ngược) → nhận biết lá ngược mà
không cần ảnh huấn luyện riêng. Độ tin cậy = KHOẢNG CÁCH điểm giữa ứng viên nhất và
nhì; thấp hơn ngưỡng → cảnh báo chụp lại. Thiếu index → trả kết quả dự phòng, không sập.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from src.utils.config import resolve_path
from src.utils.logging import get_logger
from src.vision.embedder import VisionEmbedder
from src.vision.index import load_index, load_meta, search_index
from src.vision.preprocess import load_image, rotate_180

LOGGER = get_logger(__name__)


DEFAULT_CANDIDATE_POOL = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
]


def _flip_orientation(orientation: str) -> str:
    return "reversed" if orientation == "upright" else "upright"


def _normalize_candidates(candidates: list[dict], top_k: int) -> list[dict]:
    merged: dict[tuple[str, str], float] = {}
    for candidate in candidates:
        key = (candidate["card_name"], candidate["orientation"])
        merged[key] = max(merged.get(key, -1.0), float(candidate.get("score", 0.0)))

    sorted_candidates = sorted(merged.items(), key=lambda item: item[1], reverse=True)
    output = []
    for (name, orientation), score in sorted_candidates[:top_k]:
        output.append(
            {
                "name": name,
                "orientation": orientation,
                "score": float(score),
            }
        )
    return output


def _confidence_from_scores(candidates: list[dict]) -> float:
    if not candidates:
        return 0.0
    top1 = candidates[0]["score"]
    top2 = candidates[1]["score"] if len(candidates) > 1 else 0.0
    margin = top1 - top2
    confidence = (margin + 0.2) / 0.8
    return max(0.0, min(1.0, float(confidence)))


def _load_candidate_pool(tarot_images_json_path: str | Path | None = None) -> list[str]:
    if not tarot_images_json_path:
        return list(DEFAULT_CANDIDATE_POOL)

    resolved = resolve_path(tarot_images_json_path)
    if not resolved.exists():
        return list(DEFAULT_CANDIDATE_POOL)

    try:
        with resolved.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        names = [card.get("name") for card in payload.get("cards", []) if card.get("name")]
        if names:
            return names
    except Exception as exc:
        LOGGER.warning("Could not load fallback candidate pool: %s", exc)

    return list(DEFAULT_CANDIDATE_POOL)


@dataclass
class CardPredictor:
    index_path: str
    meta_path: str
    top_k: int = 5
    tarot_images_json_path: str | None = None
    embedder: VisionEmbedder | None = None

    def __post_init__(self) -> None:
        self.embedder = self.embedder or VisionEmbedder()
        self.index = None
        self.meta: list[dict] = []
        self.available = False
        self._candidate_pool = _load_candidate_pool(self.tarot_images_json_path)

        if not self._load_index_files():
            LOGGER.warning("Vision index or metadata not found; predictor in fallback mode.")

    def _load_index_files(self) -> bool:
        """(Re)nạp index+meta từ đĩa. Trả True nếu nạp được. Gọi lại được ở predict() để bắt
        trường hợp index VỪA được build ở thread nền (xem ensure_vision_index_built)."""
        if self.available and self.index is not None:
            return True
        try:
            resolved_index = resolve_path(self.index_path)
            resolved_meta = resolve_path(self.meta_path)
            if resolved_index.exists() and resolved_meta.exists():
                self.index = load_index(resolved_index)
                self.meta = load_meta(resolved_meta)
                self.available = True
                return True
        except Exception as exc:
            LOGGER.warning("Failed to load vision index: %s", exc)
        return False

    def _fallback_result(self) -> dict:
        candidates = [
            {"name": name, "orientation": "upright", "score": 0.0}
            for name in self._candidate_pool[: self.top_k]
        ]
        top = candidates[0] if candidates else {"name": "Unknown Card", "orientation": "upright"}
        return {
            "name": top["name"],
            "orientation": top["orientation"],
            "confidence": 0.0,
            "topk_candidates": candidates,
            "_warning": "Chưa có chỉ mục nhận dạng ảnh; dùng danh sách lá bài dự phòng.",
        }

    def list_candidate_cards(self, limit: int = 78) -> list[str]:
        output: list[str] = []
        seen = set()
        for name in self._candidate_pool:
            if not name or name in seen:
                continue
            seen.add(name)
            output.append(name)
            if len(output) >= limit:
                break
        return output

    def predict(self, image_path: str) -> dict:
        if not self.available:
            self._load_index_files()  # index có thể vừa được build ở thread nền
        if not self.available or self.index is None:
            return self._fallback_result()

        try:
            image = load_image(image_path)
            rotated = rotate_180(image)

            vector_orig = self.embedder.embed_image(image)
            vector_rot = self.embedder.embed_image(rotated)

            raw_orig = search_index(self.index, self.meta, vector_orig, top_k=self.top_k)
            raw_rot = search_index(self.index, self.meta, vector_rot, top_k=self.top_k)

            remapped_rot = []
            for row in raw_rot:
                remapped = dict(row)
                remapped["orientation"] = _flip_orientation(remapped["orientation"])
                remapped_rot.append(remapped)

            candidates = _normalize_candidates(raw_orig + remapped_rot, top_k=self.top_k)
            if not candidates:
                return self._fallback_result()

            confidence = _confidence_from_scores(candidates)
            top = candidates[0]
            return {
                "name": top["name"],
                "orientation": top["orientation"],
                "confidence": confidence,
                "topk_candidates": candidates,
            }
        except Exception as exc:
            LOGGER.warning("Prediction failed for %s: %s", image_path, exc)
            result = self._fallback_result()
            result["_warning"] = f"Nhận dạng ảnh {Path(image_path).name} thất bại; dùng danh sách lá bài dự phòng."
            return result
