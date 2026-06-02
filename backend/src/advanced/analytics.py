"""Funnel analytics tối thiểu để đo loop retention có chạy không.

Nguyên tắc: track_event là BEST-EFFORT — nuốt mọi lỗi, KHÔNG bao giờ chặn/ném ra
luồng chính (đăng ký, đọc bài, xem daily card...). Query funnel giữ đơn giản, không
tối ưu nặng (công cụ admin, dữ liệu nhỏ).
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select

from src.db.models import AnalyticsEvent
from src.db.session import session_scope
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}

# Các event được coi là "kích hoạt" (activation) để tính retention.
_ACTIVATION_EVENTS = {"reading_created", "daily_card_viewed"}


def _enabled() -> bool:
    return os.getenv("ANALYTICS_ENABLED", "true").strip().lower() in _BOOL_TRUE


def _coerce_user_id(value: Any) -> int | None:
    try:
        uid = int(value)
    except (TypeError, ValueError):
        return None
    return uid if uid > 0 else None


def track_event(user_id: int | None, event: str, props: dict[str, Any] | None = None) -> None:
    """Ghi 1 sự kiện funnel. NUỐT MỌI LỖI — không bao giờ làm hỏng luồng gọi."""
    if not _enabled():
        return
    try:
        clean_event = (event or "").strip()[:64]
        if not clean_event:
            return
        props_json: str | None = None
        if props:
            try:
                props_json = json.dumps(props, ensure_ascii=False)[:4000]
            except (TypeError, ValueError):
                props_json = None
        with session_scope() as session:
            session.add(
                AnalyticsEvent(
                    user_id=_coerce_user_id(user_id),
                    event=clean_event,
                    props_json=props_json,
                )
            )
    except Exception as exc:  # pragma: no cover - best-effort, must never raise
        LOGGER.debug("track_event nuốt lỗi cho event=%s: %s", event, exc)


def _naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _simple_retention(rows: list[tuple[int, str, datetime]]) -> dict[str, Any]:
    """Retention D1/D7 đơn giản tính thuần Python từ các event đã lấy.

    Cohort = các user có ít nhất 1 event activation; activation time = lần đầu.
    D1/D7 = tỉ lệ user còn quay lại (có BẤT KỲ event nào) sau >=1 / >=7 ngày.
    """
    by_user: dict[int, dict[str, Any]] = {}
    for uid, event, created in rows:
        if uid is None:
            continue
        c = created.replace(tzinfo=None) if getattr(created, "tzinfo", None) else created
        bucket = by_user.setdefault(uid, {"events": [], "act": None})
        bucket["events"].append(c)
        if event in _ACTIVATION_EVENTS and (bucket["act"] is None or c < bucket["act"]):
            bucket["act"] = c

    cohort = [uid for uid, b in by_user.items() if b["act"] is not None]
    total = len(cohort)
    if total == 0:
        return {
            "d1": {"cohort": 0, "returned": 0, "rate": 0.0},
            "d7": {"cohort": 0, "returned": 0, "rate": 0.0},
        }

    d1 = d7 = 0
    for uid in cohort:
        act = by_user[uid]["act"]
        events = by_user[uid]["events"]
        if any(c >= act + timedelta(days=1) for c in events):
            d1 += 1
        if any(c >= act + timedelta(days=7) for c in events):
            d7 += 1

    return {
        "d1": {"cohort": total, "returned": d1, "rate": round(d1 / total, 3)},
        "d7": {"cohort": total, "returned": d7, "rate": round(d7 / total, 3)},
    }


def funnel_counts(*, date_from: datetime | None = None, date_to: datetime | None = None) -> dict[str, Any]:
    """Đếm số lượng theo từng event trong khoảng + retention D1/D7."""
    nf = _naive_utc(date_from)
    nt = _naive_utc(date_to)
    with session_scope() as session:
        count_q = select(AnalyticsEvent.event, func.count()).select_from(AnalyticsEvent)
        if nf is not None:
            count_q = count_q.where(AnalyticsEvent.created_at >= nf)
        if nt is not None:
            count_q = count_q.where(AnalyticsEvent.created_at <= nt)
        count_rows = session.execute(count_q.group_by(AnalyticsEvent.event)).all()
        counts = {event: int(n) for event, n in count_rows}

        ret_q = select(
            AnalyticsEvent.user_id, AnalyticsEvent.event, AnalyticsEvent.created_at
        ).where(AnalyticsEvent.user_id.is_not(None))
        if nf is not None:
            ret_q = ret_q.where(AnalyticsEvent.created_at >= nf)
        if nt is not None:
            ret_q = ret_q.where(AnalyticsEvent.created_at <= nt)
        ret_rows = session.execute(ret_q).all()
        retention = _simple_retention([(r[0], r[1], r[2]) for r in ret_rows])

    return {
        "from": nf.isoformat() if nf else None,
        "to": nt.isoformat() if nt else None,
        "counts": counts,
        "total_events": sum(counts.values()),
        "retention": retention,
    }
