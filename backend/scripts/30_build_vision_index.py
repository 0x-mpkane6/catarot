#!/usr/bin/env python
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.config import get_config_value, load_config, resolve_path
from src.vision.embedder import VisionEmbedder
from src.vision.index import build_vision_index_from_manifest


def main() -> int:
    config = load_config()
    manifest_path = resolve_path(get_config_value(config, "paths", "gallery_manifest", default="./data/processed/gallery/gallery_manifest.jsonl"))
    if not manifest_path.exists():
        print("[ERROR] Gallery manifest not found. Run: python scripts/20_build_gallery.py")
        return 1

    vision_model_name = get_config_value(config, "vision", "model_name", default="ViT-B-32")
    vision_pretrained = get_config_value(config, "vision", "pretrained", default="laion2b_s34b_b79k")
    vision_device = get_config_value(config, "vision", "device", default="cpu")

    embedder = VisionEmbedder(
        model_name=vision_model_name,
        pretrained=vision_pretrained,
        device=vision_device,
    )

    index_path = get_config_value(config, "paths", "vision_index_path", default="./models/vision/faiss.index")
    meta_path = get_config_value(config, "paths", "vision_meta_path", default="./models/vision/faiss_meta.json")

    count, dim = build_vision_index_from_manifest(
        manifest_path=manifest_path,
        index_path=index_path,
        meta_path=meta_path,
        embedder=embedder,
    )
    print(f"[OK] Vision index built: vectors={count}, dim={dim}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
