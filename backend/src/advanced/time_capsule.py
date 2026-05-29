"""Time Capsule reading.

Lets a user lock a tarot prediction with a future reveal date. The capsule is
"sealed" until the reveal date passes. After reveal, the user can record an
accuracy verdict (1-5) plus a free-text note.

This pairs naturally with the existing rating reminder loop and gives long-term
data about which kinds of predictions hold up.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from src.db.models import Reading, ReadingSession, RecognizedCard, TarotCard, TimeCapsule
from src.db.session import session_scope
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

MIN_REVEAL_HOURS = 6  # prevent instant unlock
MAX_REVEAL_DAYS = 365 * 3  # 3 years


@dataclass
class CapsuleCreatePayload:
    title: str
    question_text: str
    prediction_text: str
    reveal_at_iso: str
    cards: list[dict[str, Any]]
    session_id: int | None = None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_aware(value: datetime | None) -> datetime | None:
    """SQLite drops tzinfo; treat naive datetimes as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_reveal_at(value: str | None) -> datetime:
    if not value:
        raise ValueError("reveal_at is required")
    candidate = value.strip()
    if candidate.endswith("Z"):
        candidate = candidate[:-1] + "+00:00"
    try:
        moment = datetime.fromisoformat(candidate)
    except ValueError as exc:
        raise ValueError("reveal_at must be ISO-8601 datetime") from exc
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc)


def _validate_reveal_at(moment: datetime) -> None:
    now = _now()
    if moment < now + timedelta(hours=MIN_REVEAL_HOURS):
        raise ValueError(f"reveal_at must be at least {MIN_REVEAL_HOURS}h in the future")
    if moment > now + timedelta(days=MAX_REVEAL_DAYS):
        raise ValueError(f"reveal_at cannot be more than {MAX_REVEAL_DAYS} days ahead")


def _hydrate_cards_from_session(session, session_id, owner_user_id):
    # Bảo mật: chỉ cho hydrate từ session THUỘC chính user. Lọc theo user_id để
    # tránh IDOR (đoán session_id của người khác để lộ câu hỏi/bài đọc/lá bài).
    reading_session = session.scalar(
        select(ReadingSession).where(
            ReadingSession.id == session_id,
            ReadingSession.user_id == owner_user_id,
        )
    )
    if reading_session is None:
        raise ValueError("reading session not found")

    rows = session.execute(
        select(TarotCard.name, RecognizedCard.orientation, RecognizedCard.confidence, RecognizedCard.position_label)
        .join(RecognizedCard, RecognizedCard.card_id == TarotCard.id)
        .where(RecognizedCard.session_id == session_id)
        .order_by(RecognizedCard.order_index.asc().nullslast())
    ).all()
    cards = [
        {
            "name": row[0],
            "orientation": row[1],
            "confidence": float(row[2] or 0.0),
            "position": row[3],
        }
        for row in rows
    ]
    reading = session.scalar(select(Reading).where(Reading.session_id == session_id))
    prediction = reading.generated_text if reading else None
    return cards, reading_session.question_text, prediction


def _serialize_capsule(record: TimeCapsule, *, include_secret: bool) -> dict[str, Any]:
    try:
        cards = json.loads(record.cards_json or "[]")
        if not isinstance(cards, list):
            cards = []
    except json.JSONDecodeError:
        cards = []

    reveal_at_aware = _ensure_aware(record.reveal_at)
    opened_at_aware = _ensure_aware(record.opened_at)
    created_at_aware = _ensure_aware(record.created_at)

    payload: dict[str, Any] = {
        "id": record.id,
        "user_id": record.user_id,
        "session_id": record.session_id,
        "title": record.title,
        "reveal_at": reveal_at_aware.isoformat() if reveal_at_aware else None,
        "status": record.status,
        "opened_at": opened_at_aware.isoformat() if opened_at_aware else None,
        "accuracy_score": record.accuracy_score,
        "accuracy_note": record.accuracy_note,
        "created_at": created_at_aware.isoformat() if created_at_aware else None,
        "is_unlocked": _now() >= reveal_at_aware if reveal_at_aware else False,
    }

    if include_secret:
        payload.update(
            {
                "question_text": record.question_text,
                "prediction_text": record.prediction_text,
                "cards": cards,
            }
        )
    else:
        payload["seal_message"] = (
            f"Niêm phong đến {reveal_at_aware.isoformat() if reveal_at_aware else 'chưa xác định'}"
        )
    return payload


