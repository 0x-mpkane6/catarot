from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from src.db.models import ConversationTurn, Reading, ReadingSession, RecognizedCard, TarotCard
from src.db.session import session_scope
from src.llm.generate import ReadingGenerator

MAX_RECENT_TURNS = 8

_FOLLOWUP_GENERATOR: ReadingGenerator | None = None


@dataclass
class SessionReadingContext:
    question: str
    transcript: str | None
    emotion_state: str | None
    final_answer: str
    cards: list[dict[str, Any]]


def _get_followup_generator() -> ReadingGenerator:
    global _FOLLOWUP_GENERATOR
    if _FOLLOWUP_GENERATOR is None:
        _FOLLOWUP_GENERATOR = ReadingGenerator()
    return _FOLLOWUP_GENERATOR


def deterministic_turn_summary(turns: list[ConversationTurn]) -> str:
    if not turns:
        return ""
    lines: list[str] = []
    for row in turns:
        snippet = " ".join((row.content or "").split())
        if len(snippet) > 120:
            snippet = f"{snippet[:117]}..."
        lines.append(f"[{row.role}] {snippet}")
    return " | ".join(lines)


def build_context_window(turns: list[ConversationTurn], max_recent: int = MAX_RECENT_TURNS) -> dict[str, Any]:
    if len(turns) <= max_recent:
        recent_rows = turns
        older_rows: list[ConversationTurn] = []
    else:
        older_rows = turns[:-max_recent]
        recent_rows = turns[-max_recent:]

    return {
        "summary": deterministic_turn_summary(older_rows),
        "recent_messages": [{"role": row.role, "content": row.content} for row in recent_rows],
        "total_turns": len(turns),
        "recent_turns_used": len(recent_rows),
        "summarized_turns": len(older_rows),
    }


def _session_exists_for_user(session_id: int, user_id: int | None) -> bool:
    with session_scope() as session:
        where_clause = [ReadingSession.id == session_id]
        if user_id is not None:
            where_clause.append(ReadingSession.user_id == user_id)
        row = session.scalar(select(ReadingSession.id).where(*where_clause))
    return row is not None


def load_session_reading_context(session_id: int) -> SessionReadingContext | None:
    with session_scope() as session:
        session_row = session.scalar(select(ReadingSession).where(ReadingSession.id == session_id))
        if session_row is None:
            return None

        reading_row = session.scalar(select(Reading).where(Reading.session_id == session_id))
        card_rows = session.execute(
            select(
                TarotCard.name,
                RecognizedCard.orientation,
                RecognizedCard.position_label,
                RecognizedCard.order_index,
            )
            .join(RecognizedCard, RecognizedCard.card_id == TarotCard.id)
            .where(RecognizedCard.session_id == session_id)
            .order_by(RecognizedCard.order_index.asc())
        ).all()

    cards = [
        {
            "name": row[0],
            "orientation": row[1],
            "position": row[2],
            "order_index": row[3],
        }
        for row in card_rows
    ]
    return SessionReadingContext(
        question=session_row.question_text,
        transcript=session_row.audio_transcript,
        emotion_state=session_row.emotion_state,
        final_answer=(reading_row.generated_text if reading_row else ""),
        cards=cards,
    )


def get_conversation_turns(session_id: int, limit: int = 20) -> list[dict[str, Any]]:
    with session_scope() as session:
        if limit > 0:
            # Đẩy LIMIT xuống SQL: lấy `limit` turn mới nhất (desc) rồi đảo lại thứ tự
            # tăng dần. Tránh tải toàn bộ lịch sử vào RAM rồi mới cắt (hội thoại dài).
            rows = list(
                session.scalars(
                    select(ConversationTurn)
                    .where(ConversationTurn.session_id == session_id)
                    .order_by(ConversationTurn.turn_index.desc())
                    .limit(limit)
                ).all()
            )
            rows.reverse()
        else:
            rows = session.scalars(
                select(ConversationTurn)
                .where(ConversationTurn.session_id == session_id)
                .order_by(ConversationTurn.turn_index.asc())
            ).all()

    return [
        {
            "id": row.id,
            "session_id": row.session_id,
            "role": row.role,
            "content": row.content,
            "turn_index": row.turn_index,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def add_followup_turn(
    *,
    session_id: int,
    message: str,
    user_id: int | None = None,
) -> dict[str, Any]:
    clean_message = (message or "").strip()
    if not clean_message:
        raise ValueError("message cannot be empty")

    if not _session_exists_for_user(session_id, user_id):
        raise ValueError("reading session not found")

    reading_context = load_session_reading_context(session_id)
    if reading_context is None:
        raise ValueError("reading session not found")

    # Đọc lịch sử ĐÃ lưu (chưa gồm lượt hỏi mới này).
    with session_scope() as session:
        existing_rows = session.scalars(
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index.asc())
        ).all()

    # Lượt hỏi của user được dựng TẠM trong bộ nhớ chỉ để đưa vào context window (CHƯA commit,
    # nên KHÔNG cần turn_index — build_context_window chỉ đọc role/content). Nếu LLM ném lỗi bất
    # ngờ thì DB không bị bỏ lại user-turn mồ côi (không có câu trả lời).
    pending_user_turn = ConversationTurn(
        session_id=session_id,
        role="user",
        content=clean_message,
    )
    context_window = build_context_window(
        [*existing_rows, pending_user_turn], max_recent=MAX_RECENT_TURNS
    )
    reader = _get_followup_generator()
    assistant_answer, llm_model, warnings = reader.generate_followup(
        session_context={
            "question": reading_context.question,
            "transcript": reading_context.transcript,
            "emotion_state": reading_context.emotion_state,
            "final_answer": reading_context.final_answer,
            "cards": reading_context.cards,
        },
        summary=context_window["summary"],
        recent_messages=context_window["recent_messages"],
        user_message=clean_message,
    )

    # Ghi user-turn + assistant-turn trong CÙNG transaction; tính turn_index NGAY trong
    # transaction + thử lại khi đụng UNIQUE(session_id, turn_index) để 2 follow-up song song
    # không mất lượt (LLM đã chạy xong → chỉ thử lại bước ghi DB, KHÔNG gọi lại model).
    assistant_idx = 0
    for attempt in range(3):
        try:
            with session_scope() as session:
                current_max = session.scalar(
                    select(func.max(ConversationTurn.turn_index)).where(
                        ConversationTurn.session_id == session_id
                    )
                )
                base_idx = 0 if current_max is None else int(current_max) + 1
                user_turn = ConversationTurn(
                    session_id=session_id, role="user", content=clean_message, turn_index=base_idx
                )
                assistant_turn = ConversationTurn(
                    session_id=session_id,
                    role="assistant",
                    content=assistant_answer,
                    turn_index=base_idx + 1,
                )
                session.add_all([user_turn, assistant_turn])
                session.flush()
            assistant_idx = base_idx + 1
            break
        except IntegrityError as exc:
            # Đua 2 follow-up cùng session → trùng turn_index. Thử lại tính lại index từ max
            # mới; sau 3 lần vẫn đụng thì trả lỗi sạch để client thử lại.
            if attempt == 2:
                raise ValueError("conversation turn conflict, please retry") from exc
            continue

    return {
        "session_id": session_id,
        "assistant_answer": assistant_answer,
        "llm_model": llm_model,
        "turn_index": assistant_idx,
        "context_window": {
            "total_turns": context_window["total_turns"],
            "recent_turns_used": context_window["recent_turns_used"],
            "summarized_turns": context_window["summarized_turns"],
        },
        "warnings": warnings,
    }
