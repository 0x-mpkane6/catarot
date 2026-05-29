"""Card-of-the-day affirmation generator.

Pure-Python (no LLM call) to keep latency low and to allow widget-style usage
on the frontend. The output is deterministic per card/orientation/date so the
same affirmation is shown on the same day for the same card.
"""
from __future__ import annotations

import hashlib
from datetime import date

# Keyword bank by Major Arcana, used as fallback when card metadata is missing.
_DEFAULT_KEYWORDS_UPRIGHT: dict[str, list[str]] = {
    "The Fool": ["beginnings", "trust", "leap"],
    "The Magician": ["focus", "willpower", "creation"],
    "The High Priestess": ["intuition", "stillness", "inner voice"],
    "The Empress": ["nurture", "abundance", "creativity"],
    "The Emperor": ["structure", "leadership", "boundaries"],
    "The Hierophant": ["tradition", "guidance", "learning"],
    "The Lovers": ["choice", "alignment", "harmony"],
    "The Chariot": ["momentum", "willpower", "victory"],
    "Strength": ["courage", "patience", "soft power"],
    "The Hermit": ["reflection", "wisdom", "solitude"],
    "Wheel of Fortune": ["cycles", "luck", "turning points"],
    "Justice": ["truth", "fairness", "accountability"],
    "The Hanged Man": ["pause", "perspective", "surrender"],
    "Death": ["transformation", "release", "renewal"],
    "Temperance": ["balance", "patience", "blending"],
    "The Devil": ["awareness", "release", "freedom"],
    "The Tower": ["clarity", "rebuild", "honesty"],
    "The Star": ["hope", "healing", "guidance"],
    "The Moon": ["intuition", "shadow", "discernment"],
    "The Sun": ["joy", "vitality", "clarity"],
    "Judgement": ["awakening", "calling", "rebirth"],
    "The World": ["completion", "wholeness", "celebration"],
}

# Default suit themes for Minor Arcana
_SUIT_THEMES: dict[str, list[str]] = {
    "Cups": ["emotion", "love", "intuition"],
    "Wands": ["passion", "energy", "drive"],
    "Swords": ["clarity", "truth", "decisions"],
    "Pentacles": ["stability", "growth", "manifestation"],
}

_AFFIRMATION_TEMPLATES_UPRIGHT = [
    "Today I open myself to {kw1}, knowing {kw2} will guide my next step.",
    "I welcome {kw1} into my day. I trust the rhythm of {kw2}.",
    "I am steady in {kw1}; I act with {kw2}; I rest in {kw3}.",
    "Even in uncertainty, I choose {kw1}. {kw2} is enough for today.",
    "I let {kw1} lead, and I let {kw2} ground me.",
]

_AFFIRMATION_TEMPLATES_REVERSED = [
    "I notice where {kw1} feels blocked, and I gently invite {kw2} back in.",
    "Today I release the resistance to {kw1}. {kw2} returns when I am ready.",
    "I forgive what is unfinished and lean toward {kw1} once again.",
    "I honor the lesson hidden in {kw1}; {kw2} is my path home.",
    "Slowness is allowed. I let {kw1} settle so {kw2} can rise.",
]


def _digest_index(seed: str, modulo: int) -> int:
    if modulo <= 0:
        return 0
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % modulo


def _pick_keywords(card_name: str, suit: str | None) -> list[str]:
    if card_name in _DEFAULT_KEYWORDS_UPRIGHT:
        return list(_DEFAULT_KEYWORDS_UPRIGHT[card_name])
    if suit and suit in _SUIT_THEMES:
        return list(_SUIT_THEMES[suit])
    return ["presence", "trust", "clarity"]


def generate_affirmation(
    *,
    card_name: str,
    orientation: str = "upright",
    suit: str | None = None,
    keywords: list[str] | None = None,
    target_date: date | None = None,
) -> dict[str, object]:
    """Build a deterministic affirmation for the given card/orientation/date."""

    clean_card = (card_name or "").strip() or "The Fool"
    clean_orientation = (orientation or "upright").strip().lower()
    if clean_orientation not in {"upright", "reversed"}:
        clean_orientation = "upright"

    chosen_keywords = [k.strip() for k in (keywords or []) if k and k.strip()]
    if not chosen_keywords:
        chosen_keywords = _pick_keywords(clean_card, suit)
    while len(chosen_keywords) < 3:
        chosen_keywords.append(chosen_keywords[-1])

    iso_day = (target_date or date.today()).isoformat()
    seed = f"{clean_card}|{clean_orientation}|{iso_day}"

    template_pool = (
        _AFFIRMATION_TEMPLATES_REVERSED
        if clean_orientation == "reversed"
        else _AFFIRMATION_TEMPLATES_UPRIGHT
    )
    template = template_pool[_digest_index(seed + "|t", len(template_pool))]
    rotation = _digest_index(seed + "|k", len(chosen_keywords))
    rotated = chosen_keywords[rotation:] + chosen_keywords[:rotation]

    text = template.format(kw1=rotated[0], kw2=rotated[1], kw3=rotated[2 % len(rotated)])

    return {
        "card_name": clean_card,
        "orientation": clean_orientation,
        "date": iso_day,
        "keywords": rotated[:3],
        "affirmation": text,
        "tone": "gentle" if clean_orientation == "reversed" else "uplifting",
    }
