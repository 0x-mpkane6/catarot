from __future__ import annotations

import sqlite3
from pathlib import Path

import alembic.command as alembic_command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def _alembic_config(db_path: Path) -> Config:
    cfg = Config(str(Path("alembic.ini").resolve()))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{db_path.as_posix()}")
    cfg.set_main_option("script_location", str(Path("alembic").resolve()))
    return cfg


def test_alembic_upgrade_head_creates_tables_and_is_rerunnable(tmp_path: Path) -> None:
    db_path = tmp_path / "alembic_fresh.db"
    cfg = _alembic_config(db_path)

    alembic_command.upgrade(cfg, "head")
    alembic_command.upgrade(cfg, "head")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    expected = {
        "users",
        "reading_sessions",
        "readings",
        "conversation_turns",
        "rating_reminders",
        "user_archetype_profiles",
        "oracle_reports",
        "duo_sessions",
        "community_posts",
        "dream_entries",
    }
    assert expected.issubset(tables)


def test_alembic_upgrade_preserves_legacy_data(tmp_path: Path) -> None:
    db_path = tmp_path / "alembic_legacy.db"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'member',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            ("legacy@example.com", "hash", "member"),
        )
        conn.commit()
    finally:
        conn.close()

    cfg = _alembic_config(db_path)
    alembic_command.upgrade(cfg, "head")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    with engine.connect() as connection:
        count = connection.execute(text("SELECT COUNT(*) FROM users WHERE email='legacy@example.com'")).scalar_one()
    assert count == 1
