from __future__ import annotations

import threading

from sqlalchemy import inspect

from src.db.models import Base
from src.db.seed import seed_tarot_cards
from src.db.session import get_engine, session_scope
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

_init_lock = threading.Lock()
_initialized = False


def _column_names(table_name: str) -> set[str]:
    inspector = inspect(get_engine())
    if table_name not in inspector.get_table_names():
        return set()
    return {row["name"] for row in inspector.get_columns(table_name)}


def _add_column_if_missing(*, table_name: str, column_name: str, ddl_fragment: str) -> bool:
    existing = _column_names(table_name)
    if column_name in existing:
        return False

    sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl_fragment}"
    with get_engine().begin() as conn:
        conn.exec_driver_sql(sql)
    LOGGER.info("Applied lightweight migration: %s.%s", table_name, column_name)
    return True


def _apply_lightweight_migrations() -> None:
    _add_column_if_missing(
        table_name="reading_sessions",
        column_name="emotion_state",
        ddl_fragment="VARCHAR(32)",
    )
    _add_column_if_missing(
        table_name="reading_sessions",
        column_name="emotion_signal_json",
        ddl_fragment="TEXT",
    )
    _add_column_if_missing(
        table_name="readings",
        column_name="accuracy_score",
        ddl_fragment="INTEGER",
    )
    _add_column_if_missing(
        table_name="readings",
        column_name="accuracy_note",
        ddl_fragment="TEXT",
    )
    _add_column_if_missing(
        table_name="readings",
        column_name="rated_at",
        ddl_fragment="DATETIME",
    )


def initialize_database(seed_reference_data: bool = True) -> None:
    Base.metadata.create_all(bind=get_engine())
    _apply_lightweight_migrations()

    if not seed_reference_data:
        return

    with session_scope() as session:
        inserted = seed_tarot_cards(session)
    if inserted:
        LOGGER.info("Seeded %d tarot_cards row(s).", inserted)


def initialize_database_if_needed(seed_reference_data: bool = True) -> None:
    global _initialized
    if _initialized:
        return

    with _init_lock:
        if _initialized:
            return
        initialize_database(seed_reference_data=seed_reference_data)
        _initialized = True


def reset_database_bootstrap_for_tests() -> None:
    global _initialized
    with _init_lock:
        _initialized = False
