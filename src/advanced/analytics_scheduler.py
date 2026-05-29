from __future__ import annotations

import os

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception:  # pragma: no cover
    BackgroundScheduler = None  # type: ignore[assignment]

from src.advanced.archetype_profiler import run_archetype_weekly_job
from src.advanced.oracle_reports import run_oracle_monthly_job
from src.advanced.time_capsule import mark_due_capsules_notified
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

LOGGER = get_logger(__name__)

_SCHEDULER: BackgroundScheduler | None = None
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _BOOL_TRUE


def _app_timezone():
    return get_app_timezone(logger=LOGGER)


def start_analytics_scheduler() -> None:
    global _SCHEDULER
    if BackgroundScheduler is None:
        LOGGER.warning("APScheduler unavailable; analytics scheduler disabled.")
        return
    if _SCHEDULER is not None:
        return

    scheduler = BackgroundScheduler(timezone=_app_timezone())
    if _as_bool(os.getenv("ARCHETYPE_SCHEDULER_ENABLED", "true"), default=True):
        scheduler.add_job(
            run_archetype_weekly_job,
            "cron",
            day_of_week="mon",
            hour=2,
            minute=0,
            id="archetype-weekly-job",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
    if _as_bool(os.getenv("ORACLE_SCHEDULER_ENABLED", "true"), default=True):
        scheduler.add_job(
            run_oracle_monthly_job,
            "cron",
            day=1,
            hour=3,
            minute=0,
            id="oracle-monthly-job",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
    if _as_bool(os.getenv("TIME_CAPSULE_SCHEDULER_ENABLED", "true"), default=True):
        scheduler.add_job(
            mark_due_capsules_notified,
            "interval",
            minutes=15,
            id="time-capsule-reveal-job",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )

    if not scheduler.get_jobs():
        LOGGER.info("Analytics scheduler has no enabled jobs.")
        return

    scheduler.start()
    _SCHEDULER = scheduler
    LOGGER.info("Analytics scheduler started.")


def stop_analytics_scheduler() -> None:
    global _SCHEDULER
    if _SCHEDULER is None:
        return
    _SCHEDULER.shutdown(wait=False)
    _SCHEDULER = None
    LOGGER.info("Analytics scheduler stopped.")
