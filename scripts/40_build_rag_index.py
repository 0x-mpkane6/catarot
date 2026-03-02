#!/usr/bin/env python
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.rag.build_index import RagEmbedder, build_rag_index, ensure_corpus_exists
from src.utils.config import get_config_value, load_config


def main() -> int:
    config = load_config()

    corpus_path = get_config_value(config, "paths", "rag_corpus", default="./data/rag_corpus/corpus.jsonl")
    card_data_path = get_config_value(config, "paths", "card_data", default="./data/rag_corpus/card_data.json")
    tarot_images_json_path = get_config_value(config, "paths", "tarot_images_json", default="./data/raw/tarot_json/tarot-images.json")

    ensure_corpus_exists(
        corpus_path=corpus_path,
        card_data_path=card_data_path,
        tarot_images_json_path=tarot_images_json_path,
    )

    model_name = get_config_value(config, "rag", "model_name", default="sentence-transformers/all-MiniLM-L6-v2")
    device = get_config_value(config, "rag", "device", default="cpu")
    batch_size = int(get_config_value(config, "rag", "batch_size", default=32))

    embedder = RagEmbedder(model_name=model_name, device=device)

    index_path = get_config_value(config, "paths", "rag_index_path", default="./models/rag/index.faiss")
    meta_path = get_config_value(config, "paths", "rag_meta_path", default="./models/rag/meta.pkl")

    count, dim = build_rag_index(
        corpus_path=corpus_path,
        index_path=index_path,
        meta_path=meta_path,
        embedder=embedder,
        batch_size=batch_size,
    )

    print(f"[OK] RAG index built: vectors={count}, dim={dim}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
