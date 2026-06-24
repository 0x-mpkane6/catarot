"""Hạ tầng thông báo dùng chung (in-app + email), tái dùng được cho Oracle/Archetype sau.

Thiết kế theo đúng pattern scheduler hiện có (rating_reminders / analytics_scheduler):
BackgroundScheduler + guard import + flag *_SCHEDULER_ENABLED qua os.getenv. dispatch
là BEST-EFFORT: luôn ghi 1 row in-app; lỗi gửi email -> status='failed', KHÔNG ném ra.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except Exception:  # pragma: no cover - optional dependency guard
    BackgroundScheduler = None  # type: ignore[assignment]

from sqlalchemy import select

from src.advanced.analytics import track_event
from src.advanced.daily_card import draw_today_card
from src.db.models import Notification, NotificationPreference, User
from src.db.session import session_scope
from src.utils.email import email_configured, send_email
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

LOGGER = get_logger(__name__)

_BOOL_TRUE = {"1", "true", "yes", "y", "on"}
_SCHEDULER: BackgroundScheduler | None = None

_VALID_TYPES = {"daily_card", "oracle", "archetype", "rating", "custom"}


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _BOOL_TRUE


def _scheduler_enabled() -> bool:
    return _as_bool(os.getenv("NOTIFICATION_SCHEDULER_ENABLED", "true"), default=True)


def _app_timezone():
    return get_app_timezone(logger=LOGGER)


def _resolve_tz(tz_name: str | None):
    if tz_name:
        try:
            return ZoneInfo(tz_name.strip())
        except Exception:
            LOGGER.debug("Timezone không hợp lệ '%s'; dùng APP_TIMEZONE.", tz_name)
    return _app_timezone()


# =============================
# Preferences
# =============================


def _serialize_pref(row: NotificationPreference) -> dict[str, Any]:
    return {
        "user_id": row.user_id,
        "daily_card_enabled": bool(row.daily_card_enabled),
        "daily_card_hour": int(row.daily_card_hour),
        "email_enabled": bool(row.email_enabled),
        "timezone": row.timezone,
    }


def get_or_create_preference(*, user_id: int) -> dict[str, Any]:
    with session_scope() as session:
        row = session.scalar(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        if row is None:
            row = NotificationPreference(user_id=user_id)
            session.add(row)
            session.flush()
        return _serialize_pref(row)


def update_preference(
    *,
    user_id: int,
    daily_card_enabled: bool | None = None,
    daily_card_hour: int | None = None,
    email_enabled: bool | None = None,
    timezone_name: str | None = None,
    timezone_provided: bool = False,
) -> dict[str, Any]:
    with session_scope() as session:
        row = session.scalar(
            select(NotificationPreference).where(NotificationPreference.user_id == user_id)
        )
        if row is None:
            row = NotificationPreference(user_id=user_id)
            session.add(row)
            session.flush()

        if daily_card_enabled is not None:
            row.daily_card_enabled = bool(daily_card_enabled)
        if email_enabled is not None:
            row.email_enabled = bool(email_enabled)
        if daily_card_hour is not None:
            hour = int(daily_card_hour)
            if hour < 0 or hour > 23:
                raise ValueError("daily_card_hour must be between 0 and 23")
            row.daily_card_hour = hour
        if timezone_provided:
            clean_tz = (timezone_name or "").strip() or None
            if clean_tz is not None:
                # Validate sớm để không lưu tz rác (scheduler vẫn fallback nếu lỗi).
                try:
                    ZoneInfo(clean_tz)
                except Exception as exc:
                    raise ValueError(f"invalid timezone: {clean_tz}") from exc
            row.timezone = clean_tz

        session.flush()
        return _serialize_pref(row)


# =============================
# Notifications feed
# =============================


def _serialize_notification(row: Notification) -> dict[str, Any]:
    payload: Any = None
    if row.payload_json:
        try:
            payload = json.loads(row.payload_json)
        except json.JSONDecodeError:
            payload = None
    return {
        "id": row.id,
        "type": row.type,
        "title": row.title,
        "body": row.body,
        "status": row.status,
        "scheduled_for": row.scheduled_for.isoformat() if row.scheduled_for else None,
        "sent_at": row.sent_at.isoformat() if row.sent_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "payload": payload,
    }


def list_notifications(*, user_id: int, limit: int = 30) -> list[dict[str, Any]]:
    if limit <= 0:
        return []
    with session_scope() as session:
        rows = session.scalars(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
        ).all()
        return [_serialize_notification(r) for r in rows]


def mark_notification_read(*, user_id: int, notification_id: int) -> dict[str, Any]:
    with session_scope() as session:
        row = session.scalar(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        if row is None:
            raise ValueError("notification not found")
        row.status = "read"
        session.flush()
        return _serialize_notification(row)


# =============================
# Dispatch (in-app luôn ghi; email best-effort)
# =============================


def dispatch_notification(
    *,
    user_id: int,
    type: str,
    title: str,
    body: str = "",
    payload: dict[str, Any] | None = None,
    allow_email: bool = True,
) -> dict[str, Any]:
    """LUÔN ghi 1 notification in-app; nếu bật email + có SMTP thì gửi (best-effort).

    Không bao giờ ném exception ra ngoài — lỗi gửi chỉ set status='failed'.
    """
    clean_type = type if type in _VALID_TYPES else "custom"
    clean_title = (title or "").strip()[:200] or "Thông báo"
    clean_body = body or ""
    payload_json: str | None = None
    if payload:
        try:
            payload_json = json.dumps(payload, ensure_ascii=False)
        except (TypeError, ValueError):
            payload_json = None

    now = datetime.now(timezone.utc)
    status = "sent"  # in-app row LÀ bản giao mặc định -> coi như đã gửi.
    result: dict[str, Any] = {}

    try:
        with session_scope() as session:
            notif = Notification(
                user_id=user_id,
                type=clean_type,
                title=clean_title,
                body=clean_body,
                status="pending",
                scheduled_for=now,
                payload_json=payload_json,
            )
            session.add(notif)
            session.flush()

            pref = session.scalar(
                select(NotificationPreference).where(NotificationPreference.user_id == user_id)
            )
            email_enabled = True if pref is None else bool(pref.email_enabled)
            user = session.scalar(select(User).where(User.id == user_id))
            to_email = (user.email if user else None) or ""

            if allow_email and email_enabled and to_email and email_configured():
                try:
                    send_email(to_email=to_email, subject=clean_title, body=clean_body or clean_title)
                    status = "sent"
                except Exception as exc:  # best-effort: lỗi email -> failed, KHÔNG ném
                    status = "failed"
                    LOGGER.warning("Gửi email thông báo thất bại (user=%s): %s", user_id, exc)

            notif.status = status
            notif.sent_at = now
            result = _serialize_notification(notif)
    except Exception as exc:  # pragma: no cover - phòng thủ, không để vỡ luồng gọi
        LOGGER.error("dispatch_notification thất bại (user=%s, type=%s): %s", user_id, clean_type, exc)
        return {"id": None, "type": clean_type, "title": clean_title, "status": "failed"}

    track_event(user_id, "notification_sent", {"type": clean_type, "status": status})
    return result


# =============================
# Scheduler job: daily card hằng ngày
# =============================


def _daily_card_body(card: dict[str, Any]) -> str:
    name = str(card.get("card_name") or "Lá bài của bạn")
    orient = "ngược" if str(card.get("orientation")) == "reversed" else "xuôi"
    affirmation = str(card.get("affirmation") or "").strip()
    base = f"{name} ({orient})."
    return f"{base} {affirmation}".strip()


def process_daily_card_notifications(max_users: int = 500) -> dict[str, int]:
    """Mỗi 5 phút: với user bật daily_card_enabled, nếu giờ địa phương khớp
    daily_card_hour và hôm nay (giờ địa phương) CHƯA có notif daily_card -> tạo
    daily card (idempotent) + dispatch. Idempotent: tối đa 1 daily_card notif/ngày/user.
    """
    stats = {"created": 0, "skipped": 0, "failed": 0}
    now_utc = datetime.now(timezone.utc)

    with session_scope() as session:
        candidates = session.execute(
            select(
                NotificationPreference.user_id,
                NotificationPreference.daily_card_hour,
                NotificationPreference.timezone,
            )
            .where(NotificationPreference.daily_card_enabled.is_(True))
            .limit(max_users)
        ).all()

    for user_id, hour, tz_name in candidates:
        try:
            tz = _resolve_tz(tz_name)
            local_now = now_utc.astimezone(tz)
            if local_now.hour != int(hour):
                stats["skipped"] += 1
                continue

            day_start_local = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
            # Mốc đầu ngày địa phương quy về UTC-naive để so với created_at (SQLite lưu naive UTC).
            day_start_utc_naive = day_start_local.astimezone(timezone.utc).replace(tzinfo=None)

            with session_scope() as session:
                already = session.scalar(
                    select(Notification.id).where(
                        Notification.user_id == user_id,
                        Notification.type == "daily_card",
                        Notification.created_at >= day_start_utc_naive,
                    )
                )
            if already:
                stats["skipped"] += 1
                continue

            card = draw_today_card(user_id=user_id)  # idempotent: trả lá đã rút nếu có
            dispatch_notification(
                user_id=user_id,
                type="daily_card",
                title="Lá bài hôm nay của bạn đã sẵn sàng",
                body=_daily_card_body(card),
                payload={"daily_card_id": card.get("id"), "date": card.get("draw_date")},
            )
            stats["created"] += 1
        except Exception as exc:
            stats["failed"] += 1
            LOGGER.warning("Tạo daily-card notif thất bại (user=%s): %s", user_id, exc)

    if any(stats.values()):
        LOGGER.info("Daily-card notification job: %s", stats)
    return stats


def start_notification_scheduler() -> None:
    global _SCHEDULER
    if BackgroundScheduler is None:
        LOGGER.warning("APScheduler không có; notification scheduler bị tắt.")
        return
    if not _scheduler_enabled():
        LOGGER.info("Notification scheduler bị tắt qua env (NOTIFICATION_SCHEDULER_ENABLED).")
        return
    if _SCHEDULER is not None:
        return

    try:
        if int(os.getenv("WEB_CONCURRENCY", "1") or "1") > 1:
            LOGGER.warning(
                "WEB_CONCURRENCY>1: notification scheduler chạy trên MỖI worker → có thể tạo "
                "thông báo TRÙNG. Khuyến nghị WEB_CONCURRENCY=1 hoặc tách scheduler ra tiến trình riêng."
            )
    except ValueError:
        pass

    scheduler = BackgroundScheduler(timezone=_app_timezone())
    scheduler.add_job(
        process_daily_card_notifications,
        "interval",
        minutes=5,
        id="daily-card-notification-job",
        replace_existing=True,
        coalesce=True,
        max_instances=1,
    )
    scheduler.start()
    _SCHEDULER = scheduler
    LOGGER.info("Notification scheduler started (interval=5m).")


def stop_notification_scheduler() -> None:
    global _SCHEDULER
    if _SCHEDULER is None:
        return
    _SCHEDULER.shutdown(wait=False)
    _SCHEDULER = None
    LOGGER.info("Notification scheduler stopped.")
