from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

from src.utils.config import resolve_path
from src.utils.io import read_jsonl
from src.utils.logging import get_logger
from src.vision.preprocess import load_image

LOGGER = get_logger(__name__)

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


def _require_faiss() -> None:
    if faiss is None:
        raise RuntimeError("faiss-cpu is not installed. Please install faiss-cpu to build/search index.")


def build_index(vectors: np.ndarray):
    _require_faiss()
    if vectors.ndim != 2 or vectors.shape[0] == 0:
        raise ValueError("Expected non-empty 2D vectors matrix.")
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors.astype("float32"))
    return index


def save_index(index, index_path: str | Path) -> None:
    _require_faiss()
    resolved = resolve_path(index_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(resolved))


def load_index(index_path: str | Path):
    _require_faiss()
    resolved = resolve_path(index_path)
    return faiss.read_index(str(resolved))


def save_meta(meta: list[dict[str, Any]], meta_path: str | Path) -> None:
    resolved = resolve_path(meta_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    with resolved.open("w", encoding="utf-8") as handle:
        json.dump(meta, handle, ensure_ascii=False, indent=2)


def load_meta(meta_path: str | Path) -> list[dict[str, Any]]:
    resolved = resolve_path(meta_path)
    with resolved.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_vision_index_from_manifest(
    manifest_path: str | Path,
    index_path: str | Path,
    meta_path: str | Path,
    embedder,
) -> tuple[int, int]:
    records = read_jsonl(manifest_path)
    if not records:
        raise ValueError(f"Gallery manifest is empty: {manifest_path}")

    image_paths = [record["path"] for record in records]
    vectors = embedder.embed_paths(image_paths, load_image)
    index = build_index(vectors)

    meta: list[dict[str, Any]] = []
    for idx, record in enumerate(records):
        meta.append(
            {
                "vector_id": idx,
                "id": record["id"],
                "card_name": record["card_name"],
                "orientation": record["orientation"],
                "ref_path": record["path"],
            }
        )

    save_index(index, index_path)
    save_meta(meta, meta_path)

    LOGGER.info("Built vision index with %d vectors, dim=%d", vectors.shape[0], vectors.shape[1])
    return vectors.shape[0], vectors.shape[1]


def search_index(index, meta: list[dict[str, Any]], query_vector: np.ndarray, top_k: int = 5) -> list[dict[str, Any]]:
    if top_k <= 0:
        return []

    query = np.asarray(query_vector, dtype="float32").reshape(1, -1)
    # Guard chiều vector: nếu chiều query khác chiều index đã build, FAISS sẽ nổ
    # assertion mơ hồ ở lớp C++. Nêu lỗi rõ ràng để dễ chẩn đoán (ví dụ index build
    # bằng OpenCLIP 512 chiều nhưng runtime bật VISION_DEMO_MODE → embedder demo 864 chiều).
    index_dim = getattr(index, "d", None)
    if index_dim is not None and query.shape[1] != index_dim:
        raise ValueError(
            f"Vector dim lệch: query={query.shape[1]} nhưng index build ở dim={index_dim}. "
            "Có thể index được build ở chế độ khác (OpenCLIP 512 vs demo 864). "
            "Hãy build lại index đúng với VISION_DEMO_MODE đang dùng."
        )
    k = min(top_k, len(meta))
    scores, indices = index.search(query, k)

    results: list[dict[str, Any]] = []
    for score, idx in zip(scores[0].tolist(), indices[0].tolist()):
        if idx < 0:
            continue
        item = dict(meta[idx])
        item["score"] = float(score)
        results.append(item)
    return results
