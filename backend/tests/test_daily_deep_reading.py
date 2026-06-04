"""Tests cho Daily Card "Luận giải sâu hôm nay" (RAG + LLM + cache theo user/ngày/topic).

Chạy: pytest tests/test_daily_deep_reading.py -v  (từ thư mục backend/)

Mọi key LLM bị xoá + Ollama tắt + retriever stub ⇒ chuỗi generate_custom luôn đi
nhánh deterministic (offline, tất định), nên kiểm được đúng định dạng 4 mục, cache và
tính độc lập theo topic mà KHÔNG cần mạng/model nặng.
"""
from __future__ import annotations

import importlib

import pytest

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests
from src.utils.rate_limit import reset_rate_limiter_for_tests


class _StubRetriever:
    """Retriever giả: không có RAG index trong test → trả rỗng (luồng vẫn chạy)."""

    def retrieve(self, *args, **kwargs):
        return []


def _bootstrap(monkeypatch, tmp_path):
    pytest.importorskip("fastapi")
    db_path = tmp_path / "deep_reading.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("TIME_CAPSULE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("NOTIFICATION_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ANALYTICS_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    # Ép luận giải đi nhánh deterministic: xoá mọi key + tắt Ollama.
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


def _install_stub_pipeline(monkeypatch, main_module):
    """Thay _get_pipeline bằng stub nhẹ: ReadingGenerator thật (rẻ) + retriever rỗng.

    ReadingGenerator() chỉ đọc file prompt + env (không nạp model nặng). Vì mọi key đã
    bị xoá, generate_custom() trả thẳng bản dự phòng tất định.
    """
    from src.llm.generate import ReadingGenerator

    class _StubPipeline:
        def __init__(self):
            self.reader = ReadingGenerator()
            self.rag_retriever = _StubRetriever()

    stub = _StubPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: stub)
    return stub


def _register_login(client, email, password="secret123!"):
    reg = client.post("/api/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["id"]
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return user_id, login.json()["access_token"]


_REQUIRED_SECTIONS = (
    "### Tổng quan hôm nay",
    "### Một việc nhỏ nên làm hôm nay",
    "### Một điều nên tránh",
)


def test_deep_reading_creates_caches_and_is_idempotent(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "deep1@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Trước khi bấm: chưa có lá hôm nay (deep-reading sẽ tự tạo).
        today = client.get("/api/daily-card/today", headers=headers)
        assert today.status_code == 200
        assert today.json()["item"] is None

        first = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "work"})
        assert first.status_code == 200, first.text
        data = first.json()

        assert data["topic"] == "work"
        assert data["cached"] is False
        assert data["llm_model"] == "deterministic-fallback"
        assert isinstance(data["warnings"], list)
        assert data["card"] and data["card"]["card_name"]
        for section in _REQUIRED_SECTIONS:
            assert section in data["deep_reading"], f"thiếu mục: {section}"
        assert "Lời khuyên cho công việc" in data["deep_reading"]

        # Bấm lại cùng topic trong ngày → cached, KHÔNG sinh lại (nội dung y hệt).
        second = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "work"})
        assert second.status_code == 200, second.text
        cached = second.json()
        assert cached["cached"] is True
        assert cached["deep_reading"] == data["deep_reading"]
        assert cached["card"]["card_name"] == data["card"]["card_name"]


def test_deep_reading_each_topic_is_independent(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "deep2@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        work = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "work"})
        love = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "love"})
        assert work.status_code == 200 and love.status_code == 200

        assert work.json()["cached"] is False
        assert love.json()["cached"] is False  # topic khác → bản mới, không đụng cache work
        assert "Lời khuyên cho tình cảm" in love.json()["deep_reading"]
        # Cùng ngày nên cùng một lá bài (card chung), chỉ luận giải theo chủ đề là khác.
        assert work.json()["card"]["card_name"] == love.json()["card"]["card_name"]

        # love bấm lại → cached.
        love_again = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "love"})
        assert love_again.json()["cached"] is True


def test_deep_reading_defaults_to_general_when_no_body(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "deep3@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.post("/api/daily-card/deep-reading", headers=headers)
        assert res.status_code == 200, res.text
        assert res.json()["topic"] == "general"


def test_deep_reading_accepts_free_text_topic(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "deep4@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Topic giờ là TỰ DO (không còn enum cố định) → chủ đề tự do vẫn trả 200, echo lại topic.
        res = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "sức khỏe"})
        assert res.status_code == 200, res.text
        assert res.json()["topic"] == "sức khỏe"


def test_deep_reading_requires_auth(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        res = client.post("/api/daily-card/deep-reading", json={"topic": "work"})
        assert res.status_code in (401, 403), res.text


def test_deep_reading_does_not_break_existing_daily_card(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    _install_stub_pipeline(monkeypatch, main_module)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "deep5@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Tính năng cũ vẫn hoạt động: one-tap tạo lá hôm nay + streak.
        one_tap = client.get("/api/daily-card", headers=headers)
        assert one_tap.status_code == 200, one_tap.text
        card_name = one_tap.json()["item"]["card_name"]
        assert one_tap.json()["streak"]["current_streak"] >= 1

        # Deep reading dùng lại đúng lá đã rút, không tạo lá mới.
        deep = client.post("/api/daily-card/deep-reading", headers=headers, json={"topic": "study"})
        assert deep.status_code == 200, deep.text
        assert deep.json()["card"]["card_name"] == card_name

        # Sau deep reading, lá hôm nay vẫn nguyên vẹn.
        today = client.get("/api/daily-card/today", headers=headers)
        assert today.json()["item"]["card_name"] == card_name
