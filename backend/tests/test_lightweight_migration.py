from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import inspect

from src.db.init_db import initialize_database, reset_database_bootstrap_for_tests
from src.db.session import get_engine, reset_database_caches_for_tests


def _create_legacy_readings_schema(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL UNIQUE,
                generated_text TEXT NOT NULL,
                llm_model VARCHAR(128),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def test_lightweight_migration_adds_readings_rating_columns_idempotently(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "legacy.db"
    _create_legacy_readings_schema(db_path)

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()

    initialize_database(seed_reference_data=False)
    initialize_database(seed_reference_data=False)

    inspector = inspect(get_engine())
    columns = {row["name"] for row in inspector.get_columns("readings")}
    assert {"accuracy_score", "accuracy_note", "rated_at"}.issubset(columns)
