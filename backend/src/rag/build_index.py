from __future__ import annotations

import hashlib
import json
import pickle
import re
from pathlib import Path
from typing import Any

import numpy as np

from src.utils.config import resolve_path
from src.utils.io import read_jsonl, write_jsonl
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(text: str) -> str:
    return SLUG_RE.sub("-", text.lower()).strip("-")


def _l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (vectors / norms).astype("float32")


class RagEmbedder:
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        device: str = "cpu",
        force_demo: bool = False,
    ) -> None:
        self.model_name = model_name
        self.device = device
        self.demo_mode = force_demo
        self.model = None

        if not force_demo:
            try:
                from sentence_transformers import SentenceTransformer  # type: ignore

                self.model = SentenceTransformer(model_name, device=device)
                LOGGER.info("Loaded sentence-transformer model=%s", model_name)
            except Exception as exc:
                LOGGER.warning("SentenceTransformer unavailable (%s). Using demo embedding.", exc)
                self.demo_mode = True

    def _embed_demo(self, texts: list[str], dim: int = 384) -> np.ndarray:
        matrix = np.zeros((len(texts), dim), dtype="float32")
        for row_idx, text in enumerate(texts):
            tokens = text.lower().split()
            if not tokens:
                continue
            for token in tokens:
                digest = hashlib.md5(token.encode("utf-8")).hexdigest()
                idx = int(digest[:8], 16) % dim
                matrix[row_idx, idx] += 1.0
        return _l2_normalize(matrix)

    def embed_texts(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        if not texts:
            return np.zeros((0, 0), dtype="float32")

        if self.model is None:
            return self._embed_demo(texts)

        vectors = self.model.encode(
            texts,
            batch_size=batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return vectors.astype("float32")


def ensure_corpus_exists(
    corpus_path: str | Path,
    card_data_path: str | Path,
    tarot_images_json_path: str | Path,
) -> Path:
    resolved_corpus = resolve_path(corpus_path)
    if resolved_corpus.exists() and resolved_corpus.stat().st_size > 0:
        return resolved_corpus

    resolved_corpus.parent.mkdir(parents=True, exist_ok=True)

    card_rows = _build_rows_from_card_data(card_data_path)
    if not card_rows:
        card_rows = _build_rows_from_tarot_images(tarot_images_json_path)

    if not card_rows:
        raise RuntimeError("Cannot build fallback RAG corpus: no card metadata available.")

    write_jsonl(resolved_corpus, card_rows)
    LOGGER.info("Created fallback corpus with %d rows at %s", len(card_rows), resolved_corpus)
    return resolved_corpus


def _build_rows_from_card_data(card_data_path: str | Path) -> list[dict[str, Any]]:
    path = resolve_path(card_data_path)
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    cards = payload.get("cards", []) if isinstance(payload, dict) else []
    rows: list[dict[str, Any]] = []

    for card in cards:
        name = card.get("name")
        if not name:
            continue

        description = (card.get("desc") or "").strip()
        up = (card.get("meaning_up") or "General positive interpretation.").strip()
        rev = (card.get("meaning_rev") or "General cautionary interpretation.").strip()

        rows.append(
            {
                "id": f"{_slugify(name)}-upright",
                "text": f"{name} upright meaning: {up} {description}".strip(),
                "metadata": {"card_name": name, "orientation": "upright"},
            }
        )
        rows.append(
            {
                "id": f"{_slugify(name)}-reversed",
                "text": f"{name} reversed meaning: {rev} {description}".strip(),
                "metadata": {"card_name": name, "orientation": "reversed"},
            }
        )
    return rows


def _build_rows_from_tarot_images(tarot_images_json_path: str | Path) -> list[dict[str, Any]]:
    path = resolve_path(tarot_images_json_path)
    if not path.exists():
        return []

    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    rows: list[dict[str, Any]] = []
    for card in payload.get("cards", []):
        name = card.get("name")
        if not name:
            continue

        rows.append(
            {
                "id": f"{_slugify(name)}-upright",
                "text": f"{name} upright meaning: Opportunities and growth around this card.",
                "metadata": {"card_name": name, "orientation": "upright"},
            }
        )
        rows.append(
            {
                "id": f"{_slugify(name)}-reversed",
                "text": f"{name} reversed meaning: Blockages, delays, or lessons around this card.",
                "metadata": {"card_name": name, "orientation": "reversed"},
            }
        )
    return rows


def build_rag_index(
    corpus_path: str | Path,
    index_path: str | Path,
    meta_path: str | Path,
    embedder: RagEmbedder,
    batch_size: int = 32,
) -> tuple[int, int]:
    if faiss is None:
        raise RuntimeError("faiss-cpu is not installed. Please install faiss-cpu to build RAG index.")

    rows = read_jsonl(corpus_path)
    if not rows:
        raise ValueError(f"Corpus is empty: {corpus_path}")

    texts = [row["text"] for row in rows]
    vectors = embedder.embed_texts(texts, batch_size=batch_size)

    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)

    resolved_index = resolve_path(index_path)
    resolved_index.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(resolved_index))

    meta = []
    for idx, row in enumerate(rows):
        meta.append(
            {
                "vector_id": idx,
                "id": row.get("id", f"row-{idx}"),
                "text": row.get("text", ""),
                "metadata": row.get("metadata", {}),
            }
        )

    resolved_meta = resolve_path(meta_path)
    resolved_meta.parent.mkdir(parents=True, exist_ok=True)
    with resolved_meta.open("wb") as handle:
        pickle.dump(meta, handle)

    LOGGER.info("Built RAG index with %d vectors, dim=%d", vectors.shape[0], vectors.shape[1])
    return vectors.shape[0], vectors.shape[1]
