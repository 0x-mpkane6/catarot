from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import func, select

from src.db.models import ReadingSession, RecognizedCard, TarotCard, User, UserArchetypeProfile
from src.db.session import session_scope

TOKEN_RE = re.compile(r"[a-zA-Z0-9_]+")
STOPWORDS = {
    "the",
    "a",
    "an",
    "to",
    "for",
    "and",
    "or",
    "is",
    "are",
    "i",
    "my",
    "of",
    "in",
    "on",
    "ve",
    "la",
    "toi",
    "va",
    "cho",
    "mot",
    "nhung",
    "nay",
    "kia",
}


def _extract_top_keywords(questions: list[str], top_k: int = 3) -> list[str]:
    counter: Counter[str] = Counter()
    for text in questions:
        for token in TOKEN_RE.findall((text or "").lower()):
            if len(token) < 3 or token in STOPWORDS:
                continue
            counter[token] += 1
    return [token for token, _ in counter.most_common(top_k)]


def _build_summary(*, soul_card: str, top_keywords: list[str], top_emotion: str | None) -> str:
    parts = [f"Soul Card dominates as {soul_card}."]
    if top_keywords:
        parts.append(f"Recurring themes: {', '.join(top_keywords)}.")
    if top_emotion:
        parts.append(f"Common emotional tone: {top_emotion}.")
    return " ".join(parts)


def compute_user_archetype_profile(user_id: int, min_sessions: int = 5) -> dict | None:
    with session_scope() as session:
        sessions = session.scalars(
            select(ReadingSession)
            .where(ReadingSession.user_id == user_id)
            .order_by(ReadingSession.created_at.desc())
        ).all()
        if len(sessions) < min_sessions:
            return None

        session_ids = [row.id for row in sessions]
        card_rows = session.execute(
            select(TarotCard.name)
            .join(RecognizedCard, RecognizedCard.card_id == TarotCard.id)
            .where(RecognizedCard.session_id.in_(session_ids))
        ).all()
        questions = [row.question_text for row in sessions if row.question_text]
        emotions = [row.emotion_state for row in sessions if row.emotion_state]

        if not card_rows:
            return None

        card_counter = Counter([row[0] for row in card_rows])
        soul_card, _ = card_counter.most_common(1)[0]
        top_keywords = _extract_top_keywords(questions, top_k=3)
        top_emotion = Counter(emotions).most_common(1)[0][0] if emotions else None
        summary = _build_summary(soul_card=soul_card, top_keywords=top_keywords, top_emotion=top_emotion)

        profile = session.scalar(select(UserArchetypeProfile).where(UserArchetypeProfile.user_id == user_id))
        if profile is None:
            profile = UserArchetypeProfile(
                user_id=user_id,
                soul_card=soul_card,
                top_keywords_json=json.dumps(top_keywords, ensure_ascii=False),
                pattern_summary=summary,
                computed_at=datetime.now(timezone.utc),
            )
            session.add(profile)
        else:
            profile.soul_card = soul_card
            profile.top_keywords_json = json.dumps(top_keywords, ensure_ascii=False)
            profile.pattern_summary = summary
            profile.computed_at = datetime.now(timezone.utc)
        session.flush()

    return {
        "user_id": user_id,
        "soul_card": soul_card,
        "top_keywords": top_keywords,
        "pattern_summary": summary,
        "computed_at": profile.computed_at.isoformat() if profile and profile.computed_at else None,
    }


def get_user_archetype_profile(user_id: int) -> dict | None:
    with session_scope() as session:
        profile = session.scalar(select(UserArchetypeProfile).where(UserArchetypeProfile.user_id == user_id))
    if profile is None:
        return None
    try:
        top_keywords = json.loads(profile.top_keywords_json or "[]")
    except Exception:
        top_keywords = []
    return {
        "user_id": user_id,
        "soul_card": profile.soul_card,
        "top_keywords": top_keywords,
        "pattern_summary": profile.pattern_summary,
        "computed_at": profile.computed_at.isoformat() if profile.computed_at else None,
    }


def run_archetype_weekly_job(min_sessions: int = 5) -> dict[str, int]:
    stats = {"processed": 0, "updated": 0}
    with session_scope() as session:
        user_ids = session.scalars(select(User.id)).all()

    for user_id in user_ids:
        stats["processed"] += 1
        profile = compute_user_archetype_profile(user_id=user_id, min_sessions=min_sessions)
        if profile is not None:
            stats["updated"] += 1
    return stats

