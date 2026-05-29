from __future__ import annotations

import importlib

import pytest


def _bootstrap_api(monkeypatch: pytest.MonkeyPatch, tmp_path):
    pytest.importorskip("fastapi")
    pytest.importorskip("starlette")

    from src.db.init_db import reset_database_bootstrap_for_tests
    from src.auth.security import create_access_token
    from src.db.models import User
    from src.db import initialize_database_if_needed
    from src.db.session import reset_database_caches_for_tests, session_scope

    db_path = tmp_path / "advanced_api.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")

    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()

    import src.main as main_module
    main_module = importlib.reload(main_module)
    initialize_database_if_needed(seed_reference_data=False)

    import src.advanced.conversation as conversation_module
    conversation_module._FOLLOWUP_GENERATOR = None

    with session_scope() as session:
        user = User(email="api-user@example.com", password_hash="hash", role="member")
        other_user = User(email="other-api-user@example.com", password_hash="hash", role="member")
        admin_user = User(email="admin-api-user@example.com", password_hash="hash", role="admin")
        session.add(user)
        session.add(other_user)
        session.add(admin_user)
        session.flush()
        user_id = user.id
        other_user_id = other_user.id
        admin_user_id = admin_user.id

    class DummyPipeline:
        def run_pipeline(
            self,
            question: str,
            audio_path: str | None,
            image_paths: list[str] | None,
            spread_type: str,
            random_draw: bool = False,
        ) -> dict:
            _ = audio_path
            _ = image_paths
            _ = random_draw
            return {
                "question": question,
                "transcript": "",
                "spread_type": spread_type,
                "cards": [
                    {
                        "name": "The Fool",
                        "orientation": "upright",
                        "position": "past",
                        "confidence": 0.9,
                    }
                ],
                "rag_snippets": [{"source_id": "x", "text": "sample", "metadata": {"card_name": "The Fool"}}],
                "final_answer": "Initial reading response.",
                "llm_model": "deterministic-fallback",
                "warnings": [],
            }

    dummy = DummyPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: dummy)
    return {
        "main_module": main_module,
        "user_id": user_id,
        "other_user_id": other_user_id,
        "headers": {"Authorization": f"Bearer {create_access_token(user_id=user_id, role='member')}"},
        "other_headers": {"Authorization": f"Bearer {create_access_token(user_id=other_user_id, role='member')}"},
        "admin_headers": {"Authorization": f"Bearer {create_access_token(user_id=admin_user_id, role='admin')}"},
    }


def test_advanced_endpoints_happy_path(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    ctx = _bootstrap_api(monkeypatch, tmp_path)
    main_module = ctx["main_module"]
    user_id = ctx["user_id"]
    headers = ctx["headers"]

    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        ask_resp = client.post(
            "/api/ask",
            headers=headers,
            json={
                "question": "I need guidance",
                "spread_type": "three",
                "random_draw": True,
                "rating_reminder_days": 14,
            },
        )
        assert ask_resp.status_code == 200
        ask_payload = ask_resp.json()
        assert "session_id" in ask_payload
        session_id = ask_payload["session_id"]

        spread_resp = client.post("/api/spread/recommend", json={"question": "I need to choose now"})
        assert spread_resp.status_code == 200
        assert "recommended_spread" in spread_resp.json()

        suggestions_resp = client.get(
            "/api/question_suggestions",
            params={"user_id": user_id, "limit": 3},
        )
        assert suggestions_resp.status_code == 200
        suggestions = suggestions_resp.json()["suggestions"]
        assert len(suggestions) == 3

        followup_resp = client.post(
            f"/api/sessions/{session_id}/followup",
            headers=headers,
            json={"user_id": user_id, "message": "What should I do first?"},
        )
        assert followup_resp.status_code == 200
        followup_payload = followup_resp.json()
        assert "assistant_answer" in followup_payload
        assert "context_window" in followup_payload

        conversation_resp = client.get(
            f"/api/sessions/{session_id}/conversation",
            headers=headers,
            params={"limit": 20},
        )
        assert conversation_resp.status_code == 200
        turns = conversation_resp.json()["turns"]
        assert len(turns) == 2
        assert turns[0]["role"] == "user"
        assert turns[1]["role"] == "assistant"

        rating_resp = client.post(
            f"/api/readings/{session_id}/rating",
            headers=headers,
            json={"score": 5, "note": "Accurate enough."},
        )
        assert rating_resp.status_code == 200
        assert rating_resp.json()["status"] == "rated"

        pending_resp = client.get(f"/api/users/{user_id}/pending_ratings", headers=headers)
        assert pending_resp.status_code == 200
        assert pending_resp.json()["items"] == []


def test_followup_not_found_and_rating_validation(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    ctx = _bootstrap_api(monkeypatch, tmp_path)
    main_module = ctx["main_module"]
    headers = ctx["headers"]
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        followup_resp = client.post(
            "/api/sessions/9999/followup",
            headers=headers,
            json={"message": "hello"},
        )
        assert followup_resp.status_code == 404

        rating_resp = client.post(
            "/api/readings/9999/rating",
            headers=headers,
            json={"score": 9, "note": "bad payload"},
        )
        assert rating_resp.status_code == 422


def test_private_session_endpoints_require_auth(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    ctx = _bootstrap_api(monkeypatch, tmp_path)
    main_module = ctx["main_module"]
    user_id = ctx["user_id"]

    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        ask_resp = client.post(
            "/api/ask",
            headers=ctx["headers"],
            json={"question": "private reading", "random_draw": True},
        )
        session_id = ask_resp.json()["session_id"]

        assert client.post(
            f"/api/sessions/{session_id}/followup",
            json={"message": "hello"},
        ).status_code == 401
        assert client.get(f"/api/sessions/{session_id}/conversation").status_code == 401
        assert client.post(
            f"/api/readings/{session_id}/rating",
            json={"score": 5},
        ).status_code == 401
        assert client.get(f"/api/users/{user_id}/pending_ratings").status_code == 401


def test_private_session_endpoints_reject_other_user(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    ctx = _bootstrap_api(monkeypatch, tmp_path)
    main_module = ctx["main_module"]
    user_id = ctx["user_id"]
    other_headers = ctx["other_headers"]
    admin_headers = ctx["admin_headers"]

    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        ask_resp = client.post(
            "/api/ask",
            headers=ctx["headers"],
            json={"question": "owner reading", "random_draw": True},
        )
        session_id = ask_resp.json()["session_id"]

        followup_resp = client.post(
            f"/api/sessions/{session_id}/followup",
            headers=other_headers,
            json={"message": "hello"},
        )
        assert followup_resp.status_code == 404

        conversation_resp = client.get(
            f"/api/sessions/{session_id}/conversation",
            headers=other_headers,
        )
        assert conversation_resp.status_code == 404

        rating_resp = client.post(
            f"/api/readings/{session_id}/rating",
            headers=other_headers,
            json={"score": 5},
        )
        assert rating_resp.status_code == 404

        pending_other = client.get(f"/api/users/{user_id}/pending_ratings", headers=other_headers)
        assert pending_other.status_code == 403

        pending_admin = client.get(f"/api/users/{user_id}/pending_ratings", headers=admin_headers)
        assert pending_admin.status_code == 200
