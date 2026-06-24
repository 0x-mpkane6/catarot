from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception:  # pragma: no cover - optional dependency guard
    BackgroundScheduler = None  # type: ignore[assignment]
from sqlalchemy import select

from src.db.models import RatingReminder, Reading, ReadingSession, User
from src.db.session import session_scope
from src.utils.email import send_email
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

LOGGER = get_logger(__name__)

_BOOL_TRUE = {"1", "true", "yes", "y", "on"}
_SCHEDULER: BackgroundScheduler | None = None


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _BOOL_TRUE


def _scheduler_enabled() -> bool:
    raw = os.getenv("RATING_REMINDER_SCHEDULER_ENABLED", "true")
    return _as_bool(raw, default=True)


def _app_timezone():
    return get_app_timezone(logger=LOGGER)


def _send_rating_email(*, to_email: str, question_text: str, session_id: int) -> None:
    # Gửi qua kênh dùng chung (Resend → SMTP). Ném RuntimeError nếu chưa cấu hình kênh nào;
    # người gọi (process_due_rating_reminders) bắt lỗi → đánh dấu 'failed'.
    body = "\n".join(
        [
            "Xin chào,",
            "",
            "Hãy đánh giá buổi đọc bài tarot của bạn từ 1 đến 5 sao.",
            f"Mã phiên: {session_id}",
            f"Câu hỏi: {question_text}",
            "",
            "Bạn có thể gửi đánh giá ngay trong ứng dụng khi lời nhắc này xuất hiện.",
            "",
            "Trân trọng,",
            "Tarot AI",
        ]
    )
    send_email(
        to_email=to_email,
        subject="Nhắc đánh giá: buổi đọc bài tarot vừa rồi chính xác đến đâu?",
        body=body,
    )


def save_rating(*, session_id: int, score: int, note: str | None) -> dict[str, Any]:
    if score < 1 or score > 5:
        raise ValueError("score must be between 1 and 5")

    now = datetime.now(timezone.utc)
    clean_note = (note or "").strip() or None

    with session_scope() as session:
        reading = session.scalar(select(Reading).where(Reading.session_id == session_id))
        if reading is None:
            raise ValueError("reading not found for this session")

        reading.accuracy_score = score
        reading.accuracy_note = clean_note
        reading.rated_at = now

        reminders = session.scalars(
            select(RatingReminder).where(RatingReminder.session_id == session_id)
        ).all()
        for reminder in reminders:
            reminder.status = "rated"
            reminder.rated_at = now
            reminder.last_error = None

    return {
        "session_id": session_id,
        "score": score,
        "note": clean_note,
        "rated_at": now.isoformat(),
        "status": "rated",
    }


def list_pending_ratings(*, user_id: int, limit: int = 20) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        rows = session.execute(
            select(
                RatingReminder.id,
                RatingReminder.session_id,
                RatingReminder.remind_at,
                RatingReminder.status,
                RatingReminder.attempts,
                RatingReminder.last_error,
                ReadingSession.question_text,
            )
            .join(ReadingSession, ReadingSession.id == RatingReminder.session_id)
            .where(
                RatingReminder.user_id == user_id,
                RatingReminder.status.in_(["pending", "failed", "sent"]),
                RatingReminder.rated_at.is_(None),
                RatingReminder.remind_at <= now,
            )
            .order_by(RatingReminder.remind_at.asc())
            .limit(limit)
        ).all()

    return [
        {
            "reminder_id": row[0],
            "session_id": row[1],
            "remind_at": row[2].isoformat() if row[2] else None,
            "status": row[3],
            "attempts": row[4],
            "last_error": row[5],
            "question_text": row[6],
        }
        for row in rows
    ]


def process_due_rating_reminders(max_batch: int = 100) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    stats = {"sent": 0, "failed": 0, "skipped": 0}

    with session_scope() as session:
        rows = session.execute(
            select(
                RatingReminder,
                User.email,
                ReadingSession.question_text,
            )
            .join(ReadingSession, ReadingSession.id == RatingReminder.session_id)
            .join(User, User.id == RatingReminder.user_id, isouter=True)
            .where(
                RatingReminder.status.in_(["pending", "failed"]),
                RatingReminder.rated_at.is_(None),
                RatingReminder.remind_at <= now,
                RatingReminder.attempts < 3,
            )
            .order_by(RatingReminder.remind_at.asc())
            .limit(max_batch)
        ).all()

        for reminder, email, question_text in rows:
            if not reminder.user_id or not email:
                reminder.status = "skipped"
                reminder.last_error = "missing user email"
                stats["skipped"] += 1
                continue

            try:
                _send_rating_email(
                    to_email=email,
                    question_text=question_text or "(no question)",
                    session_id=reminder.session_id,
                )
                reminder.attempts = int(reminder.attempts or 0) + 1
                reminder.status = "sent"
                reminder.sent_at = now
                reminder.last_error = None
                stats["sent"] += 1
            except Exception as exc:
                reminder.attempts = int(reminder.attempts or 0) + 1
                reminder.status = "failed"
                reminder.last_error = str(exc)[:500]
                stats["failed"] += 1

    if any(stats.values()):
        LOGGER.info("Rating reminder job summary: %s", stats)
    return stats


def start_rating_scheduler() -> None:
    global _SCHEDULER
    if BackgroundScheduler is None:
        LOGGER.warning("APScheduler is unavailable; rating reminder scheduler is disabled.")
        return
    if not _scheduler_enabled():
        LOGGER.info("Rating reminder scheduler disabled by env.")
        return
    if _SCHEDULER is not None:
        return

    try:
        if int(os.getenv("WEB_CONCURRENCY", "1") or "1") > 1:
            LOGGER.warning(
                "WEB_CONCURRENCY>1: rating reminder scheduler chạy trên MỖI worker → có thể gửi "
                "email nhắc TRÙNG. Khuyến nghị WEB_CONCURRENCY=1 hoặc tách scheduler ra tiến trình riêng."
            )
    except ValueError:
        pass

    scheduler = BackgroundScheduler(timezone=_app_timezone())
    scheduler.add_job(
        process_due_rating_reminders,
        "interval",
        minutes=5,
        id="rating-reminder-job",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    _SCHEDULER = scheduler
    LOGGER.info("Rating reminder scheduler started (interval=5m).")


def stop_rating_scheduler() -> None:
    global _SCHEDULER
    if _SCHEDULER is None:
        return
    _SCHEDULER.shutdown(wait=False)
    _SCHEDULER = None
    LOGGER.info("Rating reminder scheduler stopped.")
