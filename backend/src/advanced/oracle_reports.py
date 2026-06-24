from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select

from src.db.models import OracleReport, ReadingSession, RecognizedCard, TarotCard, User
from src.db.session import session_scope
from src.llm.generate import ReadingGenerator
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

LOGGER = get_logger(__name__)


def _app_timezone():
    return get_app_timezone(logger=LOGGER)


def _previous_month_bounds() -> tuple[datetime, datetime]:
    tz = _app_timezone()
    now_local = datetime.now(tz)
    month_start_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_end_local = month_start_local - timedelta(microseconds=1)
    prev_start_local = prev_end_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return prev_start_local.astimezone(timezone.utc), prev_end_local.astimezone(timezone.utc)


def _topic_from_question(question_text: str) -> str:
    text = (question_text or "").lower()
    if any(token in text for token in ["love", "romance", "relationship", "tinh", "cam"]):
        return "love"
    if any(token in text for token in ["career", "job", "work", "su nghiep", "cong viec"]):
        return "career"
    if any(token in text for token in ["money", "finance", "tai chinh", "tien"]):
        return "finance"
    if any(token in text for token in ["stress", "anxious", "lo lang", "noi tam"]):
        return "inner_work"
    return "general"


def _aggregate_user_summary(user_id: int, period_start: datetime, period_end: datetime) -> dict:
    with session_scope() as session:
        sessions = session.scalars(
            select(ReadingSession).where(
                ReadingSession.user_id == user_id,
                ReadingSession.created_at >= period_start,
                ReadingSession.created_at <= period_end,
            )
        ).all()

        if not sessions:
            return {}
        session_ids = [row.id for row in sessions]

        card_rows = session.execute(
            select(TarotCard.name)
            .join(RecognizedCard, RecognizedCard.card_id == TarotCard.id)
            .where(RecognizedCard.session_id.in_(session_ids))
        ).all()

    card_counter = Counter([row[0] for row in card_rows])
    topic_counter = Counter([_topic_from_question(row.question_text) for row in sessions if row.question_text])
    emotion_counter = Counter([row.emotion_state for row in sessions if row.emotion_state])

    return {
        "session_count": len(sessions),
        "top_cards": card_counter.most_common(5),
        "top_topics": topic_counter.most_common(5),
        "top_emotions": emotion_counter.most_common(5),
    }


_TOPIC_LABEL_VI: dict[str, str] = {
    "love": "tình cảm",
    "career": "sự nghiệp",
    "finance": "tài chính",
    "inner_work": "nội tâm",
    "general": "chung",
}


def _generate_narrative(summary: dict) -> tuple[str, str]:
    if not summary:
        return ("Chưa có dữ liệu trong tháng cho người dùng này.", "deterministic-fallback")

    reader = ReadingGenerator()
    system_prompt = (
        "Bạn là chuyên gia phân tích tarot. LUÔN viết bằng tiếng Việt có dấu, văn phong ấm áp "
        "và thực tế. Hãy viết một lá thư oracle hằng tháng ngắn gọn (120-180 từ), chỉ dựa trên "
        "dữ liệu JSON tóm tắt được cung cấp. Giữ nguyên tên lá bài tiếng Anh."
    )
    user_prompt = f"TOM_TAT_THANG_JSON:\n{json.dumps(summary, ensure_ascii=False)}"

    if reader.gemini_api_key:
        try:
            text = reader._generate_gemini(system_prompt, user_prompt)  # type: ignore[attr-defined]
            if text.strip():
                return text.strip(), f"gemini:{reader.gemini_model}"
        except Exception:
            pass
    if reader.api_key:
        try:
            text = reader._generate_openai(system_prompt, user_prompt)  # type: ignore[attr-defined]
            if text.strip():
                return text.strip(), f"openai:{reader.model}"
        except Exception:
            pass
    if reader.ollama_enabled:
        try:
            text = reader._generate_ollama(system_prompt, user_prompt)  # type: ignore[attr-defined]
            if text.strip():
                return text.strip(), f"ollama:{reader.ollama_model}"
        except Exception:
            pass

    top_cards = ", ".join([name for name, _ in summary.get("top_cards", [])[:2]]) or "chưa có lá nổi bật"
    top_topics = (
        ", ".join([_TOPIC_LABEL_VI.get(name, name) for name, _ in summary.get("top_topics", [])[:2]])
        or "các mối quan tâm chung"
    )
    text = (
        f"Trong tháng qua, năng lượng nổi bật tập trung quanh {top_cards}. "
        f"Chủ đề lặp lại nhiều nhất là {top_topics}. "
        "Hãy ưu tiên một hành động nhỏ nhưng đều đặn mỗi tuần, và theo dõi sự chuyển biến cảm xúc của bạn."
    )
    return text, "deterministic-fallback"