def create_capsule(
    *,
    user_id: int,
    title: str,
    question_text: str | None,
    prediction_text: str | None,
    reveal_at_iso: str,
    cards: list[dict[str, Any]] | None = None,
    session_id: int | None = None,
) -> dict[str, Any]:
    clean_title = (title or "").strip()
    if not clean_title:
        raise ValueError("title is required")
    if len(clean_title) > 200:
        clean_title = clean_title[:200]

    reveal_at = _parse_reveal_at(reveal_at_iso)
    _validate_reveal_at(reveal_at)

    with session_scope() as session:
        if session_id is not None:
            hydrated_cards, hydrated_question, hydrated_prediction = _hydrate_cards_from_session(
                session, session_id, owner_user_id=user_id
            )
            cards = cards if cards else hydrated_cards
            question_text = (question_text or hydrated_question or "").strip()
            prediction_text = (prediction_text or hydrated_prediction or "").strip()

        clean_question = (question_text or "").strip()
        clean_prediction = (prediction_text or "").strip()
        if not clean_question:
            raise ValueError("question_text is required")
        if not clean_prediction:
            raise ValueError("prediction_text is required")

        clean_cards: list[dict[str, Any]] = []
        for card in cards or []:
            if not isinstance(card, dict):
                continue
            clean_cards.append(
                {
                    "name": str(card.get("name") or "").strip(),
                    "orientation": str(card.get("orientation") or "upright").strip().lower(),
                    "position": str(card.get("position") or "").strip() or None,
                    "confidence": float(card.get("confidence") or 0.0),
                }
            )

        record = TimeCapsule(
            user_id=user_id,
            session_id=session_id,
            title=clean_title,
            question_text=clean_question,
            prediction_text=clean_prediction,
            cards_json=json.dumps(clean_cards, ensure_ascii=False),
            reveal_at=reveal_at,
            status="sealed",
        )
        session.add(record)
        session.flush()
        return _serialize_capsule(record, include_secret=True)


def list_capsules(*, user_id: int, include_revealed_only: bool = False, limit: int = 50) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    with session_scope() as session:
        query = select(TimeCapsule).where(TimeCapsule.user_id == user_id).order_by(TimeCapsule.reveal_at.asc())
        if include_revealed_only:
            query = query.where(TimeCapsule.reveal_at <= _now())
        records = session.scalars(query.limit(limit)).all()
        out: list[dict[str, Any]] = []
        for r in records:
            unlocked = _now() >= _ensure_aware(r.reveal_at)
            out.append(_serialize_capsule(r, include_secret=unlocked))
        return out


def get_capsule(*, user_id: int, capsule_id: int) -> dict[str, Any]:
    with session_scope() as session:
        record = session.scalar(
            select(TimeCapsule).where(
                TimeCapsule.id == capsule_id,
                TimeCapsule.user_id == user_id,
            )
        )
        if record is None:
            raise ValueError("capsule not found")
        unlocked = _now() >= _ensure_aware(record.reveal_at)
        return _serialize_capsule(record, include_secret=unlocked)


def open_capsule(*, user_id: int, capsule_id: int) -> dict[str, Any]:
    with session_scope() as session:
        record = session.scalar(
            select(TimeCapsule).where(
                TimeCapsule.id == capsule_id,
                TimeCapsule.user_id == user_id,
            )
        )
        if record is None:
            raise ValueError("capsule not found")
        if _now() < _ensure_aware(record.reveal_at):
            raise ValueError("capsule is still sealed")

        if record.status == "sealed":
            record.status = "revealed"
            record.opened_at = _now()
            session.flush()
        return _serialize_capsule(record, include_secret=True)


def submit_verdict(
    *,
    user_id: int,
    capsule_id: int,
    accuracy_score: int,
    accuracy_note: str | None,
) -> dict[str, Any]:
    if accuracy_score < 1 or accuracy_score > 5:
        raise ValueError("accuracy_score must be between 1 and 5")

    with session_scope() as session:
        record = session.scalar(
            select(TimeCapsule).where(
                TimeCapsule.id == capsule_id,
                TimeCapsule.user_id == user_id,
            )
        )
        if record is None:
            raise ValueError("capsule not found")
        if _now() < _ensure_aware(record.reveal_at):
            raise ValueError("capsule is still sealed")

        record.accuracy_score = accuracy_score
        record.accuracy_note = (accuracy_note or "").strip() or None
        record.status = "verified"
        if record.opened_at is None:
            record.opened_at = _now()
        session.flush()
        return _serialize_capsule(record, include_secret=True)


def mark_due_capsules_notified(max_batch: int = 100) -> dict[str, int]:
    """Scheduler hook: flip sealed capsules whose reveal_at has passed to 'revealed'."""
    stats = {"revealed": 0, "skipped": 0}
    with session_scope() as session:
        records = session.scalars(
            select(TimeCapsule)
            .where(
                TimeCapsule.status == "sealed",
                TimeCapsule.reveal_at <= _now(),
            )
            .limit(max_batch)
        ).all()
        for r in records:
            r.status = "revealed"
            if r.opened_at is None:
                r.opened_at = _now()
            stats["revealed"] += 1
    if any(stats.values()):
        LOGGER.info("Time capsule scheduler summary: %s", stats)
    return stats
