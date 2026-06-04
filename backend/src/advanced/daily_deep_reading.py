"""Luận giải sâu "hôm nay" cho Daily Card (RAG + LLM), chỉ chạy khi user bấm nút.

Tái dùng tối đa hạ tầng sẵn có:
  - draw_today_card()/get_today_card() để lấy (hoặc tạo) lá Daily Card của ngày.
  - RagRetriever.retrieve() để lấy snippet ý nghĩa lá bài.
  - ReadingGenerator.generate_custom() để chạy ĐÚNG chuỗi fallback hiện có
    (Gemini → OpenAI → Groq → Ollama → deterministic), KHÔNG gọi thẳng 1 provider.
  - card_meaning_phrase_vi()/card_keywords_vi()/_advice_line() để dựng bản dự phòng
    tất định khi LLM lỗi/hết quota.

Kết quả được CACHE theo (user_id, draw_date, topic) trong bảng daily_deep_readings:
bấm lại cùng chủ đề trong ngày trả lại bản cũ (cached=True), không gọi lại LLM.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.advanced.daily_card import (
    _today_local_iso,
    draw_today_card,
    get_today_card,
)
from src.db.models import DailyDeepReading, TarotCard
from src.db.session import session_scope
from src.llm.card_meanings_vi import card_keywords_vi, card_meaning_phrase_vi
from src.llm.generate import _advice_line, _detect_theme
from src.utils.logging import get_logger

if TYPE_CHECKING:  # tránh import nặng lúc load module; chỉ cần cho type hint
    from src.llm.generate import ReadingGenerator
    from src.rag.retrieve import RagRetriever

LOGGER = get_logger(__name__)

# Chủ đề người dùng chọn → "theme" nội bộ (tái dùng _advice_line/_detect_theme sẵn có).
TOPIC_TO_THEME: dict[str, str] = {
    "general": "general",
    "work": "career",
    "love": "love",
    "study": "study",
    "finance": "finance",
}
VALID_TOPICS: frozenset[str] = frozenset(TOPIC_TO_THEME)

TOPIC_LABEL_VI: dict[str, str] = {
    "general": "tổng quan",
    "work": "công việc",
    "love": "tình cảm",
    "study": "học tập",
    "finance": "tài chính",
}

# Bản dự phòng tất định: hành động nhỏ / điều nên tránh theo theme (rõ nghĩa, áp dụng được).
_ACTION_BY_THEME: dict[str, str] = {
    "general": "Chọn đúng một việc nhỏ quan trọng nhất và hoàn thành nó trước khi mở việc mới.",
    "career": "Chọn đúng một đầu việc công việc và làm xong trong hôm nay, đừng mở thêm việc mới.",
    "love": "Nói hoặc nhắn thẳng một điều bạn thật sự muốn chia sẻ với người quan trọng.",
    "study": "Dành một phiên học 25–30 phút tập trung cho đúng một mục tiêu rõ ràng.",
    "finance": "Ghi lại các khoản chi hôm nay và cắt một khoản không thật sự cần thiết.",
    "health": "Ưu tiên một thói quen lành mạnh nhỏ hôm nay: ngủ đủ, vận động nhẹ hoặc uống đủ nước.",
}
_AVOID_BY_THEME: dict[str, str] = {
    "general": "Tránh ôm đồm quá nhiều việc cùng lúc khiến không việc nào xong.",
    "career": "Tránh nhận thêm cam kết mới khi việc đang dở còn chưa khép lại.",
    "love": "Tránh suy diễn ý người khác khi chưa hỏi cho rõ.",
    "study": "Tránh học dồn nhiều thứ một lúc rồi mất tập trung.",
    "finance": "Tránh quyết định chi tiêu hay đầu tư vội vàng khi còn đang phân vân.",
    "health": "Tránh ép bản thân quá sức hoặc bỏ bê nghỉ ngơi để chạy theo việc khác.",
}

_MAX_SNIPPETS = 3


_MAX_TOPIC_LEN = 60  # < String(64) của cột topic; đủ cho một cụm chủ đề ngắn.


def validate_topic(topic: Any) -> str:
    """Chuẩn hoá chủ đề TỰ DO do người dùng nhập (không còn giới hạn danh sách cố định).

    Gộp khoảng trắng thừa, cắt độ dài an toàn, rỗng → 'general'. Chủ đề preset được
    hạ chữ thường để map theme/nhãn ổn định; chủ đề tự do giữ nguyên dạng để hiển thị.
    """
    clean = " ".join(str(topic or "").split()).strip()
    if not clean:
        return "general"
    if len(clean) > _MAX_TOPIC_LEN:
        clean = clean[:_MAX_TOPIC_LEN].strip()
    if clean.lower() in VALID_TOPICS:
        return clean.lower()
    return clean


def _theme_for_topic(topic: str) -> str:
    """Suy ra 'theme' (cho lời khuyên dự phòng tất định) từ chủ đề tự do."""
    preset = TOPIC_TO_THEME.get(topic.lower())
    if preset:
        return preset
    return _detect_theme(topic, None)


def _topic_label(topic: str) -> str:
    """Nhãn hiển thị trong prompt: preset có nhãn tiếng Việt riêng, tự do dùng chính nó."""
    return TOPIC_LABEL_VI.get(topic.lower(), topic)


def _orientation_vi(orientation: str) -> str:
    return "ngược" if str(orientation or "upright").lower() == "reversed" else "xuôi"


def _sanitize_warnings(raw_warnings: list[str], llm_model: str | None) -> list[str]:
    """Ẩn chi tiết hạ tầng (tên provider, số thứ tự key...) khỏi phía client.

    Chỉ trả thông điệp chung, dễ hiểu cho người dùng. Chi tiết kỹ thuật vẫn được ghi ở
    log server (LOGGER.warning bên trong generate_custom), không lộ ra response/DB.
    """
    if llm_model == "deterministic-fallback":
        return ["Hiện chưa kết nối được mô hình AI; đây là luận giải dự phòng tự động."]
    if raw_warnings:
        return ["Một số mô hình AI tạm thời bận nên hệ thống đã tự chuyển phương án khác."]
    return []


def _lookup_suit(card_name: str) -> str | None:
    """Tra suit của lá bài theo tên (để keyword Minor Arcana chuẩn hơn). Best-effort."""
    try:
        with session_scope() as session:
            return session.scalar(select(TarotCard.suit).where(TarotCard.name == card_name))
    except Exception as exc:  # pragma: no cover - phòng thủ, không chặn luồng chính
        LOGGER.warning("Không tra được suit cho %r: %s", card_name, exc)
        return None


def _retrieve_snippets(
    retriever: "RagRetriever",
    *,
    card_name: str,
    orientation: str,
    topic: str,
) -> list[dict[str, Any]]:
    """Lấy snippet RAG cho lá bài + chủ đề. RAG tự fallback an toàn nếu thiếu index."""
    query_text = f"{_topic_label(topic)} {card_name}"
    try:
        snippets = retriever.retrieve(
            query_text=query_text,
            card_name=card_name,
            orientation=orientation,
            top_k=_MAX_SNIPPETS,
        )
        return list(snippets or [])
    except Exception as exc:  # pragma: no cover - phòng thủ
        LOGGER.warning("RAG retrieve cho deep-reading lỗi (%r): %s", card_name, exc)
        return []


def _snippet_lines(snippets: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for snippet in snippets[:_MAX_SNIPPETS]:
        text = str(snippet.get("text", "")).replace("\n", " ").strip()
        if text:
            lines.append(f"- {text[:220]}")
    return lines


def build_deep_reading_prompt(
    reader: "ReadingGenerator",
    *,
    card_name: str,
    orientation: str,
    topic: str,
    suit: str | None,
    snippets: list[dict[str, Any]],
) -> tuple[str, str]:
    """Dựng (system_prompt, user_prompt) tiếng Việt cho luận giải sâu 4 mục."""
    orient_vi = _orientation_vi(orientation)
    topic_vi = _topic_label(topic)
    snippet_block = "\n".join(_snippet_lines(snippets)) or "(không có tư liệu RAG cho lá này)"

    system_prompt = (
        f"{reader.system_prompt}\n\n"
        "NHIỆM VỤ ĐẶC BIỆT: Bạn đang viết một bản 'luận giải sâu trong ngày' cho MỘT lá bài "
        "theo MỘT chủ đề cụ thể mà người dùng chọn. Hãy viết bằng tiếng Việt tự nhiên, gần gũi, "
        "thực tế và đời thường. KHÔNG mê tín, KHÔNG hù dọa, KHÔNG hứa hẹn chắc chắn về tương lai, "
        "KHÔNG nhắc đến việc lá bài được rút ngẫu nhiên. Tập trung vào lời khuyên có thể hành động được."
    )

    user_prompt = (
        f"Lá bài hôm nay: **{card_name}** (chiều {orient_vi}).\n"
        f"Chủ đề người dùng chọn: **{topic_vi}**.\n\n"
        f"Tư liệu tham khảo (RAG) về lá bài:\n{snippet_block}\n\n"
        "Hãy viết luận giải NGẮN GỌN bằng Markdown, đúng 4 mục sau và GIỮ NGUYÊN tiêu đề:\n\n"
        "### Tổng quan hôm nay\n"
        "(2–3 câu nối lá bài + chiều xuôi/ngược + chủ đề, giọng gần gũi)\n\n"
        f"### Lời khuyên cho {topic_vi}\n"
        "(2–3 gạch đầu dòng cụ thể, áp dụng được ngay)\n\n"
        "### Một việc nhỏ nên làm hôm nay\n"
        "(đúng 1 hành động nhỏ, rõ ràng, làm được trong hôm nay)\n\n"
        "### Một điều nên tránh\n"
        "(đúng 1 điều nên tránh, cụ thể)\n\n"
        "Tổng độ dài khoảng 150–250 từ. Không thêm mục nào khác, không dùng emoji."
    )
    return system_prompt, user_prompt


def build_deterministic_deep_reading(
    *,
    card_name: str,
    orientation: str,
    topic: str,
    suit: str | None,
    snippets: list[dict[str, Any]],
) -> str:
    """Bản dự phòng tất định 4 mục khi LLM lỗi/hết quota — vẫn rõ nghĩa, đúng định dạng."""
    theme = _theme_for_topic(topic)
    topic_vi = _topic_label(topic)
    orient_vi = _orientation_vi(orientation)
    is_reversed = str(orientation or "upright").lower() == "reversed"

    meaning = card_meaning_phrase_vi(card_name, orientation, "single", suit)
    keywords = card_keywords_vi(card_name, orientation, suit)
    advice = _advice_line(theme, "single", orientation, card_name)

    overview = f"Lá **{card_name}** (chiều {orient_vi}) cho chủ đề {topic_vi}: {meaning}"
    if is_reversed:
        overview += " Hôm nay nên chậm lại một nhịp để tránh quyết định vội."

    lines = [
        "### Tổng quan hôm nay",
        overview,
        "",
        f"### Lời khuyên cho {topic_vi}",
        f"- {advice}",
        f"- Ưu tiên {keywords[0]}, {keywords[1]} và {keywords[2]} thay vì cố làm tất cả cùng lúc.",
        "",
        "### Một việc nhỏ nên làm hôm nay",
        f"- {_ACTION_BY_THEME.get(theme, _ACTION_BY_THEME['general'])}",
        "",
        "### Một điều nên tránh",
        f"- {_AVOID_BY_THEME.get(theme, _AVOID_BY_THEME['general'])}",
    ]

    snippet_lines = _snippet_lines(snippets)
    if snippet_lines:
        lines.append("")
        lines.append("### Tư liệu tham khảo")
        lines.extend(snippet_lines)

    return "\n".join(lines)


def _build_response(
    *,
    record: DailyDeepReading,
    card: dict[str, Any] | None,
    cached: bool,
) -> dict[str, Any]:
    if card is None:
        # FK CASCADE đảm bảo daily card tồn tại nếu deep reading tồn tại; nhánh này chỉ
        # phòng thủ — dựng card tối thiểu từ snapshot đã lưu.
        card = {
            "card_name": record.card_name,
            "orientation": record.orientation,
            "draw_date": record.draw_date,
        }
    try:
        warnings = json.loads(record.warnings_json or "[]")
        if not isinstance(warnings, list):
            warnings = []
    except json.JSONDecodeError:
        warnings = []
    return {
        "card": card,
        "topic": record.topic,
        "deep_reading": record.deep_reading,
        "llm_model": record.llm_model,
        "cached": cached,
        "warnings": warnings,
    }


def get_or_create_deep_reading(
    *,
    user_id: int,
    topic: str,
    reader: "ReadingGenerator",
    retriever: "RagRetriever",
) -> dict[str, Any]:
    """Lấy (hoặc sinh + lưu) luận giải sâu cho user, theo ngày + chủ đề.

    - Đã có (user_id, hôm nay, topic) → trả bản cũ, cached=True (KHÔNG gọi LLM).
    - Chưa có → lấy/tạo lá Daily Card hôm nay, gọi chuỗi LLM (fallback deterministic),
      lưu lại race-safe rồi trả cached=False.
    """
    topic = validate_topic(topic)
    today_iso = _today_local_iso()

    # 1) Cache hit?
    with session_scope() as session:
        existing = session.scalar(
            select(DailyDeepReading).where(
                DailyDeepReading.user_id == user_id,
                DailyDeepReading.draw_date == today_iso,
                DailyDeepReading.topic == topic,
            )
        )
        if existing is not None:
            card = get_today_card(user_id=user_id)
            return _build_response(record=existing, card=card, cached=True)

    # 2) Đảm bảo có lá Daily Card hôm nay (idempotent, đồng nhất logic hiện tại).
    card = draw_today_card(user_id=user_id)
    card_name = card["card_name"]
    orientation = card["orientation"]
    daily_card_id = card["id"]
    suit = _lookup_suit(card_name)

    # 3) RAG snippets cho lá bài + chủ đề.
    snippets = _retrieve_snippets(
        retriever, card_name=card_name, orientation=orientation, topic=topic
    )

    # 4) Dựng prompt + bản dự phòng tất định.
    system_prompt, user_prompt = build_deep_reading_prompt(
        reader,
        card_name=card_name,
        orientation=orientation,
        topic=topic,
        suit=suit,
        snippets=snippets,
    )
    fallback_text = build_deterministic_deep_reading(
        card_name=card_name,
        orientation=orientation,
        topic=topic,
        suit=suit,
        snippets=snippets,
    )

    # 5) Gọi ĐÚNG chuỗi LLM hiện có (không gọi thẳng provider đơn lẻ).
    deep_reading, warnings = reader.generate_custom(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        fallback_text=fallback_text,
    )
    llm_model = reader.last_used_model
    client_warnings = _sanitize_warnings(warnings, llm_model)

    # 6) Lưu lại — race-safe theo unique (user_id, draw_date, topic).
    with session_scope() as session:
        record = DailyDeepReading(
            user_id=user_id,
            daily_card_id=daily_card_id,
            draw_date=today_iso,
            topic=topic,
            card_name=card_name,
            orientation=orientation,
            deep_reading=deep_reading,
            llm_model=llm_model,
            warnings_json=json.dumps(client_warnings, ensure_ascii=False),
        )
        session.add(record)
        try:
            session.flush()
        except IntegrityError:
            # Hai request cùng (user, ngày, topic) chạy song song → 1 cái thắng.
            session.rollback()
            with session_scope() as fresh:
                existing = fresh.scalar(
                    select(DailyDeepReading).where(
                        DailyDeepReading.user_id == user_id,
                        DailyDeepReading.draw_date == today_iso,
                        DailyDeepReading.topic == topic,
                    )
                )
                if existing is not None:
                    return _build_response(record=existing, card=card, cached=True)
            raise
        return _build_response(record=record, card=card, cached=False)
