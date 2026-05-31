from __future__ import annotations

import os
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _default_database_url() -> str:
    return "sqlite:///./data/app.db"


def _resolve_sqlite_url(database_url: str) -> str:
    if not database_url.startswith("sqlite:///"):
        return database_url

    raw_path = database_url[len("sqlite:///") :]
    if raw_path in {"", ":memory:"}:
        return database_url

    db_path = Path(raw_path)
    if raw_path.startswith("./"):
        db_path = (PROJECT_ROOT / raw_path[2:]).resolve()
    elif not db_path.is_absolute():
        db_path = (PROJECT_ROOT / raw_path).resolve()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path.as_posix()}"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = os.getenv("DATABASE_URL", _default_database_url()).strip() or _default_database_url()
    database_url = _resolve_sqlite_url(database_url)

    connect_args: dict[str, object] = {}
    engine_kwargs: dict[str, object] = {
        "future": True,
        "echo": _as_bool(os.getenv("DB_ECHO"), default=False),
    }
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        # Postgres (Neon...): kiểm tra kết nối trước khi dùng + tái tạo định kỳ
        # để tránh lỗi "SSL connection has been closed" khi Neon đóng kết nối nhàn rỗi.
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_recycle"] = 300

    engine = create_engine(database_url, connect_args=connect_args, **engine_kwargs)

    if database_url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        future=True,
        class_=Session,
    )


def get_db() -> Iterator[Session]:
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def reset_database_caches_for_tests() -> None:
    get_session_factory.cache_clear()
    get_engine.cache_clear()
