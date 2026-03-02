#!/usr/bin/env python
from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.utils.config import get_config_value, load_config, resolve_path
from src.vision.predict_card import CardPredictor


def _resolve_eval_image(eval_dir: Path, filename: str) -> Path:
    path = Path(filename)
    if path.is_absolute():
        return path
    return eval_dir / filename


def main() -> int:
    config = load_config()
    eval_labels = resolve_path("./data/processed/eval/labels.csv")
    eval_dir = eval_labels.parent

    if not eval_labels.exists():
        print("[WARN] Eval labels not found at data/processed/eval/labels.csv - skip evaluation.")
        return 0

    predictor = CardPredictor(
        index_path=get_config_value(config, "paths", "vision_index_path", default="./models/vision/faiss.index"),
        meta_path=get_config_value(config, "paths", "vision_meta_path", default="./models/vision/faiss_meta.json"),
        top_k=5,
        tarot_images_json_path=get_config_value(config, "paths", "tarot_images_json", default=""),
    )

    threshold = float(get_config_value(config, "app", "confidence_threshold", default=0.18))

    rows = []
    with eval_labels.open("r", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append(row)

    if not rows:
        print("[WARN] Eval labels file is empty - skip evaluation.")
        return 0

    total = 0
    recall_at_1 = 0
    recall_at_3 = 0
    recall_at_5 = 0
    orientation_correct = 0
    rejected = 0
    confusions = Counter()

    for row in rows:
        filename = row.get("filename", "")
        gt_name = row.get("card_name", "")
        gt_orientation = row.get("orientation", "")
        image_path = _resolve_eval_image(eval_dir, filename)

        if not image_path.exists():
            print(f"[WARN] Missing eval image: {image_path}")
            continue

        pred = predictor.predict(str(image_path))
        candidates = pred.get("topk_candidates", [])
        pred_name = pred.get("name", "Unknown")
        pred_orientation = pred.get("orientation", "upright")
        confidence = float(pred.get("confidence", 0.0))

        total += 1
        if confidence < threshold:
            rejected += 1

        names_top1 = [(c.get("name"), c.get("orientation")) for c in candidates[:1]]
        names_top3 = [(c.get("name"), c.get("orientation")) for c in candidates[:3]]
        names_top5 = [(c.get("name"), c.get("orientation")) for c in candidates[:5]]

        if any(name == gt_name for name, _ in names_top1):
            recall_at_1 += 1
        if any(name == gt_name for name, _ in names_top3):
            recall_at_3 += 1
        if any(name == gt_name for name, _ in names_top5):
            recall_at_5 += 1

        if pred_name == gt_name and pred_orientation == gt_orientation:
            orientation_correct += 1

        if pred_name != gt_name:
            confusions[(gt_name, pred_name)] += 1

    if total == 0:
        print("[WARN] No evaluable samples after filtering missing images.")
        return 0

    print(f"samples={total}")
    print(f"recall@1={recall_at_1 / total:.4f}")
    print(f"recall@3={recall_at_3 / total:.4f}")
    print(f"recall@5={recall_at_5 / total:.4f}")
    print(f"orientation_accuracy={orientation_correct / total:.4f}")
    print(f"reject@threshold({threshold:.2f})={rejected / total:.4f}")

    print("top_confusions:")
    for (gt, pred), count in confusions.most_common(10):
        print(f"  {gt} -> {pred}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
