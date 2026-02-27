from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class TarotCard:
    name: str
    number: str
    arcana: str
    suit: str | None
    image_file: str | None

    def to_state(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "number": self.number,
            "arcana": self.arcana,
            "suit": self.suit,
            "image_file": self.image_file,
        }

    @classmethod
    def from_state(cls, payload: dict[str, Any]) -> "TarotCard":
        return cls(
            name=str(payload["name"]),
            number=str(payload["number"]),
            arcana=str(payload["arcana"]),
            suit=payload.get("suit"),
            image_file=payload.get("image_file"),
        )


def load_tarot_cards(data_file: Path) -> list[TarotCard]:
    if not data_file.exists():
        raise FileNotFoundError(f"Khong tim thay data file: {data_file}")

    payload = json.loads(data_file.read_text(encoding="utf-8"))
    raw_cards = payload.get("cards", [])
    cards: list[TarotCard] = []

    for card in raw_cards:
        cards.append(
            TarotCard(
                name=str(card["name"]),
                number=str(card["number"]),
                arcana=str(card["arcana"]),
                suit=card.get("suit"),
                image_file=card.get("img"),
            )
        )

    if len(cards) < 3:
        raise ValueError("Data tarot khong du so luong de rut 3 la.")

    return cards
