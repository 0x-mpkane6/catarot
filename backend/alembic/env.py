"""Alembic environment file.

Tích hợp với SQLAlchemy models của project và đọc DATABASE_URL từ env (.env).
"""
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# Đảm bảo `import src.*` chạy được khi gọi `alembic` từ backend/.
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

# Load .env để có DATABASE_URL ngay lúc migrate.
try:
    from dotenv import load_dotenv

    load_dotenv(_PROJECT_ROOT / ".env")
except Exception:  # pragma: no cover - dotenv optional
    pass

# Import models để autogenerate detect schema.
from src.db.models import Base  # noqa: E402

config = context.config

# Cho phép DATABASE_URL từ env override — nhưng CHỈ khi caller (ví dụ test)
# chưa set sqlalchemy.url. Test alembic dùng cfg.set_main_option để chỉ DB
# tạm — nếu mình override lại sẽ phá test.
_ini_url = (config.get_main_option("sqlalchemy.url") or "").strip()
_INI_PLACEHOLDERS = {"", "driver://user:pass@localhost/dbname"}
if _ini_url in _INI_PLACEHOLDERS:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        # SQLite tương đối thường viết sqlite:///./data/app.db → resolve.
        if env_url.startswith("sqlite:///./"):
            rel = env_url[len("sqlite:///") :]
            resolved = (_PROJECT_ROOT / rel[2:]).resolve()
            resolved.parent.mkdir(parents=True, exist_ok=True)
            env_url = f"sqlite:///{resolved.as_posix()}"
        config.set_main_option("sqlalchemy.url", env_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # cần cho SQLite ALTER TABLE
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
