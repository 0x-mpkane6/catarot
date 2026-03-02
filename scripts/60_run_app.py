#!/usr/bin/env python
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.app.gradio_app import build_app


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Tarot MVP Gradio app")
    parser.add_argument("--share", action="store_true", help="Enable Gradio share link")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=7860, type=int)
    args = parser.parse_args()

    env_share = _as_bool(os.getenv("GRADIO_SHARE", "false"))
    share = args.share or env_share

    app = build_app()
    app.launch(server_name=args.host, server_port=args.port, share=share)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
