from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from src.asr.transcribe import transcribe_audio
from src.db.models import DreamEntry, ReadingSession, RecognizedCard, TarotCard
from src.db.session import session_scope
from src.llm.generate import ReadingGenerator
from src.utils.config import resolve_path
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

_ARRAY_RE = re.compile(r"\[[\s\S]*\]")
_MAX_SYMBOLS = 7

# Bộ Ẩn Chính (Major Arcana) — danh sách lá hợp lệ để LLM chọn và để chuẩn hoá tên.
# Giới hạn ở Major Arcana vì chắc chắn có trong seed `tarot_cards`, đủ cho giải mã giấc mơ.
_MAJOR_ARCANA: tuple[str, ...] = (
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
)
_ARCANA_BY_LOWER: dict[str, str] = {name.lower(): name for name in _MAJOR_ARCANA}


def _symbol_map() -> dict[str, list[str]]:
    path = resolve_path("./configs/dream_symbol_map.json")
    if not Path(path).exists():
        return {}
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    output: dict[str, list[str]] = {}
    if not isinstance(payload, dict):
        return output
    for key, value in payload.items():
        if not isinstance(key, str) or not isinstance(value, list):
            continue
        output[key.lower().strip()] = [str(item).strip() for item in value if str(item).strip()]
    return output


def _canonical_arcana(name: str) -> str:
    """Chuẩn hoá tên lá về đúng dạng trong seed; bỏ tên không thuộc Major Arcana."""
    return _ARCANA_BY_LOWER.get((name or "").strip().lower(), "")


def _fallback_meaning(symbol: str, cards: list[str]) -> str:
    if cards:
        return f"Biểu tượng “{symbol}” trong giấc mơ gợi liên hệ tới {', '.join(cards)}."
    return f"Biểu tượng “{symbol}” mang sắc thái cần chiêm nghiệm thêm."


def _llm_complete(reader: ReadingGenerator, system_prompt: str, user_prompt: str) -> str:
    """Gọi LLM theo cùng thứ tự ưu tiên của hệ thống: Gemini → OpenAI → Groq → Ollama."""
    attempts = []
    if reader.gemini_api_key:
        attempts.append(lambda: reader._generate_gemini(system_prompt, user_prompt))
    if reader.api_key:
        attempts.append(lambda: reader._generate_openai(system_prompt, user_prompt))
    if reader.groq_api_key:
        attempts.append(lambda: reader._generate_groq(system_prompt, user_prompt))
    if reader.ollama_enabled:
        attempts.append(lambda: reader._generate_ollama(system_prompt, user_prompt))

    for call in attempts:
        try:
            content = call()
        except Exception as exc:  # noqa: BLE001 - mỗi tier có thể lỗi, thử tier kế tiếp
            LOGGER.warning("dream LLM tier failed: %s", exc)
            continue
        if content and content.strip():
            return content
    return ""


_DREAM_SYSTEM_PROMPT = (
    "Bạn là chuyên gia giải mã giấc mơ theo Tarot. Đọc nội dung giấc mơ, trích 3-7 biểu tượng nổi bật. "
    "Với MỖI biểu tượng, chọn 1-2 lá Bộ Ẩn Chính (Major Arcana) phù hợp nhất và viết MỘT câu ý nghĩa "
    "ngắn gọn bằng tiếng Việt (liên hệ biểu tượng với lá bài). Chỉ dùng tên lá trong danh sách sau, "
    "giữ nguyên tiếng Anh: "
    + ", ".join(_MAJOR_ARCANA)
    + ". Trả về DUY NHẤT một mảng JSON, mỗi phần tử dạng "
    '{"symbol":"<biểu tượng tiếng Việt, chữ thường>","arcana":["<tên lá>"],"meaning":"<một câu tiếng Việt>"}. '
    "Không thêm bất kỳ chữ nào ngoài mảng JSON."
)


