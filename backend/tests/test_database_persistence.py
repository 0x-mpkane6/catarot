from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import func, select

from src.db.init_db import initialize_database_if_needed, reset_database_bootstrap_for_tests
from src.db.models import Reading, ReadingSession, RecognizedCard, TarotCard
from src.db.persistence import persist_reading_result
from src.db.seed import load_tarot_seed_rows
from src.db.session import reset_database_caches_for_tests, session_scope


def _use_temp_sqlite_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    db_path = tmp_path / "app_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()
    return db_path


def test_initialize_database_seeds_tarot_cards(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)
    expected_rows = load_tarot_seed_rows()
    if not expected_rows:
        pytest.skip("tarot seed source not available")

    initialize_database_if_needed(seed_reference_data=True)
    with session_scope() as session:
        count_first = session.scalar(select(func.count(TarotCard.id)))

    assert count_first == len(expected_rows)

    initialize_database_if_needed(seed_reference_data=True)
    with session_scope() as session:
        count_second = session.scalar(select(func.count(TarotCard.id)))

    assert count_second == count_first


def test_persist_reading_result_writes_session_cards_and_reading(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    _use_temp_sqlite_db(monkeypatch, tmp_path)

    payload = {
        "transcript": "I am worried about next month.",
        "cards": [
            {
                "name": "The Fool",
                "orientation": "upright",
                "position": "past",
                "confidence": 0.91,
            },
            {
                "name": "The Magician",
                "orientation": "reversed",
                "position": "present",
                "confidence": 0.73,
            },
        ],
        "final_answer": "Keep momentum but check details before acting.",
        "llm_model": "ollama:qwen2.5:3b-instruct",
    }

    session_id = persist_reading_result(
        question="What should I focus on?",
        result=payload,
        user_id=None,
    )

    assert session_id is not None

    with session_scope() as session:
        row_session = session.get(ReadingSession, session_id)
        assert row_session is not None
        assert row_session.question_text == "What should I focus on?"
        assert row_session.audio_transcript == payload["transcript"]
        assert row_session.status == "completed"

        rows_cards = session.scalars(
            select(RecognizedCard)
            .where(RecognizedCard.session_id == session_id)
            .order_by(RecognizedCard.order_index.asc())
        ).all()
        assert len(rows_cards) == 2
        assert rows_cards[0].orientation == "upright"
        assert rows_cards[0].order_index == 0
        assert rows_cards[1].orientation == "reversed"
        assert rows_cards[1].order_index == 1

        row_reading = session.scalar(select(Reading).where(Reading.session_id == session_id))
        assert row_reading is not None
        assert row_reading.generated_text == payload["final_answer"]
        assert row_reading.llm_model == payload["llm_model"]