def _send_oracle_email(*, to_email: str, narrative: str, period_start: datetime, period_end: datetime) -> None:
    # Import cục bộ để tránh đụng tên với tham số `send_email: bool` của
    # create_oracle_report_for_user. Degrade im lặng nếu chưa cấu hình kênh gửi nào.
    from src.utils.email import email_configured, send_email

    if not email_configured():
        return

    send_email(
        to_email=to_email,
        subject=f"Báo cáo Oracle Tarot ({period_start.date()} - {period_end.date()})",
        body=narrative,
    )


def create_oracle_report_for_user(
    user_id: int,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
    send_email: bool = True,
    allow_fallback_window: bool = True,
) -> dict | None:
    start, end = period_start, period_end
    if start is None or end is None:
        start, end = _previous_month_bounds()

    assert start is not None and end is not None
    summary = _aggregate_user_summary(user_id=user_id, period_start=start, period_end=end)
    if not summary and allow_fallback_window and period_start is None and period_end is None:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=30)
        summary = _aggregate_user_summary(user_id=user_id, period_start=start, period_end=end)

    if not summary:
        return None

    narrative, model = _generate_narrative(summary)
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        existing = session.scalar(
            select(OracleReport).where(
                and_(
                    OracleReport.user_id == user_id,
                    OracleReport.period_start == start,
                    OracleReport.period_end == end,
                )
            )
        )
        if existing is None:
            row = OracleReport(
                user_id=user_id,
                period_start=start,
                period_end=end,
                summary_json=json.dumps(summary, ensure_ascii=False),
                narrative_text=narrative,
            )
            session.add(row)
            session.flush()
        else:
            row = existing
            row.summary_json = json.dumps(summary, ensure_ascii=False)
            row.narrative_text = narrative
            session.flush()

        user = session.scalar(select(User).where(User.id == user_id))
        if (
            send_email
            and os.getenv("ORACLE_EMAIL_ENABLED", "true").strip().lower() in {"1", "true", "yes", "y", "on"}
            and user is not None
            and user.email
        ):
            try:
                _send_oracle_email(to_email=user.email, narrative=narrative, period_start=start, period_end=end)
                row.delivered_email_at = now
            except Exception:
                pass

        created_id = row.id
        delivered_email_at = row.delivered_email_at

    return {
        "id": created_id,
        "user_id": user_id,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "summary": summary,
        "narrative_text": narrative,
        "llm_model": model,
        "delivered_email_at": delivered_email_at.isoformat() if delivered_email_at else None,
    }


def list_oracle_reports(user_id: int, limit: int = 12) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(OracleReport)
            .where(OracleReport.user_id == user_id)
            .order_by(OracleReport.period_end.desc())
            .limit(limit)
        ).all()
    output: list[dict] = []
    for row in rows:
        try:
            summary = json.loads(row.summary_json or "{}")
        except Exception:
            summary = {}
        output.append(
            {
                "id": row.id,
                "user_id": row.user_id,
                "period_start": row.period_start.isoformat(),
                "period_end": row.period_end.isoformat(),
                "summary": summary,
                "narrative_text": row.narrative_text,
                "delivered_email_at": row.delivered_email_at.isoformat() if row.delivered_email_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return output


def latest_oracle_report(user_id: int) -> dict | None:
    rows = list_oracle_reports(user_id=user_id, limit=1)
    if not rows:
        return None
    return rows[0]


def run_oracle_monthly_job() -> dict[str, int]:
    stats = {"processed": 0, "created": 0}
    with session_scope() as session:
        user_ids = session.scalars(select(User.id)).all()
    for user_id in user_ids:
        stats["processed"] += 1
        row = create_oracle_report_for_user(user_id=user_id, allow_fallback_window=False)
        if row is not None:
            stats["created"] += 1
    return stats
