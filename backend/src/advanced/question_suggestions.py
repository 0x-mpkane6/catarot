from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from src.db.models import ReadingSession, RecognizedCard, TarotCard
from src.db.session import session_scope
from src.utils.logging import get_logger
from src.utils.timezone import get_app_timezone

KNOWN_NEW_MOON = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)
LUNATION_DAYS = 29.53058867

WEEKDAY_PROMPTS = {
    0: "Tuần này tôi nên ưu tiên mục tiêu nào để bắt đầu đúng hướng?",
    1: "Bước hành động nào tôi nên làm ngay để đẩy nhanh tiến độ?",
    2: "Tôi cần giao tiếp thế nào để tránh hiểu lầm quan trọng?",
    3: "Tôi nên tập trung vào cơ hội phát triển nào trong công việc?",
    4: "Hôm nay tôi nên cân bằng giữa cảm xúc và lý trí ra sao?",
    5: "Điều gì cần được hồi phục trong cuối tuần này?",
    6: "Thông điệp tổng kết nào tôi cần mang sang tuần mới?",
}

MOON_PROMPTS = {
    "New Moon": "Năng lượng khởi đầu đang mạnh, tôi nên đặt ý định gì cho chu kỳ mới?",
    "Waxing Moon": "Tôi đang xây dựng điều gì và cần bổ sung nguồn lực nào để tăng tốc?",
    "Full Moon": "Điều gì đã đến lúc được nhìn rõ và hoàn tất?",
    "Waning Moon": "Tôi cần buông bỏ điều gì để nhẹ nhõm hơn trong giai đoạn tiếp theo?",
}

# Nhãn hiển thị tiếng Việt cho pha trăng và thứ trong tuần (dùng trong phần lý do).
MOON_PHASE_VI = {
    "New Moon": "Trăng non",
    "Waxing Moon": "Trăng tròn dần",
    "Full Moon": "Trăng tròn",
    "Waning Moon": "Trăng khuyết dần",
}

WEEKDAY_VI = {
    0: "Thứ Hai",
    1: "Thứ Ba",
    2: "Thứ Tư",
    3: "Thứ Năm",
    4: "Thứ Sáu",
    5: "Thứ Bảy",
    6: "Chủ Nhật",
}

LOGGER = get_logger(__name__)


def _app_timezone():
    return get_app_timezone(logger=LOGGER)


def moon_phase_name(moment: datetime | None = None) -> str:
    now = moment or datetime.now(tz=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    else:
        now = now.astimezone(timezone.utc)

    age = (now - KNOWN_NEW_MOON).total_seconds() / 86400.0
    phase = age % LUNATION_DAYS

    if phase < 1.84566 or phase >= 27.68493:
        return "New Moon"
    if phase < 9.22831:
        return "Waxing Moon"
    if phase < 16.61096:
        return "Full Moon"
    return "Waning Moon"


def _recent_card_for_user(user_id: int | None) -> str | None:
    if user_id is None:
        return None

    with session_scope() as session:
        row = session.execute(
            select(TarotCard.name)
            .join(RecognizedCard, RecognizedCard.card_id == TarotCard.id)
            .join(ReadingSession, ReadingSession.id == RecognizedCard.session_id)
            .where(ReadingSession.user_id == user_id)
            .order_by(ReadingSession.created_at.desc(), RecognizedCard.order_index.asc())
            .limit(1)
        ).first()
    if row is None:
        return None
    return row[0]


def _build_reason(*, moon_phase: str, weekday_name: str, recent_card: str | None) -> str:
    moon_vi = MOON_PHASE_VI.get(moon_phase, moon_phase)
    if recent_card:
        return f"Tín hiệu: {moon_vi}, {weekday_name}, lá gần đây {recent_card}."
    return f"Tín hiệu: {moon_vi}, {weekday_name}, chưa có lá nào gần đây."


def generate_question_suggestions(user_id: int | None, limit: int = 3) -> list[dict[str, object]]:
    if limit <= 0:
        return []

    timezone_info = _app_timezone()
    local_now = datetime.now(timezone_info)
    weekday = local_now.weekday()
    weekday_vi = WEEKDAY_VI.get(weekday, WEEKDAY_VI[0])
    moon_phase = moon_phase_name(local_now.astimezone(timezone.utc))
    recent_card = _recent_card_for_user(user_id)

    suggestions: list[str] = [
        MOON_PROMPTS[moon_phase],
        WEEKDAY_PROMPTS.get(weekday, WEEKDAY_PROMPTS[0]),
    ]

    if recent_card:
        suggestions.append(f"Từ thông điệp của lá {recent_card}, tôi nên hành động cụ thể nào trong 7 ngày tới?")
    else:
        suggestions.append("Nếu chỉ được tập trung vào một điều duy nhất, điều đó nên là gì?")

    while len(suggestions) < limit:
        suggestions.append("Tôi cần biết điều gì để giữ bình tâm và ra quyết định sáng suốt hơn?")

    reason = _build_reason(moon_phase=moon_phase, weekday_name=weekday_vi, recent_card=recent_card)
    signal_payload = {
        "moon_phase": moon_phase,
        "weekday": weekday_vi,
        "recent_card": recent_card,
    }

    return [
        {
            "text": suggestions[idx],
            "reason": reason,
            "signals": signal_payload,
        }
        for idx in range(limit)
    ]
