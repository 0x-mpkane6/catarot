from __future__ import annotations

import importlib
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from src.advanced.archetype_profiler import run_archetype_weekly_job
from src.advanced.oracle_reports import create_oracle_report_for_user
from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests


def _bootstrap(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    pytest.importorskip("fastapi")
    db_path = tmp_path / "remaining_advanced.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_EMAIL_ENABLED", "false")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")

    reset_database_bootstrap_for_tests()
    reset_database_caches_for_tests()

    import src.main as main_module
    main_module = importlib.reload(main_module)

    class DummyPredictor:
        def predict(self, _image_path: str) -> dict:
            return {"name": "The Lovers", "orientation": "upright", "confidence": 0.91}

    class DummyPipeline:
        def __init__(self) -> None:
            self.card_predictor = DummyPredictor()

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
                    {"name": "The Lovers", "orientation": "upright", "position": "past", "confidence": 0.9},
                    {"name": "The Moon", "orientation": "reversed", "position": "present", "confidence": 0.8},
                    {"name": "The Star", "orientation": "upright", "position": "future", "confidence": 0.85},
                ],
                "rag_snippets": [{"source_id": "x", "text": "snippet", "metadata": {"card_name": "The Lovers"}}],
                "emotion_state": "calm",
                "emotion_signal": {"pause_ratio": 0.2},
                "final_answer": "Sample reading.",
                "llm_model": "deterministic-fallback",
                "warnings": [],
            }

    monkeypatch.setattr(main_module, "_get_pipeline", lambda: DummyPipeline())
    return main_module


def _promote_to_admin(user_id: int) -> None:
    # API đăng ký công khai chỉ tạo 'member' (bảo mật). Admin tạo ở tầng DB,
    # mô phỏng seeding. get_current_admin đọc role từ DB nên token cũ vẫn hiệu lực.
    from sqlalchemy import update

    from src.db.models import User
    from src.db.session import session_scope

    with session_scope() as session:
        session.execute(update(User).where(User.id == user_id).values(role="admin"))


def _register_login(client, email: str, password: str, role: str = "member") -> tuple[str, int]:
    reg = client.post("/api/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200
    user_id = reg.json()["id"]

    login = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]

    if role == "admin":
        _promote_to_admin(user_id)
    return token, user_id


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _fake_png_bytes() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (32, 32), color=(120, 40, 200)).save(buf, format="PNG")
    return buf.getvalue()


