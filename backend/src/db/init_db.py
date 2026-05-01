from __future__ import annotations

import threading

from src.db.models import Base
from src.db.seed import seed_tarot_cards
from src.db.session import get_engine, session_scope
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

_init_lock = threading.Lock()
_initialized = False


def initialize_database(seed_reference_data: bool = True) -> None:
    Base.metadata.create_all(bind=get_engine())

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
