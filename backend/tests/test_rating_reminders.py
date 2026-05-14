from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import select

from src.advanced import rating_reminders as reminder_service
from src.db.init_db import initialize_database_if_needed, reset_database_bootstrap_for_tests
from src.db.models import RatingReminder, Reading, ReadingSession, User
from src.db.session import reset_database_caches_for_tests, session_scope


def _use_temp_sqlite_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    db_path = tmp_path / "reminder_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()
    initialize_database_if_needed(seed_reference_data=False)


def _create_session_with_reminder(*, user_email: str | None, remind_status: str = "pending") -> tuple[int, int | None]:
    with session_scope() as session:
        user_id: int | None = None
        if user_email is not None:
            user = User(email=user_email, password_hash="hash", role="member")
            session.add(user)
            session.flush()
            user_id = user.id

        reading_session = ReadingSession(
            user_id=user_id,
            question_text="Will this work out?",
            audio_transcript=None,
            status="completed",
        )
        session.add(reading_session)
        session.flush()

        session.add(
            Reading(
                session_id=reading_session.id,
                generated_text="Sample answer",
                llm_model="deterministic-fallback",
            )
        )
        session.add(
            RatingReminder(
                session_id=reading_session.id,
                user_id=user_id,
                remind_at=datetime.now(timezone.utc) - timedelta(days=1),
                status=remind_status,
                attempts=0,
            )
        )
        session.flush()
        return reading_session.id, user_id


def test_process_due_rating_reminders_marks_sent(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)
    session_id, _ = _create_session_with_reminder(user_email="member@example.com")

    monkeypatch.setattr(reminder_service, "_send_rating_email", lambda **_: None)
    stats = reminder_service.process_due_rating_reminders()
    assert stats["sent"] == 1

    with session_scope() as session:
        reminder = session.scalar(select(RatingReminder).where(RatingReminder.session_id == session_id))
        assert reminder is not None
        assert reminder.status == "sent"
        assert reminder.sent_at is not None
        assert reminder.attempts == 1


def test_process_due_rating_reminders_marks_failed_on_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)
    session_id, _ = _create_session_with_reminder(user_email="member@example.com")

    def _boom(**_kwargs):
        raise RuntimeError("smtp exploded")

    monkeypatch.setattr(reminder_service, "_send_rating_email", _boom)
    stats = reminder_service.process_due_rating_reminders()
    assert stats["failed"] == 1

    with session_scope() as session:
        reminder = session.scalar(select(RatingReminder).where(RatingReminder.session_id == session_id))
        assert reminder is not None
        assert reminder.status == "failed"
        assert reminder.attempts == 1
        assert "smtp exploded" in (reminder.last_error or "")


def test_process_due_rating_reminders_marks_skipped_when_email_missing(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)
    session_id, _ = _create_session_with_reminder(user_email=None)

    stats = reminder_service.process_due_rating_reminders()
    assert stats["skipped"] == 1

    with session_scope() as session:
        reminder = session.scalar(select(RatingReminder).where(RatingReminder.session_id == session_id))
        assert reminder is not None
        assert reminder.status == "skipped"


def test_save_rating_marks_reading_and_reminder_as_rated(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)
    session_id, user_id = _create_session_with_reminder(user_email="member@example.com", remind_status="sent")
    assert user_id is not None

    response = reminder_service.save_rating(session_id=session_id, score=4, note="Mostly accurate.")
    assert response["status"] == "rated"
    assert response["score"] == 4

    with session_scope() as session:
        reading = session.scalar(select(Reading).where(Reading.session_id == session_id))
        reminder = session.scalar(select(RatingReminder).where(RatingReminder.session_id == session_id))
        assert reading is not None
        assert reading.accuracy_score == 4
        assert reading.accuracy_note == "Mostly accurate."
        assert reading.rated_at is not None
        assert reminder is not None
        assert reminder.status == "rated"
        assert reminder.rated_at is not None
