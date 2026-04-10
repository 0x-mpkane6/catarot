from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select

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
        rows = session.scalars(
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index.asc())
        ).all()

    if limit > 0:
        rows = rows[-limit:]
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


def _next_turn_index(session_id: int) -> int:
    with session_scope() as session:
        max_turn = session.scalar(
            select(func.max(ConversationTurn.turn_index)).where(ConversationTurn.session_id == session_id)
        )
    if max_turn is None:
        return 0
    return int(max_turn) + 1


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

    next_idx = _next_turn_index(session_id)
    user_turn = ConversationTurn(
        session_id=session_id,
        role="user",
        content=clean_message,
        turn_index=next_idx,
    )

    with session_scope() as session:
        session.add(user_turn)
        session.flush()

    all_turn_rows: list[ConversationTurn]
    with session_scope() as session:
        all_turn_rows = session.scalars(
            select(ConversationTurn)
            .where(ConversationTurn.session_id == session_id)
            .order_by(ConversationTurn.turn_index.asc())
        ).all()

    context_window = build_context_window(all_turn_rows, max_recent=MAX_RECENT_TURNS)
    reader = _get_followup_generator()
    assistant_answer, warnings = reader.generate_followup(
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

    assistant_idx = next_idx + 1
    assistant_turn = ConversationTurn(
        session_id=session_id,
        role="assistant",
        content=assistant_answer,
        turn_index=assistant_idx,
    )
    with session_scope() as session:
        session.add(assistant_turn)
        session.flush()

    return {
        "session_id": session_id,
        "assistant_answer": assistant_answer,
        "llm_model": reader.last_used_model,
        "turn_index": assistant_idx,
        "context_window": {
            "total_turns": context_window["total_turns"],
            "recent_turns_used": context_window["recent_turns_used"],
            "summarized_turns": context_window["summarized_turns"],
        },
        "warnings": warnings,
    }
