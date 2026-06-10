"""Tests for unique features: Daily Card + Streak, Time Capsule, Affirmations."""
from __future__ import annotations

import importlib
from datetime import date, datetime, timedelta, timezone

import pytest

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests
from src.utils.rate_limit import reset_rate_limiter_for_tests


def _bootstrap(monkeypatch, tmp_path):
    pytest.importorskip("fastapi")
    db_path = tmp_path / "unique_features.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("TIME_CAPSULE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")

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


# ==== Affirmations =================================================


def test_affirmation_is_deterministic_per_card_per_day():
    from src.advanced.affirmations import generate_affirmation

    today = date(2026, 4, 28)
    a = generate_affirmation(card_name="The Sun", orientation="upright", target_date=today)
    b = generate_affirmation(card_name="The Sun", orientation="upright", target_date=today)
    assert a == b
    assert a["affirmation"]
    assert a["tone"] == "uplifting"
    rev = generate_affirmation(card_name="The Sun", orientation="reversed", target_date=today)
    assert rev["tone"] == "gentle"
    assert rev["affirmation"] != a["affirmation"]


def test_affirmation_endpoint_open_widget(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        res = client.get("/api/affirmations/The Sun")
        assert res.status_code == 200
        data = res.json()
        assert data["card_name"] == "The Sun"
        assert data["affirmation"]
        assert data["tone"] == "uplifting"


# ==== Daily Card + Streak (via API) ================================


def test_daily_card_draw_is_idempotent_per_day(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "alice@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        first = client.post("/api/daily-card/draw", headers=headers, json={"mood_pre": "calm"})
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["card_name"]
        assert body["orientation"] in {"upright", "reversed"}
        assert body["streak_at_draw"] == 1
        assert body["mood_pre"] == "calm"
        assert body["affirmation"]
        second = client.post("/api/daily-card/draw", headers=headers, json={"mood_pre": "anxious"})
        assert second.status_code == 200
        assert second.json()["id"] == body["id"]
        assert second.json()["mood_pre"] == "calm"


def test_daily_card_streak_endpoint(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "bob@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        before = client.get("/api/daily-card/streak", headers=headers).json()
        assert before["current_streak"] == 0
        assert before["total_draws"] == 0
        client.post("/api/daily-card/draw", headers=headers)
        after = client.get("/api/daily-card/streak", headers=headers).json()
        assert after["current_streak"] == 1
        assert after["total_draws"] == 1
        assert after["last_draw_date"] is not None


def test_daily_card_reflection_updates_record(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "carol@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        draw = client.post("/api/daily-card/draw", headers=headers).json()
        res = client.post(
            f"/api/daily-card/{draw['id']}/reflect",
            headers=headers,
            json={"reflection": "Felt clarity today.", "mood_post": "grateful"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["reflection"] == "Felt clarity today."
        assert body["mood_post"] == "grateful"


def test_daily_card_history_endpoint(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "ed@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        client.post("/api/daily-card/draw", headers=headers)
        res = client.get("/api/daily-card/history?limit=5", headers=headers)
        assert res.status_code == 200
        items = res.json()["items"]
        assert len(items) == 1
        assert items[0]["card_name"]


# ==== Time Capsule (via API) ========================================


def test_time_capsule_seal_and_reveal_flow(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "frank@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        reveal_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        create = client.post(
            "/api/time-capsules",
            headers=headers,
            json={
                "title": "Career check-in",
                "reveal_at": reveal_at,
                "question_text": "Should I accept the job?",
                "prediction_text": "Move forward but verify the contract.",
                "cards": [{"name": "The Chariot", "orientation": "upright"}],
            },
        )
        assert create.status_code == 200, create.text
        capsule = create.json()
        assert capsule["status"] == "sealed"
        capsule_id = capsule["id"]
        listing = client.get("/api/time-capsules", headers=headers).json()
        sealed_item = next(item for item in listing["items"] if item["id"] == capsule_id)
        assert sealed_item["status"] == "sealed"
        assert "prediction_text" not in sealed_item
        early = client.post(f"/api/time-capsules/{capsule_id}/reveal", headers=headers)
        assert early.status_code == 400


def test_time_capsule_validates_reveal_window(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "gina@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        too_soon = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        res = client.post(
            "/api/time-capsules",
            headers=headers,
            json={
                "title": "Soon",
                "reveal_at": too_soon,
                "question_text": "?",
                "prediction_text": "?",
            },
        )
        assert res.status_code == 400
        detail = res.json()["detail"].lower()
        assert "future" in detail or "ahead" in detail


def test_time_capsule_open_and_verdict_when_due(monkeypatch, tmp_path):
    """Open + verdict via API after manually expiring reveal_at in DB."""
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    from sqlalchemy import update
    from src.db.models import TimeCapsule
    from src.db.session import session_scope
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "hank@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        reveal_at = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        create = client.post(
            "/api/time-capsules",
            headers=headers,
            json={
                "title": "Project ship",
                "reveal_at": reveal_at,
                "question_text": "Will the launch go well?",
                "prediction_text": "Smooth launch, one small fix afterward.",
            },
        )
        assert create.status_code == 200, create.text
        capsule_id = create.json()["id"]
        past = datetime.now(timezone.utc) - timedelta(hours=1)
        with session_scope() as session:
            session.execute(
                update(TimeCapsule).where(TimeCapsule.id == capsule_id).values(reveal_at=past)
            )
        opened = client.post(f"/api/time-capsules/{capsule_id}/reveal", headers=headers).json()
        assert opened["status"] == "revealed"
        assert opened["prediction_text"] == "Smooth launch, one small fix afterward."
        verdict = client.post(
            f"/api/time-capsules/{capsule_id}/verdict",
            headers=headers,
            json={"accuracy_score": 4, "accuracy_note": "Mostly accurate"},
        ).json()
        assert verdict["accuracy_score"] == 4
        assert verdict["status"] == "verified"


def test_time_capsule_scheduler_marks_due_capsules(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    from sqlalchemy import update
    from src.advanced import time_capsule as tc_module
    from src.db.models import TimeCapsule
    from src.db.session import session_scope
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "ivy@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        reveal_at = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        create = client.post(
            "/api/time-capsules",
            headers=headers,
            json={
                "title": "Auto reveal",
                "reveal_at": reveal_at,
                "question_text": "Will the rain stop?",
                "prediction_text": "Yes by Thursday.",
            },
        )
        capsule_id = create.json()["id"]
        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        with session_scope() as session:
            session.execute(
                update(TimeCapsule).where(TimeCapsule.id == capsule_id).values(reveal_at=past)
            )
        stats = tc_module.mark_due_capsules_notified()
        assert stats["revealed"] >= 1


# ==== Hardening tests ==============================================


def test_email_validator_rejects_bad_addresses():
    from src.utils.validators import is_valid_email, normalize_email
    assert not is_valid_email("")
    assert not is_valid_email("foo")
    assert not is_valid_email("foo@bar")
    assert is_valid_email("foo@bar.com")
    assert normalize_email("  Foo@BAR.COM ") == "foo@bar.com"


def test_register_rejects_invalid_email(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        bad = client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "secret123"},
        )
        assert bad.status_code == 400
        assert "email" in bad.json()["detail"].lower()


def test_rate_limiter_blocks_burst(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    reset_rate_limiter_for_tests()
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        statuses = []
        for _ in range(12):
            res = client.post(
                "/api/auth/login",
                json={"email": "nobody@example.com", "password": "wrongpass"},
            )
            statuses.append(res.status_code)
        assert 429 in statuses, f"expected 429, got {statuses}"


def test_health_check_reports_db_ok(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["db"] == "ok"
        assert body["version"]


def test_request_id_header_is_set(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        res = client.get("/")
        assert res.headers.get("x-request-id")
        echo = client.get("/", headers={"X-Request-Id": "test-trace-1"})
        assert echo.headers.get("x-request-id") == "test-trace-1"
