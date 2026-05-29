from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket
from sqlalchemy import and_, select

from src.db.models import DuoCard, DuoParticipant, DuoReading, DuoSession
from src.db.session import session_scope
from src.llm.generate import ReadingGenerator


class DuoWsManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, duo_session_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(duo_session_id, []).append(websocket)

    async def disconnect(self, duo_session_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            rows = self._connections.get(duo_session_id, [])
            if websocket in rows:
                rows.remove(websocket)
            if not rows and duo_session_id in self._connections:
                del self._connections[duo_session_id]

    async def broadcast(self, duo_session_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            rows = list(self._connections.get(duo_session_id, []))
        dead: list[WebSocket] = []
        for ws in rows:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(duo_session_id, ws)


DUO_WS_MANAGER = DuoWsManager()


def _invite_code() -> str:
    return secrets.token_hex(4).upper()


def _duo_payload(row: DuoSession) -> dict[str, Any]:
    participants = [
        {
            "id": item.id,
            "user_id": item.user_id,
            "slot_label": item.slot_label,
            "joined_at": item.joined_at.isoformat() if item.joined_at else None,
        }
        for item in row.participants
    ]
    cards = [
        {
            "id": item.id,
            "participant_id": item.participant_id,
            "card_name": item.card_name,
            "orientation": item.orientation,
            "confidence": item.confidence,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in row.cards
    ]
    return {
        "id": row.id,
        "invite_code": row.invite_code,
        "owner_user_id": row.owner_user_id,
        "status": row.status,
        "participants": participants,
        "cards": cards,
        "reading": (
            {
                "generated_text": row.reading.generated_text,
                "llm_model": row.reading.llm_model,
            }
            if row.reading
            else None
        ),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _load_duo_session(session_id: int) -> DuoSession | None:
    with session_scope() as session:
        row = session.scalar(select(DuoSession).where(DuoSession.id == session_id))
        if row is None:
            return None
        row.participants
        row.cards
        row.reading
        return row


def create_duo_session(owner_user_id: int) -> dict[str, Any]:
    with session_scope() as session:
        row = DuoSession(
            invite_code=_invite_code(),
            owner_user_id=owner_user_id,
            status="waiting_partner",
        )
        session.add(row)
        session.flush()
        session.add(
            DuoParticipant(
                duo_session_id=row.id,
                user_id=owner_user_id,
                slot_label="A",
            )
        )
        session.flush()
        created_id = row.id
    reloaded = _load_duo_session(created_id)
    assert reloaded is not None
    return _duo_payload(reloaded)


def join_duo_session(duo_session_id: int, user_id: int) -> dict[str, Any]:
    with session_scope() as session:
        row = session.scalar(select(DuoSession).where(DuoSession.id == duo_session_id))
        if row is None:
            raise ValueError("duo session not found")

        existing = session.scalar(
            select(DuoParticipant).where(
                DuoParticipant.duo_session_id == duo_session_id,
                DuoParticipant.user_id == user_id,
            )
        )
        if existing is None:
            slots = session.scalars(
                select(DuoParticipant.slot_label).where(DuoParticipant.duo_session_id == duo_session_id)
            ).all()
            if "B" in slots:
                raise ValueError("duo session already has 2 participants")
            session.add(
                DuoParticipant(
                    duo_session_id=duo_session_id,
                    user_id=user_id,
                    slot_label="B",
                )
            )
            # Only advance status when a *new* participant actually joins.
            # If the owner calls join on their own session, the status must
            # remain "waiting_partner" until a real second player arrives.
            row.status = "waiting_cards"
            row.updated_at = datetime.now(timezone.utc)
        session.flush()

    reloaded = _load_duo_session(duo_session_id)
    assert reloaded is not None
    return _duo_payload(reloaded)


def _generate_duo_reading(cards: list[DuoCard]) -> tuple[str, str]:
    reader = ReadingGenerator()
    card_lines = [f"- {row.card_name} ({row.orientation})" for row in cards]
    system_prompt = (
        "Bạn là trợ lý tarot về mối quan hệ. LUÔN trả lời bằng tiếng Việt có dấu, "
        "văn phong ấm áp, gần gũi. Hãy gộp hai lá bài thành một luận giải tương hợp "
        "ngắn gọn, súc tích. Giữ nguyên tên lá bài tiếng Anh."
    )
    user_prompt = (
        "HAI_LA_BAI:\n"
        + "\n".join(card_lines)
        + "\nHãy nêu điểm hòa hợp, điểm dễ va chạm và một lời khuyên thực tế cho cả hai."
    )

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

    fallback = (
        f"Sự kết hợp giữa {cards[0].card_name} và {cards[1].card_name} cho thấy một mối quan hệ "
        "nhiều sắc thái. Hãy thẳng thắn nhìn nhận khác biệt và cùng chọn một hành động chung trong tuần này."
    )
    return fallback, "deterministic-fallback"


def submit_duo_card(
    *,
    duo_session_id: int,
    user_id: int,
    image_path: str,
    predictor,
) -> dict[str, Any]:
    prediction = predictor.predict(image_path)
    card_name = str(prediction.get("name") or "Unknown Card")
    orientation = str(prediction.get("orientation") or "upright")
    confidence = float(prediction.get("confidence", 0.0))

    with session_scope() as session:
        duo = session.scalar(select(DuoSession).where(DuoSession.id == duo_session_id))
        if duo is None:
            raise ValueError("duo session not found")

        participant = session.scalar(
            select(DuoParticipant).where(
                DuoParticipant.duo_session_id == duo_session_id,
                DuoParticipant.user_id == user_id,
            )
        )
        if participant is None:
            raise ValueError("user is not in this duo session")

        existing_card = session.scalar(
            select(DuoCard).where(
                DuoCard.duo_session_id == duo_session_id,
                DuoCard.participant_id == participant.id,
            )
        )
        if existing_card is not None:
            raise ValueError("participant already uploaded a card")

        session.add(
            DuoCard(
                duo_session_id=duo_session_id,
                participant_id=participant.id,
                card_name=card_name,
                orientation=orientation,
                confidence=confidence,
                image_path=image_path,
            )
        )
        session.flush()

        cards = session.scalars(select(DuoCard).where(DuoCard.duo_session_id == duo_session_id)).all()
        participants = session.scalars(
            select(DuoParticipant).where(DuoParticipant.duo_session_id == duo_session_id)
        ).all()
        if len(cards) >= 2 and len(participants) >= 2:
            duo.status = "generating"
            duo.updated_at = datetime.now(timezone.utc)
            # Capture card data before closing the session so the LLM call
            # happens *outside* the DB transaction (avoids holding the write
            # lock for the full LLM latency of up to ~120 s).
            cards_for_reading = [(c.card_name, c.orientation) for c in cards[:2]]
            generate_reading = True
        else:
            duo.status = "waiting_cards"
            duo.updated_at = datetime.now(timezone.utc)
            cards_for_reading = []
            generate_reading = False
        session.flush()

    # Phase 2: LLM generation is intentionally outside any session_scope so
    # the database connection is not held during the potentially slow call.
    if generate_reading:
        # Build lightweight DuoCard-like objects to pass into the generator.
        class _CardProxy:
            def __init__(self, name: str, orientation: str) -> None:
                self.card_name = name
                self.orientation = orientation

        proxy_cards = [_CardProxy(n, o) for n, o in cards_for_reading]
        narrative, llm_model = _generate_duo_reading(proxy_cards)  # type: ignore[arg-type]

        with session_scope() as session:
            duo = session.scalar(select(DuoSession).where(DuoSession.id == duo_session_id))
            if duo is not None:
                duo.status = "completed"
                duo.updated_at = datetime.now(timezone.utc)
            existing_reading = session.scalar(
                select(DuoReading).where(DuoReading.duo_session_id == duo_session_id)
            )
            if existing_reading is None:
                session.add(
                    DuoReading(
                        duo_session_id=duo_session_id,
                        generated_text=narrative,
                        llm_model=llm_model,
                    )
                )
            else:
                existing_reading.generated_text = narrative
                existing_reading.llm_model = llm_model

    reloaded = _load_duo_session(duo_session_id)
    assert reloaded is not None
    return _duo_payload(reloaded)


def get_duo_session(duo_session_id: int, user_id: int | None = None) -> dict[str, Any]:
    row = _load_duo_session(duo_session_id)
    if row is None:
        raise ValueError("duo session not found")
    if user_id is not None:
        allowed_ids = [item.user_id for item in row.participants if item.user_id is not None]
        if user_id not in allowed_ids and row.owner_user_id != user_id:
            raise ValueError("not allowed to access this duo session")
    return _duo_payload(row)


def join_duo_by_invite(invite_code: str, user_id: int) -> dict[str, Any]:
    with session_scope() as session:
        row = session.scalar(
            select(DuoSession).where(DuoSession.invite_code == (invite_code or "").strip().upper())
        )
        if row is None:
            raise ValueError("duo invite not found")
        duo_id = row.id
    return join_duo_session(duo_session_id=duo_id, user_id=user_id)

