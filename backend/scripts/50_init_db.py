#!/usr/bin/env python
from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.db.init_db import initialize_database
from src.db.session import get_engine


def main() -> int:
    initialize_database(seed_reference_data=True)
    print(f"[OK] Database ready: {get_engine().url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