def _parse_symbol_rows(content: str) -> list[dict[str, object]]:
    """Phân tích mảng JSON các object {symbol, arcana, meaning} do LLM trả về."""
    match = _ARRAY_RE.search(content or "")
    if not match:
        return []
    try:
        payload = json.loads(match.group(0))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []

    rows: list[dict[str, object]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        symbol = str(item.get("symbol", "")).strip().lower()
        if not symbol:
            continue
        raw_arcana = item.get("arcana") or item.get("arcana_candidates") or []
        if isinstance(raw_arcana, str):
            raw_arcana = [raw_arcana]
        cards: list[str] = []
        if isinstance(raw_arcana, list):
            for candidate in raw_arcana:
                canonical = _canonical_arcana(str(candidate))
                if canonical and canonical not in cards:
                    cards.append(canonical)
        meaning = str(item.get("meaning", "")).strip()
        rows.append({"symbol": symbol, "arcana_candidates": cards, "meaning": meaning})
    return rows


def _llm_map_symbols(text: str) -> list[dict[str, object]]:
    if not text.strip():
        return []
    reader = ReadingGenerator()
    content = _llm_complete(reader, _DREAM_SYSTEM_PROMPT, f"GIẤC MƠ:\n{text}")
    return _parse_symbol_rows(content)


def _rule_extract_symbols(text: str, mapping: dict[str, list[str]]) -> list[str]:
    clean = (text or "").lower()
    output = []
    for symbol in mapping.keys():
        if symbol in clean:
            output.append(symbol)
    return output


def _map_symbols_to_arcana(symbols: list[str], mapping: dict[str, list[str]]) -> list[dict[str, object]]:
    """Ánh xạ rule-based (fallback offline): tra từ điển + sinh câu ý nghĩa generic."""
    rows: list[dict[str, object]] = []
    for symbol in symbols:
        cards = mapping.get(symbol.lower().strip(), [])
        rows.append(
            {
                "symbol": symbol,
                "arcana_candidates": cards,
                "meaning": _fallback_meaning(symbol, cards),
            }
        )
    return rows


def _finalize_rows(
    rows: list[dict[str, object]],
    mapping: dict[str, list[str]],
) -> list[dict[str, object]]:
    """Khử trùng theo biểu tượng, bù arcana/ý nghĩa còn thiếu từ từ điển, giới hạn số lượng."""
    seen: set[str] = set()
    final: list[dict[str, object]] = []
    for row in rows:
        symbol = str(row.get("symbol", "")).strip()
        if not symbol or symbol.lower() in seen:
            continue
        seen.add(symbol.lower())

        cards = [c for c in (row.get("arcana_candidates") or []) if isinstance(c, str) and c]
        if not cards:
            cards = list(mapping.get(symbol.lower(), []))
        meaning = str(row.get("meaning", "")).strip() or _fallback_meaning(symbol, cards)

        final.append({"symbol": symbol, "arcana_candidates": cards, "meaning": meaning})
        if len(final) >= _MAX_SYMBOLS:
            break
    return final


def _cross_reference_recent_readings(user_id: int | None, mapped: list[dict[str, object]], days: int = 7) -> list[dict]:
    if user_id is None:
        return []
    card_pool = {
        card
        for row in mapped
        for card in (row.get("arcana_candidates") or [])
        if isinstance(card, str) and card
    }
    if not card_pool:
        return []

    since = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        rows = session.execute(
            select(
                ReadingSession.id,
                ReadingSession.created_at,
                TarotCard.name,
                RecognizedCard.orientation,
            )
            .join(RecognizedCard, RecognizedCard.session_id == ReadingSession.id)
            .join(TarotCard, TarotCard.id == RecognizedCard.card_id)
            .where(
                ReadingSession.user_id == user_id,
                ReadingSession.created_at >= since,
                TarotCard.name.in_(card_pool),
            )
            .order_by(ReadingSession.created_at.desc())
            .limit(30)
        ).all()

    return [
        {
            "session_id": row[0],
            "created_at": row[1].isoformat() if row[1] else None,
            "card_name": row[2],
            "orientation": row[3],
        }
        for row in rows
    ]


# =============================
# Diễn giải tổng hợp (RAG/LLM + fallback tất định) — phần "giấc mơ nói gì về mình"
# =============================

_JSON_OBJ_RE = re.compile(r"\{[\s\S]*\}")

_INTERPRET_SYSTEM_PROMPT = (
    "Bạn là người đồng hành giúp người dùng SUY NGẪM về giấc mơ theo hướng nhẹ nhàng, thực tế "
    "và phản tư. KHÔNG mê tín, KHÔNG phán chắc chắn về tương lai, KHÔNG dùng ngôn ngữ huyền bí "
    "nặng nề. Viết tiếng Việt tự nhiên, ngắn gọn, ưu tiên câu có ích cho người dùng. Trả về DUY "
    "NHẤT một object JSON hợp lệ theo đúng schema được yêu cầu, KHÔNG kèm markdown, KHÔNG kèm bất "
    "kỳ chữ nào ngoài JSON."
)


def _recent_sessions_with_cards(user_id: int | None, days: int = 7, limit: int = 5) -> list[dict]:
    """Các phiên đọc bài gần đây (mặc định 7 ngày) của user kèm câu hỏi + lá bài.

    Dùng làm ngữ cảnh cho phần 'liên hệ trải bài gần đây' của diễn giải. Khác với
    _cross_reference_recent_readings (lọc theo lá trùng), hàm này lấy các phiên gần nhất
    bất kể trùng lá, để LLM tự nhìn ra mối liên hệ.
    """
    if user_id is None:
        return []
    since = datetime.now(timezone.utc) - timedelta(days=days)
    with session_scope() as session:
        sess_rows = session.execute(
            select(
                ReadingSession.id,
                ReadingSession.question_text,
                ReadingSession.created_at,
            )
            .where(
                ReadingSession.user_id == user_id,
                ReadingSession.created_at >= since,
            )
            .order_by(ReadingSession.created_at.desc())
            .limit(limit)
        ).all()
        if not sess_rows:
            return []
        session_ids = [r[0] for r in sess_rows]
        card_rows = session.execute(
            select(
                RecognizedCard.session_id,
                TarotCard.name,
                RecognizedCard.orientation,
            )
            .join(TarotCard, TarotCard.id == RecognizedCard.card_id)
            .where(RecognizedCard.session_id.in_(session_ids))
            .order_by(RecognizedCard.order_index)
        ).all()

    cards_by_session: dict[int, list[dict]] = {}
    for sid, name, orientation in card_rows:
        cards_by_session.setdefault(sid, []).append(
            {"card_name": name, "orientation": orientation}
        )

    return [
        {
            "session_id": sid,
            "question": (question or "").strip(),
            "created_at": created_at.isoformat() if created_at else None,
            "cards": cards_by_session.get(sid, []),
        }
        for sid, question, created_at in sess_rows
    ]


def _guess_emotional_tone(text: str) -> str:
    """Đoán cảm xúc nền (cho bản dự phòng) theo từ khoá tiếng Việt đơn giản."""
    t = (text or "").lower()
    buckets: tuple[tuple[str, tuple[str, ...]], ...] = (
        ("lo lắng", ("sợ", "lo ", "lo lắng", "hoảng", "ác mộng", "chạy trốn", "nguy hiểm", "đáng sợ")),
        ("do dự", ("chưa dám", "do dự", "phân vân", "ngập ngừng", "lưỡng lự", "không chắc")),
        ("trầm lắng", ("buồn", "khóc", "cô đơn", "mất mát", "lạc lõng")),
        ("hy vọng", ("ánh sáng", "phát sáng", "bay", "vui", "hạnh phúc", "ấm áp", "hy vọng")),
        ("tò mò", ("lạ", "kỳ lạ", "tò mò", "khám phá", "bí ẩn")),
    )
    for tone, keys in buckets:
        if any(k in t for k in keys):
            return tone
    return "đang suy ngẫm"


def _build_interpret_user_prompt(
    combined_text: str,
    mapped: list[dict[str, object]],
    recent_sessions: list[dict],
) -> str:
    symbol_lines: list[str] = []
    for row in mapped:
        sym = str(row.get("symbol", "")).strip()
        if not sym:
            continue
        cards = ", ".join(c for c in (row.get("arcana_candidates") or []) if isinstance(c, str) and c)
        symbol_lines.append(f"- {sym}" + (f" -> {cards}" if cards else ""))
    symbols_block = "\n".join(symbol_lines) or "(chưa tách được biểu tượng)"

    if recent_sessions:
        sess_lines = []
        for s in recent_sessions:
            cards = ", ".join(
                str(c.get("card_name", "")) for c in s.get("cards", []) if c.get("card_name")
            )
            question = s.get("question") or "(không có câu hỏi)"
            sess_lines.append(
                f'- session_id={s["session_id"]}: "{question}"' + (f" [lá: {cards}]" if cards else "")
            )
        sessions_block = "\n".join(sess_lines)
    else:
        sessions_block = "(không có phiên đọc bài nào trong 7 ngày gần đây)"

    return (
        f"GIẤC MƠ:\n{combined_text}\n\n"
        f"BIỂU TƯỢNG & LÁ BÀI ĐÃ ÁNH XẠ:\n{symbols_block}\n\n"
        f"PHIÊN ĐỌC BÀI GẦN ĐÂY (7 ngày):\n{sessions_block}\n\n"
        "Hãy trả về JSON đúng schema sau (mọi giá trị bằng tiếng Việt):\n"
        "{\n"
        '  "summary_interpretation": "2-4 câu diễn giải tổng hợp, phản tư, không phán chắc",\n'
        '  "main_theme": "chủ đề chính, ngắn gọn",\n'
        '  "emotional_tone": "cảm xúc nền (vd: lo lắng, tò mò, do dự, hy vọng)",\n'
        '  "recent_reading_connections": [\n'
        '    {"session_id": <id CÓ THẬT trong danh sách trên>, "question": "...", "connection": "1 câu liên hệ"}\n'
        "  ],\n"
        '  "reflection_questions": ["2-3 câu hỏi phản tư"],\n'
        '  "suggested_action": "một hành động nhỏ, thực tế, làm được trong hôm nay"\n'
        "}\n"
        "CHỈ đưa vào recent_reading_connections những session_id CÓ trong danh sách trên; nếu không "
        "có phiên nào liên hệ được thì để mảng rỗng []. TUYỆT ĐỐI KHÔNG bịa session_id."
    )


def _parse_json_object(content: str) -> dict | None:
    """Trích + parse object JSON đầu tiên từ chuỗi (chịu được markdown fence / prose thừa)."""
    if not content:
        return None
    match = _JSON_OBJ_RE.search(content)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def _coerce_interpretation(parsed: dict, recent_sessions: list[dict]) -> dict | None:
    """Chuẩn hoá JSON do LLM trả về về đúng shape; LOẠI BỎ session_id bịa (không có thật)."""
    summary = str(parsed.get("summary_interpretation", "")).strip()
    if not summary:
        return None

    valid_ids = {s["session_id"] for s in recent_sessions}
    question_by_id = {s["session_id"]: s.get("question", "") for s in recent_sessions}

    connections: list[dict] = []
    raw_connections = parsed.get("recent_reading_connections")
    if isinstance(raw_connections, list):
        for item in raw_connections:
            if not isinstance(item, dict):
                continue
            try:
                sid = int(item.get("session_id"))
            except (TypeError, ValueError):
                continue
            if sid not in valid_ids:
                continue  # chống bịa: chỉ giữ session_id có thật trong 7 ngày
            connection_text = str(item.get("connection", "")).strip()
            if not connection_text:
                continue
            connections.append(
                {
                    "session_id": sid,
                    "question": str(item.get("question") or question_by_id.get(sid, "")).strip(),
                    "connection": connection_text,
                }
            )

    reflection_questions: list[str] = []
    raw_questions = parsed.get("reflection_questions")
    if isinstance(raw_questions, list):
        reflection_questions = [str(q).strip() for q in raw_questions if str(q).strip()][:3]

    return {
        "summary_interpretation": summary,
        "main_theme": str(parsed.get("main_theme", "")).strip() or "khám phá nội tâm",
        "emotional_tone": str(parsed.get("emotional_tone", "")).strip() or "đang suy ngẫm",
        "recent_reading_connections": connections,
        "reflection_questions": reflection_questions,
        "suggested_action": str(parsed.get("suggested_action", "")).strip()
        or "Dành vài phút ghi lại cảm xúc nổi bật nhất về giấc mơ này.",
    }


def _build_deterministic_interpretation(
    *,
    combined_text: str,
    mapped: list[dict[str, object]],
    recent_sessions: list[dict],
) -> dict:
    """Bản diễn giải dự phòng tất định khi LLM lỗi/hết quota — vẫn rõ nghĩa, đúng shape."""
    symbols = [str(r.get("symbol", "")).strip() for r in mapped if str(r.get("symbol", "")).strip()]
    cards: list[str] = []
    for r in mapped:
        for c in (r.get("arcana_candidates") or []):
            if isinstance(c, str) and c and c not in cards:
                cards.append(c)

    tone = _guess_emotional_tone(combined_text)
    sym_str = ", ".join(symbols[:5]) or "những hình ảnh trong giấc mơ"
    main_theme = symbols[0] if symbols else "khám phá nội tâm"

    if cards:
        summary = (
            f"Giấc mơ xoay quanh {sym_str}. Khi liên hệ với Tarot ({', '.join(cards[:4])}), đây có thể "
            "là lúc bạn đang xử lý một điều chưa thật rõ ràng trong lòng. Hãy xem đây như một gợi mở "
            "để chiêm nghiệm, không phải một lời tiên đoán."
        )
    else:
        summary = (
            f"Giấc mơ xoay quanh {sym_str}. Đây là lúc để bạn quan sát cảm xúc của mình một cách nhẹ "
            "nhàng và tự hỏi điều gì đang thật sự khiến bạn bận tâm."
        )

    first_symbol = symbols[0] if symbols else "hình ảnh trong giấc mơ"
    reflection_questions = [
        f"Hình ảnh “{first_symbol}” khiến bạn liên tưởng tới điều gì trong cuộc sống hiện tại?",
        f"Cảm giác {tone} trong giấc mơ có đang xuất hiện ở đâu đó trong những ngày gần đây không?",
        "Nếu giấc mơ muốn nhắc bạn một điều, bạn nghĩ đó là điều gì?",
    ]
    suggested_action = (
        "Dành 5 phút hôm nay viết ra cảm xúc rõ nhất khi nhớ lại giấc mơ này, rồi tự hỏi nó liên quan "
        "tới việc gì bạn đang trải qua."
    )
    connections = [
        {
            "session_id": s["session_id"],
            "question": s.get("question", ""),
            "connection": (
                f"Phiên đọc gần đây về “{s.get('question') or 'một câu hỏi của bạn'}” cũng chạm tới những "
                "băn khoăn tương tự — bạn có thể đọc lại để đối chiếu."
            ),
        }
        for s in recent_sessions[:2]
    ]

    return {
        "summary_interpretation": summary,
        "main_theme": main_theme,
        "emotional_tone": tone,
        "recent_reading_connections": connections,
        "reflection_questions": reflection_questions,
        "suggested_action": suggested_action,
    }


def generate_dream_interpretation(
    *,
    combined_text: str,
    mapped: list[dict[str, object]],
    recent_sessions: list[dict],
) -> dict:
    """Sinh diễn giải tổng hợp cho giấc mơ qua chuỗi LLM hiện có; fallback tất định khi lỗi.

    Tái dùng ReadingGenerator.generate_custom (Gemini -> OpenAI -> Groq -> Ollama -> fallback),
    KHÔNG gọi thẳng một provider. Trả về dict: summary_interpretation, main_theme, emotional_tone,
    recent_reading_connections, reflection_questions, suggested_action, llm_model, source, warnings.
    """
    deterministic = _build_deterministic_interpretation(
        combined_text=combined_text, mapped=mapped, recent_sessions=recent_sessions
    )

    if not combined_text.strip():
        deterministic["llm_model"] = "deterministic-fallback"
        deterministic["source"] = "deterministic-fallback"
        deterministic["warnings"] = []
        return deterministic

    reader = ReadingGenerator()
    user_prompt = _build_interpret_user_prompt(combined_text, mapped, recent_sessions)
    fallback_json = json.dumps(deterministic, ensure_ascii=False)

    text, _raw_warnings = reader.generate_custom(
        system_prompt=_INTERPRET_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        fallback_text=fallback_json,
    )
    model = reader.last_used_model or "deterministic-fallback"

    result = deterministic
    warnings: list[str] = []
    if model == "deterministic-fallback":
        warnings = ["Diễn giải được tạo bằng chế độ dự phòng (chưa kết nối được AI)."]
    else:
        parsed = _parse_json_object(text)
        coerced = _coerce_interpretation(parsed, recent_sessions) if parsed else None
        if coerced is None:
            warnings = ["AI trả về dữ liệu không hợp lệ; đã dùng diễn giải dự phòng."]
            model = "deterministic-fallback"
        else:
            result = coerced

    result["llm_model"] = model
    result["source"] = "llm" if model != "deterministic-fallback" else "deterministic-fallback"
    result["warnings"] = warnings
    return result


def _load_interpretation(raw: str | None) -> dict | None:
    """Parse interpretation_json an toàn (null-safe cho giấc mơ cũ chưa có field này)."""
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return data if isinstance(data, dict) else None


def create_dream_entry(*, user_id: int | None, raw_text: str | None, audio_path: str | None) -> dict:
    transcript, warnings = transcribe_audio(audio_path)
    combined_text = " ".join([raw_text or "", transcript or ""]).strip()

    mapping = _symbol_map()

    # Ưu tiên LLM: trích biểu tượng + ánh xạ lá bài + ý nghĩa trong một lượt.
    rows = _llm_map_symbols(combined_text)
    if not rows:
        # Fallback offline: dò biểu tượng theo từ điển rồi ánh xạ rule-based.
        rule_symbols = _rule_extract_symbols(combined_text, mapping)
        rows = _map_symbols_to_arcana(rule_symbols, mapping)

    mapped = _finalize_rows(rows, mapping)
    symbols = [str(row["symbol"]) for row in mapped]

    matches = _cross_reference_recent_readings(user_id=user_id, mapped=mapped, days=7)

    # MỚI: diễn giải tổng hợp (giấc mơ nói gì + nên làm gì), kèm liên hệ phiên đọc 7 ngày.
    recent_sessions = _recent_sessions_with_cards(user_id=user_id, days=7)
    interpretation = generate_dream_interpretation(
        combined_text=combined_text, mapped=mapped, recent_sessions=recent_sessions
    )

    with session_scope() as session:
        row = DreamEntry(
            user_id=user_id,
            raw_text=(raw_text or "").strip() or None,
            transcript=(transcript or "").strip() or None,
            symbols_json=json.dumps(symbols, ensure_ascii=False),
            mapped_arcana_json=json.dumps(mapped, ensure_ascii=False),
            matches_json=json.dumps(matches, ensure_ascii=False),
            interpretation_json=json.dumps(interpretation, ensure_ascii=False),
        )
        session.add(row)
        session.flush()
        created_id = row.id
        created_at = row.created_at

    return {
        "id": created_id,
        "user_id": user_id,
        "raw_text": raw_text,
        "transcript": transcript,
        "symbols": symbols,
        "mapped_arcana": mapped,
        "matches": matches,
        "interpretation": interpretation,
        "warnings": warnings,
        "created_at": created_at.isoformat() if created_at else None,
    }


def list_dream_entries(user_id: int, limit: int = 20) -> list[dict]:
    with session_scope() as session:
        rows = session.scalars(
            select(DreamEntry)
            .where(DreamEntry.user_id == user_id)
            .order_by(DreamEntry.created_at.desc())
            .limit(limit)
        ).all()
    output: list[dict] = []
    for row in rows:
        output.append(
            {
                "id": row.id,
                "user_id": row.user_id,
                "raw_text": row.raw_text,
                "transcript": row.transcript,
                "symbols": json.loads(row.symbols_json or "[]"),
                "mapped_arcana": json.loads(row.mapped_arcana_json or "[]"),
                "matches": json.loads(row.matches_json or "[]"),
                "interpretation": _load_interpretation(row.interpretation_json),
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
        )
    return output


def get_dream_entry(user_id: int, dream_id: int) -> dict | None:
    with session_scope() as session:
        row = session.scalar(
            select(DreamEntry).where(
                DreamEntry.id == dream_id,
                DreamEntry.user_id == user_id,
            )
        )
    if row is None:
        return None
    return {
        "id": row.id,
        "user_id": row.user_id,
        "raw_text": row.raw_text,
        "transcript": row.transcript,
        "symbols": json.loads(row.symbols_json or "[]"),
        "mapped_arcana": json.loads(row.mapped_arcana_json or "[]"),
        "matches": json.loads(row.matches_json or "[]"),
        "interpretation": _load_interpretation(row.interpretation_json),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
