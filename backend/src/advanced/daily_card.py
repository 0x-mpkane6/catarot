"""Daily Card + Streak feature.

Each user can draw exactly ONE Daily Card per local day. The system tracks:
  - current streak: consecutive days the user drew a card
  - longest streak
  - total draws
  - reflection notes (free text + optional mood tags)

This drives daily engagement (Duolingo-style) and gives user-level data that
feeds back into archetype profiling.
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.advanced.affirmations import generate_affirmation
from src.db.models import DailyCard, TarotCard
from src.db.session import session_scope
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

LOGGER = get_logger(__name__)

_VALID_MOODS = {
    "calm",
    "anxious",
    "hopeful",
    "tired",
    "grateful",
    "uncertain",
    "joyful",
    "lonely",
    "focused",
    "sad",
    "neutral",
    "angry",
    "inspired",
}


@dataclass
class _StreakSnapshot:
    current_streak: int
    longest_streak: int
    total_draws: int
    last_draw_date: str | None


def _today_local_iso() -> str:
    tz = get_app_timezone(logger=LOGGER)
    return datetime.now(tz=tz).date().isoformat()


def _safe_mood(value: Any) -> str | None:
    if value is None:
        return None
    candidate = str(value).strip().lower()
    if not candidate:
        return None
    if candidate not in _VALID_MOODS:
        return None
    return candidate


def _streak_snapshot(session, user_id: int) -> _StreakSnapshot:
    rows = session.execute(
        select(DailyCard.draw_date)
        .where(DailyCard.user_id == user_id)
        .order_by(DailyCard.draw_date.desc())
    ).all()

    dates = [row[0] for row in rows]
    if not dates:
        return _StreakSnapshot(current_streak=0, longest_streak=0, total_draws=0, last_draw_date=None)

    total_draws = len(dates)
    last_draw_date = dates[0]

    today_iso = _today_local_iso()
    today_date = date.fromisoformat(today_iso)
    most_recent = date.fromisoformat(last_draw_date)

    if most_recent == today_date or most_recent == today_date - timedelta(days=1):
        current = 1
        cursor = most_recent
        for d_iso in dates[1:]:
            d = date.fromisoformat(d_iso)
            if d == cursor - timedelta(days=1):
                current += 1
                cursor = d
            else:
                break
    else:
        current = 0

    longest = 1
    run = 1
    for prev_iso, next_iso in zip(dates, dates[1:]):
        prev_d = date.fromisoformat(prev_iso)
        next_d = date.fromisoformat(next_iso)
        if prev_d - timedelta(days=1) == next_d:
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    longest = max(longest, current)

    return _StreakSnapshot(
        current_streak=current,
        longest_streak=longest,
        total_draws=total_draws,
        last_draw_date=last_draw_date,
    )


def _pick_random_card(session) -> TarotCard | None:
    cards = session.scalars(select(TarotCard)).all()
    if not cards:
        return None
    return random.choice(cards)


def _serialize_daily_card(record: DailyCard) -> dict[str, Any]:
    try:
        keywords = json.loads(record.keywords_json or "[]")
        if not isinstance(keywords, list):
            keywords = []
    except json.JSONDecodeError:
        keywords = []
    return {
        "id": record.id,
        "user_id": record.user_id,
        "draw_date": record.draw_date,
        "card_name": record.card_name,
        "orientation": record.orientation,
        "keywords": keywords,
        "mood_pre": record.mood_pre,
        "mood_post": record.mood_post,
        "reflection": record.reflection,
        "streak_at_draw": record.streak_at_draw,
        "affirmation": record.affirmation,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


def get_today_card(*, user_id: int) -> dict[str, Any] | None:
    today_iso = _today_local_iso()
    with session_scope() as session:
        record = session.scalar(
            select(DailyCard).where(
                DailyCard.user_id == user_id,
                DailyCard.draw_date == today_iso,
            )
        )
        if record is None:
            return None
        return _serialize_daily_card(record)


def get_card_on_date(*, user_id: int, draw_date: str) -> dict[str, Any] | None:
    """Lấy daily card của 1 user theo ngày (chuỗi ISO YYYY-MM-DD). Dùng cho ảnh share."""
    clean = (draw_date or "").strip()
    if not clean:
        return None
    with session_scope() as session:
        record = session.scalar(
            select(DailyCard).where(
                DailyCard.user_id == user_id,
                DailyCard.draw_date == clean,
            )
        )
        if record is None:
            return None
        return _serialize_daily_card(record)


def draw_today_card(*, user_id: int, mood_pre: Any = None) -> dict[str, Any]:
    """Idempotent: re-calling on the same day returns the existing draw."""
    today_iso = _today_local_iso()
    clean_mood_pre = _safe_mood(mood_pre)

    with session_scope() as session:
        existing = session.scalar(
            select(DailyCard).where(
                DailyCard.user_id == user_id,
                DailyCard.draw_date == today_iso,
            )
        )
        if existing is not None:
            return _serialize_daily_card(existing)

        card = _pick_random_card(session)
        if card is None:
            raise ValueError("no tarot cards seeded")

        orientation = random.choice(["upright", "reversed"])
        snap = _streak_snapshot(session, user_id)

        # +1 streak if yesterday existed, otherwise reset to 1
        yesterday_iso = (date.fromisoformat(today_iso) - timedelta(days=1)).isoformat()
        if snap.last_draw_date == yesterday_iso:
            new_streak = snap.current_streak + 1 if snap.current_streak > 0 else 1
        else:
            new_streak = 1

        keywords_payload: list[str] = []
        affirmation_payload = generate_affirmation(
            card_name=card.name,
            orientation=orientation,
            suit=card.suit,
            keywords=keywords_payload,
        )

        record = DailyCard(
            user_id=user_id,
            draw_date=today_iso,
            card_id=card.id,
            card_name=card.name,
            orientation=orientation,
            keywords_json=json.dumps(affirmation_payload["keywords"], ensure_ascii=False),
            mood_pre=clean_mood_pre,
            mood_post=None,
            reflection=None,
            streak_at_draw=new_streak,
            affirmation=affirmation_payload["affirmation"],
        )

        session.add(record)
        try:
            session.flush()
        except IntegrityError:
            # Race condition: another request inserted today's row in parallel.
            session.rollback()
            with session_scope() as fresh:
                existing = fresh.scalar(
                    select(DailyCard).where(
                        DailyCard.user_id == user_id,
                        DailyCard.draw_date == today_iso,
                    )
                )
                if existing is not None:
                    return _serialize_daily_card(existing)
            raise
        return _serialize_daily_card(record)


def add_reflection(
    *,
    user_id: int,
    daily_card_id: int,
    reflection: str | None,
    mood_post: Any = None,
) -> dict[str, Any]:
    clean_reflection = (reflection or "").strip()
    clean_mood_post = _safe_mood(mood_post)
    if not clean_reflection and clean_mood_post is None:
        raise ValueError("reflection or mood_post is required")

    with session_scope() as session:
        record = session.scalar(
            select(DailyCard).where(
                DailyCard.id == daily_card_id,
                DailyCard.user_id == user_id,
            )
        )
        if record is None:
            raise ValueError("daily card not found")

        if clean_reflection:
            record.reflection = clean_reflection
        if clean_mood_post is not None:
            record.mood_post = clean_mood_post

        session.flush()
        return _serialize_daily_card(record)


def get_streak(*, user_id: int) -> dict[str, Any]:
    with session_scope() as session:
        snap = _streak_snapshot(session, user_id)
    return {
        "user_id": user_id,
        "current_streak": snap.current_streak,
        "longest_streak": snap.longest_streak,
        "total_draws": snap.total_draws,
        "last_draw_date": snap.last_draw_date,
        "as_of_date": _today_local_iso(),
    }


def list_history(*, user_id: int, limit: int = 30) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    with session_scope() as session:
        records = session.scalars(
            select(DailyCard)
            .where(DailyCard.user_id == user_id)
            .order_by(DailyCard.draw_date.desc())
            .limit(limit)
        ).all()
        return [_serialize_daily_card(r) for r in records]
