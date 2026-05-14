import os
import importlib
import pytest
from pathlib import Path

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests


def test_debug(monkeypatch, tmp_path):
    db_path = tmp_path / "debug.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")

    print("\nDATABASE_URL=", os.environ.get("DATABASE_URL"))
    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()

    import src.main as main_module
    main_module = importlib.reload(main_module)

    from src.db import initialize_database_if_needed
    initialize_database_if_needed(seed_reference_data=True)

    from src.db.session import get_engine
    eng = get_engine()
    print("Engine URL:", eng.url)
    print("DB exists:", db_path.exists(), "size=", db_path.stat().st_size if db_path.exists() else 0)

    from sqlalchemy import inspect
    print("Tables:", sorted(inspect(eng).get_table_names())[:5])
