from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from src.asr.transcribe import transcribe_audio
from src.db.models import DreamEntry, ReadingSession, RecognizedCard, TarotCard
from src.db.session import session_scope
from src.llm.generate import ReadingGenerator
from src.utils.config import resolve_path

_ARRAY_RE = re.compile(r"\[[\s\S]*\]")


def _symbol_map() -> dict[str, list[str]]:
    path = resolve_path("./configs/dream_symbol_map.json")
    if not Path(path).exists():
        return {}
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    output: dict[str, list[str]] = {}
    if not isinstance(payload, dict):
        return output
    for key, value in payload.items():
        if not isinstance(key, str) or not isinstance(value, list):
            continue
        output[key.lower().strip()] = [str(item).strip() for item in value if str(item).strip()]
    return output


def _extract_json_array(text: str) -> list[str]:
    match = _ARRAY_RE.search(text or "")
    if not match:
        return []
    try:
        payload = json.loads(match.group(0))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    return [str(item).strip().lower() for item in payload if str(item).strip()]


def _llm_extract_symbols(text: str) -> list[str]:
    if not text.strip():
        return []
    reader = ReadingGenerator()
    system_prompt = "Extract 3-7 concise dream symbols from text. Return only a JSON array of lowercase strings."
    user_prompt = f"DREAM_TEXT:\n{text}"

    content = ""
    if reader.api_key:
        try:
            content = reader._generate_openai(system_prompt, user_prompt)  # type: ignore[attr-defined]
        except Exception:
            content = ""
    if not content and reader.ollama_enabled:
        try:
            content = reader._generate_ollama(system_prompt, user_prompt)  # type: ignore[attr-defined]
        except Exception:
            content = ""
    return _extract_json_array(content)


def _rule_extract_symbols(text: str, mapping: dict[str, list[str]]) -> list[str]:
    clean = (text or "").lower()
    output = []
    for symbol in mapping.keys():
        if symbol in clean:
            output.append(symbol)
    return output


def _map_symbols_to_arcana(symbols: list[str], mapping: dict[str, list[str]]) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for symbol in symbols:
        cards = mapping.get(symbol.lower(), [])
        rows.append({"symbol": symbol, "arcana_candidates": cards})
    return rows


def _cross_reference_recent_readings(user_id: int | None, mapped: list[dict[str, object]], days: int = 7) -> list[dict]:
    if user_id is None:
        return []
    card_pool = {
        card
        for row in mapped
        for card in (row.get("arcana_candidates") or [])
        if isinstance(card, str) and card
    }
    if not card_pool:
        return []

    since = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        rows = session.execute(
            select(
                ReadingSession.id,
                ReadingSession.created_at,
                TarotCard.name,
                RecognizedCard.orientation,
            )
            .join(RecognizedCard, RecognizedCard.session_id == ReadingSession.id)
            .join(TarotCard, TarotCard.id == RecognizedCard.card_id)
            .where(
                ReadingSession.user_id == user_id,
                ReadingSession.created_at >= since,
                TarotCard.name.in_(card_pool),
            )
            .order_by(ReadingSession.created_at.desc())
            .limit(30)
        ).all()

    return [
        {
            "session_id": row[0],
            "created_at": row[1].isoformat() if row[1] else None,
            "card_name": row[2],
            "orientation": row[3],
        }
        for row in rows
    ]


def create_dream_entry(*, user_id: int | None, raw_text: str | None, audio_path: str | None) -> dict:
    transcript, warnings = transcribe_audio(audio_path)
    combined_text = " ".join([raw_text or "", transcript or ""]).strip()

    mapping = _symbol_map()
    symbols = _llm_extract_symbols(combined_text)
    if not symbols:
        symbols = _rule_extract_symbols(combined_text, mapping)
    symbols = list(dict.fromkeys(symbols))[:7]

    mapped = _map_symbols_to_arcana(symbols, mapping)
    matches = _cross_reference_recent_readings(user_id=user_id, mapped=mapped, days=7)

    with session_scope() as session:
        row = DreamEntry(
            user_id=user_id,
            raw_text=(raw_text or "").strip() or None,
            transcript=(transcript or "").strip() or None,
            symbols_json=json.dumps(symbols, ensure_ascii=False),
            mapped_arcana_json=json.dumps(mapped, ensure_ascii=False),
            matches_json=json.dumps(matches, ensure_ascii=False),
        )
        session.add(row)
        session.flush()
        created_id = row.id
        created_at = row.created_at

    return {
        "id": created_id,
        "user_id": user_id,
        "raw_text": raw_text,
        "transcript": transcript,
        "symbols": symbols,
        "mapped_arcana": mapped,
        "matches": matches,
        "warnings": warnings,
        "created_at": created_at.isoformat() if created_at else None,
    }


def list_dream_entries(user_id: int, limit: int = 20) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(DreamEntry)
            .where(DreamEntry.user_id == user_id)
            .order_by(DreamEntry.created_at.desc())
            .limit(limit)
        ).all()
    output: list[dict] = []
    for row in rows:
        output.append(
            {
                "id": row.id,
                "user_id": row.user_id,
                "raw_text": row.raw_text,
                "transcript": row.transcript,
                "symbols": json.loads(row.symbols_json or "[]"),
                "mapped_arcana": json.loads(row.mapped_arcana_json or "[]"),
                "matches": json.loads(row.matches_json or "[]"),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return output


def get_dream_entry(user_id: int, dream_id: int) -> dict | None:
    with session_scope() as session:
        row = session.scalar(
            select(DreamEntry).where(
                DreamEntry.id == dream_id,
                DreamEntry.user_id == user_id,
            )
        )
    if row is None:
        return None
    return {
        "id": row.id,
        "user_id": row.user_id,
        "raw_text": row.raw_text,
        "transcript": row.transcript,
        "symbols": json.loads(row.symbols_json or "[]"),
        "mapped_arcana": json.loads(row.mapped_arcana_json or "[]"),
        "matches": json.loads(row.matches_json or "[]"),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }

