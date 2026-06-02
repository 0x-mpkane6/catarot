from __future__ import annotations

import os
import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from src.db.init_db import initialize_database_if_needed
from src.db.models import RatingReminder, Reading, ReadingSession, RecognizedCard, TarotCard
from src.db.session import session_scope
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}
_VALID_ORIENTATIONS = {"upright", "reversed"}
_VALID_REMINDER_DAYS = {7, 14, 30}


def _db_enabled() -> bool:
    return os.getenv("DB_ENABLED", "true").strip().lower() in _BOOL_TRUE


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_orientation(value: Any) -> str:
    orientation = _normalize_text(value).lower()
    if orientation in _VALID_ORIENTATIONS:
        return orientation
    return "upright"


def _normalize_user_id(value: int | None) -> int | None:
    # Client có thể gửi user_id = 0 cho khách (chưa đăng nhập). Không có user 0
    # trong DB nên giữ nguyên 0 sẽ vi phạm khóa ngoại và làm cả phiên lưu thất bại
    # âm thầm. Coerce mọi id không hợp lệ về None (lưu ẩn danh).
    try:
        user_id = int(value) if value is not None else None
    except (TypeError, ValueError):
        return None
    if user_id is None or user_id <= 0:
        return None
    return user_id


def _get_or_create_tarot_card(session: Session, card_name: str) -> TarotCard:
    clean_name = _normalize_text(card_name) or "Unknown Card"

    existing = session.scalar(
        select(TarotCard).where(func.lower(TarotCard.name) == clean_name.lower())
    )
    if existing is not None:
        return existing

    fallback_card = TarotCard(
        name=clean_name,
        arcana_type="Unknown",
        suit=None,
        number=None,
    )
    session.add(fallback_card)
    session.flush()
    return fallback_card


def _llm_model_from_result(result: dict[str, Any]) -> str | None:
    model = _normalize_text(result.get("llm_model"))
    if model:
        return model
    return None


def _normalize_rating_reminder_days(value: Any) -> int:
    try:
        days = int(value)
    except (TypeError, ValueError):
        return 7
    if days not in _VALID_REMINDER_DAYS:
        return 7
    return days


def persist_reading_result(
    *,
    question: str,
    result: dict[str, Any],
    user_id: int | None = None,
    rating_reminder_days: int = 7,
) -> int | None:
    if not _db_enabled():
        return None

    user_id = _normalize_user_id(user_id)

    try:
        initialize_database_if_needed(seed_reference_data=True)
        with session_scope() as session:
            reading_session = ReadingSession(
                user_id=user_id,
                question_text=_normalize_text(question),
                audio_transcript=_normalize_text(result.get("transcript")) or None,
                emotion_state=_normalize_text(result.get("emotion_state")) or None,
                emotion_signal_json=(
                    json.dumps(result.get("emotion_signal"), ensure_ascii=False)
                    if isinstance(result.get("emotion_signal"), dict)
                    else None
                ),
                status="completed",
            )
            session.add(reading_session)
            session.flush()

            cards = result.get("cards") or []
            if isinstance(cards, list):
                for idx, card in enumerate(cards):
                    if not isinstance(card, dict):
                        continue

                    tarot_card = _get_or_create_tarot_card(session, _normalize_text(card.get("name")))
                    session.add(
                        RecognizedCard(
                            session_id=reading_session.id,
                            card_id=tarot_card.id,
                            orientation=_normalize_orientation(card.get("orientation")),
                            confidence=_as_float(card.get("confidence"), default=0.0),
                            position_label=_normalize_text(card.get("position")) or None,
                            order_index=idx,
                        )
                    )

            final_answer = _normalize_text(result.get("final_answer"))
            session.add(
                Reading(
                    session_id=reading_session.id,
                    generated_text=final_answer,
                    llm_model=_llm_model_from_result(result),
                )
            )

            if user_id is not None:
                reminder_days = _normalize_rating_reminder_days(rating_reminder_days)
                session.add(
                    RatingReminder(
                        session_id=reading_session.id,
                        user_id=user_id,
                        remind_at=datetime.now(timezone.utc) + timedelta(days=reminder_days),
                        status="pending",
                        attempts=0,
                    )
                )

            session.flush()
            return reading_session.id
    except (OperationalError, IntegrityError, ProgrammingError) as exc:
        # Lỗi vận hành/DB nghiêm trọng (mất kết nối, sai schema, thiếu quyền, vi phạm ràng buộc):
        # log mức ERROR kèm ngữ cảnh để phát hiện sớm trên production, thay vì âm thầm bỏ qua như
        # một lỗi có thể chấp nhận. Vẫn trả None để phiên đọc bài không sập vì lỗi lưu trữ.
        cards = result.get("cards")
        LOGGER.error(
            "Persist reading FAILED (operational): %s | user_id=%s cards=%d q_len=%d",
            exc,
            user_id,
            len(cards) if isinstance(cards, list) else 0,
            len(_normalize_text(question)),
        )
        return None
    except Exception as exc:
        LOGGER.warning("Database persistence skipped due to error: %s", exc)
        return None
