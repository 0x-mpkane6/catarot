"""Tests cho phần nâng cấp Dream Journal: diễn giải tổng hợp + liên hệ trải bài + phản tư.

Chạy: pytest tests/test_dream_interpretation.py -v  (từ thư mục backend/)

Mọi key LLM bị xoá + Ollama tắt ⇒ chuỗi sinh diễn giải đi nhánh deterministic (offline,
tất định). Vẫn kiểm được đúng schema 6 phần, null-safety, chống bịa session_id, và việc
KHÔNG phá các phần cũ (symbols / mapped_arcana / matches).
"""
from __future__ import annotations

import importlib

import pytest

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests
from src.utils.rate_limit import reset_rate_limiter_for_tests

SAMPLE_DREAM = (
    "Tối qua tôi mơ thấy mình đi trong một khu rừng tối. Có một con mèo đen đi theo tôi. "
    "Sau đó tôi thấy một cánh cửa phát sáng nhưng tôi chưa dám mở."
)

_INTERP_KEYS = {
    "summary_interpretation",
    "main_theme",
    "emotional_tone",
    "recent_reading_connections",
    "reflection_questions",
    "suggested_action",
    "llm_model",
    "source",
    "warnings",
}


def _bootstrap(monkeypatch, tmp_path):
    pytest.importorskip("fastapi")
    db_path = tmp_path / "dream_interp.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("TIME_CAPSULE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("NOTIFICATION_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ANALYTICS_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    # Ép cả symbol-mapping lẫn diễn giải đi nhánh deterministic: xoá mọi key + tắt Ollama.
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEYS", "")
    monkeypatch.setenv("GROQ_API_KEY", "")

    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()
    reset_rate_limiter_for_tests()

    import src.main as main_module
    main_module = importlib.reload(main_module)

    from src.db import initialize_database_if_needed
    initialize_database_if_needed(seed_reference_data=True)
    return main_module


def _register_login(client, email, password="secret123!"):
    reg = client.post("/api/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["id"]
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return user_id, login.json()["access_token"]


def _seed_reading_session(user_id, question):
    """Chèn trực tiếp một ReadingSession gần đây cho user (để test liên hệ 7 ngày)."""
    from src.db.models import ReadingSession
    from src.db.session import session_scope

    with session_scope() as session:
        row = ReadingSession(user_id=user_id, question_text=question, status="completed")
        session.add(row)
        session.flush()
        return row.id


def test_create_dream_has_interpretation_and_keeps_old_sections(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "dream1@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/dreams", headers=headers, data={"raw_text": SAMPLE_DREAM})
        assert res.status_code == 200, res.text
        d = res.json()

        # Chức năng CŨ vẫn còn nguyên.
        assert d["raw_text"] == SAMPLE_DREAM
        assert isinstance(d["symbols"], list)
        assert isinstance(d["mapped_arcana"], list)
        assert isinstance(d["matches"], list)

        # Phần MỚI: diễn giải tổng hợp đủ 6 mục + metadata.
        interp = d["interpretation"]
        assert interp is not None
        assert _INTERP_KEYS.issubset(interp.keys())
        assert interp["summary_interpretation"].strip()
        assert interp["main_theme"].strip()
        assert interp["emotional_tone"].strip()
        assert interp["suggested_action"].strip()
        assert isinstance(interp["reflection_questions"], list)
        assert len(interp["reflection_questions"]) >= 2
        assert isinstance(interp["recent_reading_connections"], list)
        # LLM tắt trong test → bản dự phòng tất định + có cảnh báo.
        assert interp["source"] == "deterministic-fallback"
        assert interp["llm_model"] == "deterministic-fallback"
        assert isinstance(interp["warnings"], list) and interp["warnings"]


def test_no_recent_readings_gives_empty_connections(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "dream2@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/dreams", headers=headers, data={"raw_text": SAMPLE_DREAM})
        assert res.status_code == 200, res.text
        assert res.json()["interpretation"]["recent_reading_connections"] == []


def test_with_recent_readings_produces_connections(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        user_id, token = _register_login(client, "dream3@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        _seed_reading_session(user_id, "Chuyện công việc của tôi sắp tới sẽ thế nào?")

        res = client.post("/api/dreams", headers=headers, data={"raw_text": SAMPLE_DREAM})
        assert res.status_code == 200, res.text
        connections = res.json()["interpretation"]["recent_reading_connections"]
        assert len(connections) >= 1
        first = connections[0]
        assert isinstance(first["session_id"], int) and first["session_id"] > 0
        assert first["connection"].strip()


def test_list_and_detail_include_interpretation(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "dream4@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post("/api/dreams", headers=headers, data={"raw_text": SAMPLE_DREAM})
        dream_id = created.json()["id"]

        listed = client.get("/api/dreams", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["items"][0]["interpretation"]["summary_interpretation"].strip()

        detail = client.get(f"/api/dreams/{dream_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["interpretation"]["summary_interpretation"].strip()


def test_dream_create_requires_text_or_audio(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "dream5@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = client.post("/api/dreams", headers=headers, data={"raw_text": "   "})
        assert res.status_code == 400, res.text


def test_dream_requires_auth(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        res = client.post("/api/dreams", data={"raw_text": SAMPLE_DREAM})
        assert res.status_code in (401, 403), res.text


# ---- Unit tests (không cần app/DB) cho parse JSON + chống bịa session_id ----


def test_parse_json_object_strips_fences_and_prose():
    from src.advanced.dream_journal import _parse_json_object

    assert _parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert _parse_json_object('Đây là kết quả: {"a": 1} hết.') == {"a": 1}
    assert _parse_json_object("không có json") is None
    assert _parse_json_object("") is None


def test_coerce_interpretation_drops_fake_session_ids():
    from src.advanced.dream_journal import _coerce_interpretation

    recent = [{"session_id": 5, "question": "Câu hỏi 5"}]
    parsed = {
        "summary_interpretation": "Một diễn giải hợp lệ.",
        "main_theme": "thử nghiệm",
        "emotional_tone": "tò mò",
        "recent_reading_connections": [
            {"session_id": 5, "connection": "liên hệ thật"},
            {"session_id": 999, "connection": "liên hệ bịa"},
        ],
        "reflection_questions": ["Câu 1?", "Câu 2?"],
        "suggested_action": "Làm một việc nhỏ.",
    }
    out = _coerce_interpretation(parsed, recent)
    assert out is not None
    ids = [c["session_id"] for c in out["recent_reading_connections"]]
    assert ids == [5]  # 999 (không có thật) bị loại


def test_coerce_interpretation_rejects_empty_summary():
    from src.advanced.dream_journal import _coerce_interpretation

    assert _coerce_interpretation({"summary_interpretation": "  "}, []) is None
