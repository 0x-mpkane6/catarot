from __future__ import annotations

import pytest

from src.utils.config import get_config_value, load_config, resolve_path
from src.utils.io import read_jsonl
from src.vision.embedder import VisionEmbedder
from src.vision.predict_card import CardPredictor


def test_vision_smoke() -> None:
    config = load_config()
    index_path = resolve_path(get_config_value(config, "paths", "vision_index_path", default="./models/vision/faiss.index"))
    meta_path = resolve_path(get_config_value(config, "paths", "vision_meta_path", default="./models/vision/faiss_meta.json"))

    _ = VisionEmbedder(force_demo=True)

    if not index_path.exists() or not meta_path.exists():
        pytest.skip("Vision index not built yet; skip smoke test.")

    predictor = CardPredictor(
        index_path=str(index_path),
        meta_path=str(meta_path),
        top_k=5,
        tarot_images_json_path=get_config_value(config, "paths", "tarot_images_json", default=""),
        embedder=VisionEmbedder(force_demo=True),
    )

    manifest_path = resolve_path(get_config_value(config, "paths", "gallery_manifest", default="./data/processed/gallery/gallery_manifest.jsonl"))
    if not manifest_path.exists():
        pytest.skip("Gallery manifest not found; skip smoke test.")

    rows = read_jsonl(manifest_path)
    if not rows:
        pytest.skip("Gallery manifest empty; skip smoke test.")

    image_path = rows[0]["path"]
    result = predictor.predict(image_path)

    assert "name" in result
    assert "orientation" in result
    assert "confidence" in result
    assert "topk_candidates" in result
