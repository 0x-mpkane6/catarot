from __future__ import annotations

import logging
import os
from zoneinfo import ZoneInfo

DEFAULT_APP_TIMEZONE = "Asia/Ho_Chi_Minh"
UTC_TIMEZONE = "UTC"


def get_app_timezone(*, logger: logging.Logger | None = None) -> ZoneInfo:
    tz_name = (os.getenv("APP_TIMEZONE", DEFAULT_APP_TIMEZONE) or "").strip() or DEFAULT_APP_TIMEZONE
    try:
        return ZoneInfo(tz_name)
    except Exception:
        if logger is not None:
            logger.warning(
                "Invalid APP_TIMEZONE '%s'; falling back to %s.",
                tz_name,
                DEFAULT_APP_TIMEZONE,
            )

    try:
        return ZoneInfo(DEFAULT_APP_TIMEZONE)
    except Exception:
        if logger is not None:
            logger.warning(
                "Fallback timezone '%s' is unavailable; using %s.",
                DEFAULT_APP_TIMEZONE,
                UTC_TIMEZONE,
            )
        return ZoneInfo(UTC_TIMEZONE)
