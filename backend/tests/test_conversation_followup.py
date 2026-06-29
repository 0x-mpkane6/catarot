"""Regression test cho add_followup_turn: KHÔNG để lại user-turn mồ côi khi LLM lỗi.

Trước đây user-turn được commit ở một transaction riêng TRƯỚC khi gọi LLM; nếu LLM ném
lỗi bất ngờ thì DB còn lại câu hỏi không có câu trả lời (lịch sử lẻ). Bản vá gom cả
user-turn + assistant-turn vào CÙNG 1 transaction, chỉ ghi sau khi LLM sinh xong.

Chạy: pytest tests/test_conversation_followup.py -v  (từ thư mục backend/)
"""
from __future__ import annotations

import pytest

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests


def _bootstrap(monkeypatch, tmp_path):
    db_path = tmp_path / "followup.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()
    from src.db import initialize_database_if_needed

    initialize_database_if_needed(seed_reference_data=False)


def _seed_session(generated_text: str = "Đây là luận giải gốc.") -> int:
    from src.db.models import Reading, ReadingSession
    from src.db.session import session_scope

    with session_scope() as session:
        reading_session = ReadingSession(
            question_text="Tôi nên làm gì tuần này?", status="completed"
        )
        session.add(reading_session)
        session.flush()
        session_id = reading_session.id
        session.add(Reading(session_id=session_id, generated_text=generated_text))
    return session_id


def _count_turns(session_id: int) -> int:
    from sqlalchemy import func, select

    from src.db.models import ConversationTurn
    from src.db.session import session_scope

    with session_scope() as session:
        return (
            session.scalar(
                select(func.count())
                .select_from(ConversationTurn)
                .where(ConversationTurn.session_id == session_id)
            )
            or 0
        )


class _RaisingGenerator:
    """Stub mô phỏng LLM ném lỗi bất ngờ (json hỏng / network ngoài graceful degradation)."""

    last_used_model = None

    def generate_followup(self, **_kwargs):
        raise RuntimeError("LLM bùng nổ bất ngờ")


class _OkGenerator:
    last_used_model = "stub-model"

    def generate_followup(self, **_kwargs):
        # Hợp đồng mới: trả (text, model_name, warnings) — caller dùng model_name trả về
        # thay vì đọc self.last_used_model (singleton dùng chung, tránh đọc nhầm của request khác).
        return "Câu trả lời tiếp theo.", "stub-model", []


def test_followup_does_not_persist_user_turn_when_llm_raises(monkeypatch, tmp_path):
    # Arrange
    _bootstrap(monkeypatch, tmp_path)
    import src.advanced.conversation as conv

    monkeypatch.setattr(conv, "_FOLLOWUP_GENERATOR", _RaisingGenerator())
    session_id = _seed_session()

    # Act
    with pytest.raises(RuntimeError):
        conv.add_followup_turn(session_id=session_id, message="Vậy còn chuyện tình cảm?")

    # Assert — BẤT BIẾN: LLM lỗi ⇒ không turn nào được ghi (không có user-turn mồ côi).
    assert _count_turns(session_id) == 0


def test_followup_persists_both_turns_atomically_on_success(monkeypatch, tmp_path):
    # Arrange
    _bootstrap(monkeypatch, tmp_path)
    import src.advanced.conversation as conv

    monkeypatch.setattr(conv, "_FOLLOWUP_GENERATOR", _OkGenerator())
    session_id = _seed_session()

    # Act
    result = conv.add_followup_turn(session_id=session_id, message="Vậy còn chuyện tình cảm?")

    # Assert — cả user-turn + assistant-turn được ghi đúng thứ tự index 0,1.
    assert result["assistant_answer"] == "Câu trả lời tiếp theo."
    assert result["llm_model"] == "stub-model"
    assert _count_turns(session_id) == 2
    turns = conv.get_conversation_turns(session_id, limit=10)
    assert [turn["role"] for turn in turns] == ["user", "assistant"]
    assert [turn["turn_index"] for turn in turns] == [0, 1]
