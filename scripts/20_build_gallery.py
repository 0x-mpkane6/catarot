#!/usr/bin/env python
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.config import get_config_value, load_config, resolve_path
from src.utils.io import write_jsonl
from src.utils.logging import get_logger
from src.vision.preprocess import load_image, prepare_gallery_image, rotate_180

LOGGER = get_logger(__name__)
SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(text: str) -> str:
    return SLUG_RE.sub("_", text.lower()).strip("_")


def build_gallery() -> int:
    config = load_config()
    tarot_images_json = resolve_path(get_config_value(config, "paths", "tarot_images_json", default="./data/raw/tarot_json/tarot-images.json"))
    raw_cards_dir = tarot_images_json.parent / "cards"

    if not tarot_images_json.exists() or not raw_cards_dir.exists():
        print(
            "[ERROR] Dataset not found. Expected files:\n"
            f"  - {tarot_images_json}\n"
            f"  - {raw_cards_dir}\n"
            "Please place tarot-json dataset under data/raw/tarot_json",
            file=sys.stderr,
        )
        return 1

    with tarot_images_json.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    gallery_root = resolve_path("./data/processed/gallery")
    upright_root = gallery_root / "upright"
    reversed_root = gallery_root / "reversed"
    upright_root.mkdir(parents=True, exist_ok=True)
    reversed_root.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    for card in payload.get("cards", []):
        card_name = card.get("name")
        image_name = card.get("img")
        if not card_name or not image_name:
            continue

        source_path = raw_cards_dir / image_name
        if not source_path.exists():
            LOGGER.warning("Missing source image: %s", source_path)
            continue

        card_slug = slugify(card_name)
        upright_dir = upright_root / card_slug
        reversed_dir = reversed_root / card_slug
        upright_dir.mkdir(parents=True, exist_ok=True)
        reversed_dir.mkdir(parents=True, exist_ok=True)

        upright_path = upright_dir / "ref.png"
        reversed_path = reversed_dir / "ref.png"

        image = load_image(source_path)
        upright_image = prepare_gallery_image(image)
        reversed_image = rotate_180(upright_image)

        upright_image.save(upright_path, format="PNG")
        reversed_image.save(reversed_path, format="PNG")

        manifest_rows.append(
            {
                "id": f"{card_slug}_upright",
                "card_name": card_name,
                "orientation": "upright",
                "path": str(upright_path),
            }
        )
        manifest_rows.append(
            {
                "id": f"{card_slug}_reversed",
                "card_name": card_name,
                "orientation": "reversed",
                "path": str(reversed_path),
            }
        )

    if not manifest_rows:
        print("[ERROR] No gallery rows were generated. Check dataset integrity.", file=sys.stderr)
        return 1

    manifest_path = gallery_root / "gallery_manifest.jsonl"
    write_jsonl(manifest_path, manifest_rows)
    print(f"[OK] Gallery generated: {manifest_path} ({len(manifest_rows)} rows)")
    return 0


def main() -> int:
    try:
        return build_gallery()
    except Exception as exc:
        print(f"[ERROR] Failed to build gallery: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
