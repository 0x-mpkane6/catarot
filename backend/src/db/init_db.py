from __future__ import annotations

import threading

from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

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
        ddl_fragment="TIMESTAMP",  # tương thích cả SQLite lẫn Postgres (DATETIME chỉ đúng trên SQLite)
    )
    _add_column_if_missing(
        table_name="dream_entries",
        column_name="interpretation_json",
        ddl_fragment="TEXT",
    )


def _recreate_daily_deep_readings_if_stale() -> None:
    """Drop bảng cache daily_deep_readings nếu còn schema cũ (CHECK topic enum) để
    chuyển sang chủ đề tự do. Bảng này là cache nên drop an toàn — create_all tạo lại."""
    engine = get_engine()
    if "daily_deep_readings" not in inspect(engine).get_table_names():
        return
    try:
        with engine.begin() as conn:
            if engine.dialect.name == "sqlite":
                row = conn.exec_driver_sql(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_deep_readings'"
                ).fetchone()
                stale = bool(row and row[0] and "topic IN" in row[0])
            else:
                row = conn.exec_driver_sql(
                    "SELECT 1 FROM information_schema.check_constraints "
                    "WHERE constraint_name = 'ck_daily_deep_readings_topic'"
                ).fetchone()
                stale = bool(row)
            if stale:
                conn.exec_driver_sql("DROP TABLE daily_deep_readings")
                LOGGER.info(
                    "Dropped stale daily_deep_readings (topic CHECK cũ); sẽ tạo lại cho chủ đề tự do."
                )
    except Exception as exc:  # pragma: no cover - phòng thủ, không chặn startup
        LOGGER.warning("Không tái tạo được daily_deep_readings: %s", exc)


def _apply_unique_constraints() -> None:
    """Thêm các UNIQUE constraint còn thiếu trên DB Postgres ĐÃ TỒN TẠI.

    Bảng được tạo TRƯỚC khi constraint được thêm vào model thì create_all() KHÔNG ALTER để
    bổ sung constraint → trên prod cũ constraint không tồn tại, làm việc chống đua/đúp request
    (dựa vào IntegrityError) bị vô hiệu. Idempotent: kiểm tra pg_constraint trước. Bọc
    try/except từng cái (vd đã có dữ liệu trùng) để KHÔNG chặn startup. SQLite bỏ qua vì
    create_all đã tạo constraint cho DB mới.
    """
    engine = get_engine()
    if engine.dialect.name != "postgresql":
        return

    targets = [
        ("duo_cards", "uq_duo_card_session_participant", "duo_session_id, participant_id"),
        ("community_votes", "uq_community_votes_interp_user", "interpretation_id, user_id"),
        ("daily_cards", "uq_daily_cards_user_date", "user_id, draw_date"),
        ("conversation_turns", "uq_conversation_turns_session_idx", "session_id, turn_index"),
    ]
    existing_tables = set(inspect(engine).get_table_names())

    for table_name, constraint_name, columns in targets:
        if table_name not in existing_tables:
            continue
        try:
            with engine.begin() as conn:
                already = conn.execute(
                    text("SELECT 1 FROM pg_constraint WHERE conname = :name"),
                    {"name": constraint_name},
                ).fetchone()
                if already:
                    continue
                # Tên bảng/cột/constraint đều là hằng cố định trong code (không phải input) → an toàn.
                conn.exec_driver_sql(
                    f"ALTER TABLE {table_name} "
                    f"ADD CONSTRAINT {constraint_name} UNIQUE ({columns})"
                )
            LOGGER.info(
                "Applied unique constraint: %s on %s", constraint_name, table_name
            )
        except Exception as exc:  # pragma: no cover - phòng thủ, không chặn startup
            LOGGER.warning(
                "Không thêm được unique constraint %s trên %s (có thể do dữ liệu trùng sẵn): %s",
                constraint_name,
                table_name,
                exc,
            )


def _apply_indexes() -> None:
    """Thêm các index còn thiếu trên DB ĐÃ TỒN TẠI (mọi dialect).

    Bảng được tạo TRƯỚC khi index được thêm vào model thì create_all() KHÔNG ALTER để bổ
    sung index → trên prod cũ các cột scheduler/feed query thường xuyên (status, remind_at,
    scheduled_for) thiếu index, gây full scan. Idempotent nhờ "CREATE INDEX IF NOT EXISTS"
    (Postgres lẫn SQLite đều hỗ trợ). Bọc try/except từng cái + LOGGER.warning khi lỗi để
    KHÔNG chặn startup. Tên bảng/cột/index đều là hằng cố định trong code → an toàn.
    """
    engine = get_engine()
    targets = [
        ("community_posts", "ix_community_posts_status", "status"),
        ("rating_reminders", "ix_rating_reminders_status_remind_at", "status, remind_at"),
        ("notifications", "ix_notifications_status_scheduled_for", "status, scheduled_for"),
        ("time_capsules", "ix_time_capsules_status", "status"),
    ]
    existing_tables = set(inspect(engine).get_table_names())

    for table_name, index_name, columns in targets:
        if table_name not in existing_tables:
            continue
        try:
            with engine.begin() as conn:
                conn.exec_driver_sql(
                    f"CREATE INDEX IF NOT EXISTS {index_name} "
                    f"ON {table_name} ({columns})"
                )
            LOGGER.info("Applied index: %s on %s", index_name, table_name)
        except Exception as exc:  # pragma: no cover - phòng thủ, không chặn startup
            LOGGER.warning(
                "Không thêm được index %s trên %s: %s",
                index_name,
                table_name,
                exc,
            )


def initialize_database(seed_reference_data: bool = True) -> None:
    _recreate_daily_deep_readings_if_stale()
    Base.metadata.create_all(bind=get_engine())
    _apply_lightweight_migrations()
    _apply_unique_constraints()
    _apply_indexes()

    if not seed_reference_data:
        return

    try:
        with session_scope() as session:
            inserted = seed_tarot_cards(session)
        if inserted:
            LOGGER.info("Seeded %d tarot_cards row(s).", inserted)
    except IntegrityError:
        # Khi chay nhieu worker/process cung khoi dong tren DB rong, hai ben co the
        # cung doc "chua co the bai" roi cung INSERT 78 ten unique -> mot ben dinh
        # UNIQUE constraint. Day la idempotent: coi nhu da seed xong, khong crash startup.
        LOGGER.info("tarot_cards seed skipped (already seeded by a concurrent worker).")


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