def test_auth_me_and_remaining_features(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        token_member, user_member = _register_login(client, "member1@example.com", "password123")
        token_member2, user_member2 = _register_login(client, "member2@example.com", "password123")
        token_admin, _user_admin = _register_login(client, "admin1@example.com", "password123", role="admin")

        me = client.get("/api/auth/me", headers=_auth_headers(token_member))
        assert me.status_code == 200
        assert me.json()["id"] == user_member

        # Community pre-moderation flow
        post_resp = client.post(
            "/api/community/posts",
            json={
                "question_text": "Is this relationship aligned?",
                "card_summary": [{"label": "The Lovers - Xuôi"}],
            },
            headers=_auth_headers(token_member),
        )
        assert post_resp.status_code == 200
        post_id = post_resp.json()["id"]
        assert post_resp.json()["card_summary"] == [{"label": "The Lovers - Xuôi"}]

        feed_before = client.get("/api/community/feed")
        assert feed_before.status_code == 200
        assert all(item["id"] != post_id for item in feed_before.json()["items"])

        queue = client.get("/api/admin/community/moderation_queue", headers=_auth_headers(token_admin))
        assert queue.status_code == 200
        queued_post = next(item for item in queue.json()["items"] if item["id"] == post_id)
        assert queued_post["card_summary"] == [{"label": "The Lovers - Xuôi"}]

        approve = client.post(
            f"/api/admin/community/posts/{post_id}/approve",
            json={"reason": "ok"},
            headers=_auth_headers(token_admin),
        )
        assert approve.status_code == 200
        assert approve.json()["status"] == "approved"
        assert approve.json()["card_summary"] == [{"label": "The Lovers - Xuôi"}]

        feed_after = client.get("/api/community/feed")
        assert feed_after.status_code == 200
        approved_post = next(item for item in feed_after.json()["items"] if item["id"] == post_id)
        assert approved_post["card_summary"] == [{"label": "The Lovers - Xuôi"}]

        interp = client.post(
            f"/api/community/posts/{post_id}/interpretations",
            json={"content": "I think this points to honesty."},
            headers=_auth_headers(token_member2),
        )
        assert interp.status_code == 200
        interpretation_id = interp.json()["id"]

        vote = client.post(
            f"/api/community/interpretations/{interpretation_id}/vote",
            headers=_auth_headers(token_member),
        )
        assert vote.status_code == 200
        assert vote.json()["vote_count"] >= 1

        resonate = client.post(
            f"/api/community/interpretations/{interpretation_id}/resonate",
            headers=_auth_headers(token_member),
        )
        assert resonate.status_code == 200
        assert resonate.json()["resonated_by_post_owner"] is True

        # Duo flow
        duo_create = client.post("/api/duo/sessions", headers=_auth_headers(token_member))
        assert duo_create.status_code == 200
        duo_id = duo_create.json()["id"]

        duo_join = client.post(f"/api/duo/sessions/{duo_id}/join", headers=_auth_headers(token_member2))
        assert duo_join.status_code == 200

        card_file_1 = ("card1.png", _fake_png_bytes(), "image/png")
        card_file_2 = ("card2.png", _fake_png_bytes(), "image/png")
        up1 = client.post(
            f"/api/duo/sessions/{duo_id}/card",
            files={"image": card_file_1},
            headers=_auth_headers(token_member),
        )
        assert up1.status_code == 200
        up2 = client.post(
            f"/api/duo/sessions/{duo_id}/card",
            files={"image": card_file_2},
            headers=_auth_headers(token_member2),
        )
        assert up2.status_code == 200
        # Sinh luận giải nay chạy NỀN (BackgroundTasks) → response của lá thứ hai chỉ ở trạng
        # thái "generating". TestClient chạy xong background task TRƯỚC khi post() trả về, nên
        # GET ngay sau đó phải thấy "completed" + có reading.
        assert up2.json()["status"] in ("generating", "completed")
        duo_after = client.get(
            f"/api/duo/sessions/{duo_id}",
            headers=_auth_headers(token_member2),
        )
        assert duo_after.status_code == 200
        assert duo_after.json()["status"] == "completed"
        assert duo_after.json()["reading"] is not None

        with client.websocket_connect(f"/ws/duo/{duo_id}?token={token_member}") as ws:
            payload = ws.receive_json()
            assert payload["type"] == "snapshot"

        # Dream journal
        dream_create = client.post(
            "/api/dreams",
            data={"raw_text": "I saw snake and water in my dream"},
            headers=_auth_headers(token_member),
        )
        assert dream_create.status_code == 200
        dream_id = dream_create.json()["id"]
        assert dream_create.json()["symbols"]

        dream_list = client.get("/api/dreams", headers=_auth_headers(token_member))
        assert dream_list.status_code == 200
        assert any(item["id"] == dream_id for item in dream_list.json()["items"])

        dream_detail = client.get(f"/api/dreams/{dream_id}", headers=_auth_headers(token_member))
        assert dream_detail.status_code == 200

        # Generate enough sessions for archetype + oracle
        for idx in range(6):
            ask = client.post(
                "/api/ask",
                headers=_auth_headers(token_member),
                json={
                    "question": f"question {idx} about relationship",
                    "spread_type": "three",
                    "random_draw": True,
                },
            )
            assert ask.status_code == 200

        profile_stats = run_archetype_weekly_job(min_sessions=5)
        assert profile_stats["updated"] >= 1
        profile_resp = client.get(
            f"/api/users/{user_member}/archetype_profile",
            headers=_auth_headers(token_member),
        )
        assert profile_resp.status_code == 200
        assert profile_resp.json()["soul_card"]

        report = create_oracle_report_for_user(user_id=user_member, send_email=False)
        assert report is not None
        oracle_list = client.get(
            f"/api/users/{user_member}/oracle_reports",
            headers=_auth_headers(token_member),
        )
        assert oracle_list.status_code == 200
        assert oracle_list.json()["items"]

        oracle_latest = client.get(
            f"/api/users/{user_member}/oracle_reports/latest",
            headers=_auth_headers(token_member),
        )
        assert oracle_latest.status_code == 200

