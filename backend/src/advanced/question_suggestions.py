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
    0: "Tuan nay toi nen uu tien muc tieu nao de bat dau dung huong?",
    1: "Buoc hanh dong nao toi nen lam ngay de day nhanh tien do?",
    2: "Toi can giao tiep the nao de tranh hieu lam quan trong?",
    3: "Toi can tap trung vao co hoi phat trien nao trong cong viec?",
    4: "Toi nen can bang giua cam xuc va ly tri ra sao trong hom nay?",
    5: "Dieu gi can duoc hoi phuc trong cuoi tuan nay?",
    6: "Thong diep tong ket nao toi can mang sang tuan moi?",
}

MOON_PROMPTS = {
    "New Moon": "Nang luong khoi dau dang manh, toi nen dat y dinh gi cho chu ky moi?",
    "Waxing Moon": "Toi dang xay dung dieu gi va can bo sung nguon luc nao de tang toc?",
    "Full Moon": "Dieu gi da den luc duoc nhin ro va hoan tat?",
    "Waning Moon": "Toi can buong bo dieu gi de nhe hon trong giai doan tiep theo?",
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
    if recent_card:
        return f"Signals: {moon_phase}, {weekday_name}, recent card {recent_card}."
    return f"Signals: {moon_phase}, {weekday_name}, no recent card yet."


def generate_question_suggestions(user_id: int | None, limit: int = 3) -> list[dict[str, object]]:
    if limit <= 0:
        return []

    timezone_info = _app_timezone()
    local_now = datetime.now(timezone_info)
    weekday = local_now.weekday()
    weekday_name = local_now.strftime("%A")
    moon_phase = moon_phase_name(local_now.astimezone(timezone.utc))
    recent_card = _recent_card_for_user(user_id)

    suggestions: list[str] = [
        MOON_PROMPTS[moon_phase],
        WEEKDAY_PROMPTS.get(weekday, WEEKDAY_PROMPTS[0]),
    ]

    if recent_card:
        suggestions.append(f"Tu thong diep cua la {recent_card}, toi nen hanh dong cu the nao trong 7 ngay toi?")
    else:
        suggestions.append("Neu toi chi duoc tap trung vao mot dieu duy nhat, dieu do nen la gi?")

    while len(suggestions) < limit:
        suggestions.append("Toi can biet dieu gi de giu binh tam va ra quyet dinh sang suot hon?")

    reason = _build_reason(moon_phase=moon_phase, weekday_name=weekday_name, recent_card=recent_card)
    signal_payload = {
        "moon_phase": moon_phase,
        "weekday": weekday_name,
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
