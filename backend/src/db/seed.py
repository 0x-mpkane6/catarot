from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import TarotCard

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TAROT_JSON_PATH = PROJECT_ROOT / "data" / "raw" / "tarot_json" / "tarot.json"


def _to_int(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def load_tarot_seed_rows(tarot_json_path: Path | None = None) -> list[dict[str, Any]]:
    source = tarot_json_path or DEFAULT_TAROT_JSON_PATH
    if not source.exists():
        return []

    payload = json.loads(source.read_text(encoding="utf-8"))
    cards = payload.get("cards", [])
    if not isinstance(cards, list):
        return []

    output: list[dict[str, Any]] = []
    for row in cards:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", "")).strip()
        if not name:
            continue
        output.append(
            {
                "name": name,
                "arcana_type": str(row.get("arcana", "Unknown")).strip() or "Unknown",
                "suit": (str(row["suit"]).strip() if row.get("suit") else None),
                "number": _to_int(row.get("number")),
            }
        )
    return output


def seed_tarot_cards(session: Session, tarot_json_path: Path | None = None) -> int:
    rows = load_tarot_seed_rows(tarot_json_path)
    if not rows:
        return 0

    existing_names = {name for name in session.scalars(select(TarotCard.name))}
    to_insert = [
        TarotCard(
            name=row["name"],
            arcana_type=row["arcana_type"],
            suit=row["suit"],
            number=row["number"],
        )
        for row in rows
        if row["name"] not in existing_names
    ]

    if to_insert:
        session.add_all(to_insert)
    return len(to_insert)
