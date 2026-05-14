from __future__ import annotations

import importlib

import pytest


def _bootstrap_api(monkeypatch: pytest.MonkeyPatch, tmp_path):
    pytest.importorskip("fastapi")
    pytest.importorskip("starlette")

    from src.db.init_db import reset_database_bootstrap_for_tests
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
        session.add(user)
        session.flush()
        user_id = user.id

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
    return main_module, user_id


def test_advanced_endpoints_happy_path(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    main_module, user_id = _bootstrap_api(monkeypatch, tmp_path)

    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        ask_resp = client.post(
            "/api/ask",
            json={
                "question": "I need guidance",
                "user_id": user_id,
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
            json={"user_id": user_id, "message": "What should I do first?"},
        )
        assert followup_resp.status_code == 200
        followup_payload = followup_resp.json()
        assert "assistant_answer" in followup_payload
        assert "context_window" in followup_payload

        conversation_resp = client.get(f"/api/sessions/{session_id}/conversation", params={"limit": 20})
        assert conversation_resp.status_code == 200
        turns = conversation_resp.json()["turns"]
        assert len(turns) == 2
        assert turns[0]["role"] == "user"
        assert turns[1]["role"] == "assistant"

        rating_resp = client.post(
            f"/api/readings/{session_id}/rating",
            json={"score": 5, "note": "Accurate enough."},
        )
        assert rating_resp.status_code == 200
        assert rating_resp.json()["status"] == "rated"

        pending_resp = client.get(f"/api/users/{user_id}/pending_ratings")
        assert pending_resp.status_code == 200
        assert pending_resp.json()["items"] == []


def test_followup_not_found_and_rating_validation(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    main_module, _user_id = _bootstrap_api(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        followup_resp = client.post(
            "/api/sessions/9999/followup",
            json={"message": "hello"},
        )
        assert followup_resp.status_code == 404

        rating_resp = client.post(
            "/api/readings/9999/rating",
            json={"score": 9, "note": "bad payload"},
        )
        assert rating_resp.status_code == 422
