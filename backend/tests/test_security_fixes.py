"""Regression tests cho các lỗi bảo mật đã fix (audit findings #1, #2, #4)."""

from __future__ import annotations

import importlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


def _bootstrap(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    db_path = tmp_path / "security_fixes.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)

    from src.db.init_db import reset_database_bootstrap_for_tests
    from src.db.session import reset_database_caches_for_tests
    from src.utils.rate_limit import reset_rate_limiter_for_tests

    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()
    reset_rate_limiter_for_tests()

    import src.main as main_module

    main_module = importlib.reload(main_module)

    class DummyPipeline:
        def run_pipeline(self, question, audio_path, image_paths, spread_type, random_draw=False):
            return {
                "question": question,
                "transcript": "",
                "spread_type": spread_type,
                "cards": [
                    {"name": "The Fool", "orientation": "upright", "position": "past", "confidence": 0.9},
                ],
                "rag_snippets": [],
                "final_answer": "Bài đọc mẫu bằng tiếng Việt.",
                "llm_model": "deterministic-fallback",
                "warnings": [],
            }

    monkeypatch.setattr(main_module, "_get_pipeline", lambda: DummyPipeline())
    return main_module


def _register_login(client, email: str, password: str) -> tuple[str, int]:
    reg = client.post("/api/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200, reg.text
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    return login.json()["access_token"], reg.json()["id"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_public_register_cannot_self_assign_admin(monkeypatch, tmp_path) -> None:
    """#1: đăng ký công khai không được tự gán role=admin."""
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        reg = client.post(
            "/api/auth/register",
            json={"email": "evil@example.com", "password": "password123", "role": "admin"},
        )
        assert reg.status_code == 200, reg.text
        assert reg.json()["role"] == "member"


def test_ask_ignores_client_supplied_user_id(monkeypatch, tmp_path) -> None:
    """#4: /api/ask bỏ qua user_id client; chỉ token mới gắn session vào user."""
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        token_a, uid_a = _register_login(client, "a@example.com", "password123")

        # Không token nhưng cố gán user_id=A → phải lưu ẩn danh, KHÔNG vào history của A.
        spoof = client.post(
            "/api/ask",
            json={"question": "spoof", "user_id": uid_a, "random_draw": True},
        )
        assert spoof.status_code == 200

        # Có token A → mới thuộc về A.
        owned = client.post(
            "/api/ask",
            headers=_headers(token_a),
            json={"question": "real", "random_draw": True},
        )
        assert owned.status_code == 200

        sessions = client.get("/api/sessions", headers=_headers(token_a))
        assert sessions.status_code == 200
        # Chỉ 1 session (cái có token); session spoof không bị gán cho A.
        assert sessions.json()["total"] == 1


def test_time_capsule_rejects_foreign_session(monkeypatch, tmp_path) -> None:
    """#2: không thể hydrate time capsule từ session của user khác (IDOR)."""
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        token_a, _ = _register_login(client, "a@example.com", "password123")
        token_b, _ = _register_login(client, "b@example.com", "password123")

        ask = client.post(
            "/api/ask",
            headers=_headers(token_a),
            json={"question": "secret love reading", "random_draw": True},
        )
        assert ask.status_code == 200
        session_id = ask.json()["session_id"]

        reveal_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

        # B cố tạo capsule hydrate từ session của A → bị từ chối.
        resp_b = client.post(
            "/api/time-capsules",
            headers=_headers(token_b),
            json={"title": "steal", "reveal_at": reveal_at, "session_id": session_id},
        )
        assert resp_b.status_code == 400

        # A tự tạo từ session của mình → OK.
        resp_a = client.post(
            "/api/time-capsules",
            headers=_headers(token_a),
            json={"title": "mine", "reveal_at": reveal_at, "session_id": session_id},
        )
        assert resp_a.status_code == 200
