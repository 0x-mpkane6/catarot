"""End-to-end test cho 8 vấn đề bạn của user đề cập.

Mỗi nhóm = 1 class với marker rõ ràng, in ra report dạng PASS/FAIL.
Mục tiêu: kiểm tra **đúng hành vi từ góc nhìn user** chứ không chỉ unit test.
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


# =====================================================================
# Fixture chung: TestClient với DB tạm, rate-limit OFF để test thuần logic
# =====================================================================


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "e2e.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("EXPOSE_RESET_TOKEN_IN_RESPONSE", "true")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-key-do-not-use-in-production-min-32-chars")

    # Reset caches của DB engine để pick up env mới
    from src.db.session import reset_database_caches_for_tests
    from src.db.init_db import reset_database_bootstrap_for_tests

    reset_database_caches_for_tests()
    reset_database_bootstrap_for_tests()

    from src.db import initialize_database

    initialize_database(seed_reference_data=False)

    from src.main import app

    with TestClient(app) as c:
        yield c

    reset_database_caches_for_tests()
    reset_database_bootstrap_for_tests()


def _register_and_login(c: TestClient, username: str, email: str, password: str = "secret1") -> tuple[dict, str]:
    """Helper: register + login, trả về (user, token)."""
    r = c.post(
        "/api/auth/register",
        json={"email": email, "password": password, "username": username},
    )
    assert r.status_code == 200, f"register failed: {r.text}"
    user = r.json()

    r = c.post("/api/auth/login", json={"identifier": username, "password": password})
    assert r.status_code == 200, f"login failed: {r.text}"
    token = r.json()["access_token"]
    return user, token


# =====================================================================
# F4: Login bằng username HOẶC email
# =====================================================================


class TestF4LoginIdentifier:
    """Login phải work với username, email, và backward-compat email."""

    def test_register_with_username_returns_full_profile(self, client: TestClient) -> None:
        r = client.post(
            "/api/auth/register",
            json={
                "email": "alice@example.com",
                "password": "secret1",
                "username": "alice",
                "display_name": "Alice Wonder",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == "alice@example.com"
        assert body["username"] == "alice"
        assert body["display_name"] == "Alice Wonder"
        assert "id" in body and body["id"] > 0

    def test_login_by_username(self, client: TestClient) -> None:
        _register_and_login(client, "bob", "bob@example.com")
        r = client.post("/api/auth/login", json={"identifier": "bob", "password": "secret1"})
        assert r.status_code == 200
        assert r.json()["user"]["username"] == "bob"

    def test_login_by_email_via_identifier(self, client: TestClient) -> None:
        _register_and_login(client, "carol", "carol@example.com")
        r = client.post(
            "/api/auth/login",
            json={"identifier": "carol@example.com", "password": "secret1"},
        )
        assert r.status_code == 200

    def test_login_by_email_legacy_field(self, client: TestClient) -> None:
        """LoginRequest còn nhận field `email` cho client cũ."""
        _register_and_login(client, "dave", "dave@example.com")
        r = client.post(
            "/api/auth/login",
            json={"email": "dave@example.com", "password": "secret1"},
        )
        assert r.status_code == 200

    def test_login_wrong_password_returns_401(self, client: TestClient) -> None:
        _register_and_login(client, "eve", "eve@example.com")
        r = client.post(
            "/api/auth/login",
            json={"identifier": "eve", "password": "wrong-password"},
        )
        assert r.status_code == 401

    def test_login_unknown_user_returns_401(self, client: TestClient) -> None:
        r = client.post(
            "/api/auth/login",
            json={"identifier": "nobody", "password": "whatever"},
        )
        assert r.status_code == 401

    def test_login_username_case_insensitive(self, client: TestClient) -> None:
        _register_and_login(client, "frank", "frank@example.com")
        r = client.post(
            "/api/auth/login",
            json={"identifier": "FRANK", "password": "secret1"},
        )
        assert r.status_code == 200

    def test_username_uniqueness_enforced(self, client: TestClient) -> None:
        client.post(
            "/api/auth/register",
            json={"email": "g1@example.com", "password": "secret1", "username": "grace"},
        )
        r = client.post(
            "/api/auth/register",
            json={"email": "g2@example.com", "password": "secret1", "username": "grace"},
        )
        assert r.status_code == 400


# =====================================================================
# F5: Forgot + Reset password
# =====================================================================


class TestF5ForgotResetPassword:
    def test_forgot_returns_dev_token_when_enabled(self, client: TestClient) -> None:
        _register_and_login(client, "henry", "henry@example.com")
        r = client.post("/api/auth/forgot-password", json={"email": "henry@example.com"})
        assert r.status_code == 200
        body = r.json()
        assert "message" in body
        assert body.get("dev_only_token")  # vì EXPOSE_RESET_TOKEN_IN_RESPONSE=true
        assert len(body["dev_only_token"]) >= 20

    def test_forgot_unknown_email_returns_same_message(self, client: TestClient) -> None:
        """Anti-enumeration: response không tiết lộ email có tồn tại không."""
        r = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
        assert r.status_code == 200
        assert "Nếu email tồn tại" in r.json()["message"]
        # Token không có vì user không tồn tại
        assert r.json().get("dev_only_token") is None

    def test_full_reset_cycle(self, client: TestClient) -> None:
        _register_and_login(client, "ivan", "ivan@example.com", password="oldpass1")

        # 1. Request reset
        r = client.post("/api/auth/forgot-password", json={"email": "ivan@example.com"})
        token = r.json()["dev_only_token"]
        assert token

        # 2. Reset
        r = client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "brand-new-pass"},
        )
        assert r.status_code == 200

        # 3. Login với pass mới
        r = client.post(
            "/api/auth/login",
            json={"identifier": "ivan", "password": "brand-new-pass"},
        )
        assert r.status_code == 200

        # 4. Login với pass cũ phải fail
        r = client.post(
            "/api/auth/login",
            json={"identifier": "ivan", "password": "oldpass1"},
        )
        assert r.status_code == 401

        # 5. Token không reuse được
        r = client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "another-pass"},
        )
        assert r.status_code == 400

    def test_reset_with_invalid_token(self, client: TestClient) -> None:
        r = client.post(
            "/api/auth/reset-password",
            json={"token": "completely-bogus-token-not-in-db", "new_password": "newpass"},
        )
        assert r.status_code == 400

    def test_reset_with_expired_token(self, client: TestClient, tmp_path) -> None:
        _register_and_login(client, "jack", "jack@example.com")
        r = client.post("/api/auth/forgot-password", json={"email": "jack@example.com"})
        token = r.json()["dev_only_token"]

        # Manually set expiry vào quá khứ
        db_path = os.environ["DATABASE_URL"].replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        try:
            past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
            conn.execute(
                "UPDATE users SET reset_token_expires_at = ? WHERE reset_token = ?",
                (past, token),
            )
            conn.commit()
        finally:
            conn.close()

        r = client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "any-new-pass"},
        )
        assert r.status_code == 400
        assert "expired" in r.json()["detail"].lower()


# =====================================================================
# F6: Google OAuth
# =====================================================================


class TestF6GoogleOAuth:
    def test_google_endpoint_returns_503_when_not_configured(self, client: TestClient) -> None:
        r = client.post(
            "/api/auth/google",
            json={"id_token": "fake-id-token-long-enough"},
        )
        assert r.status_code == 503
        assert "GOOGLE_CLIENT_ID" in r.json()["detail"]

    def test_google_endpoint_validates_token_format(self, client: TestClient) -> None:
        r = client.post("/api/auth/google", json={"id_token": "short"})
        assert r.status_code == 422  # pydantic validation min_length

    def test_google_endpoint_with_invalid_token(self, client: TestClient, monkeypatch) -> None:
        """Khi có GOOGLE_CLIENT_ID nhưng token sai → 401."""
        monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")
        r = client.post(
            "/api/auth/google",
            json={"id_token": "definitely-not-a-real-google-token-but-long-enough"},
        )
        # Hoặc 401 (token invalid) hoặc 503 (google-auth lib missing)
        assert r.status_code in (401, 503)


# =====================================================================
# F7+F8: User profile
# =====================================================================


class TestF7F8Profile:
    def test_get_profile_returns_all_fields(self, client: TestClient) -> None:
        _, token = _register_and_login(client, "kate", "kate@example.com")
        h = {"Authorization": f"Bearer {token}"}

        r = client.get("/api/profile/me", headers=h)
        assert r.status_code == 200
        body = r.json()
        for field in ("id", "email", "username", "display_name", "avatar_url", "bio", "role"):
            assert field in body, f"missing field: {field}"

    def test_patch_profile_updates_avatar_and_bio(self, client: TestClient) -> None:
        _, token = _register_and_login(client, "leo", "leo@example.com")
        h = {"Authorization": f"Bearer {token}"}

        r = client.patch(
            "/api/profile/me",
            headers=h,
            json={
                "display_name": "Leo the Lion",
                "avatar_url": "https://cdn.example.com/leo.png",
                "bio": "Xin chào, tôi là Leo 🦁",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert body["display_name"] == "Leo the Lion"
        assert body["avatar_url"] == "https://cdn.example.com/leo.png"
        assert body["bio"] == "Xin chào, tôi là Leo 🦁"

        # Verify persist
        r = client.get("/api/profile/me", headers=h)
        assert r.json()["bio"] == "Xin chào, tôi là Leo 🦁"

    def test_post_alias_works_same_as_patch(self, client: TestClient) -> None:
        _, token = _register_and_login(client, "mia", "mia@example.com")
        h = {"Authorization": f"Bearer {token}"}

        r = client.post("/api/profile/me", headers=h, json={"bio": "via POST"})
        assert r.status_code == 200
        assert r.json()["bio"] == "via POST"

    def test_change_username_works(self, client: TestClient) -> None:
        _, token = _register_and_login(client, "nick", "nick@example.com")
        h = {"Authorization": f"Bearer {token}"}

        r = client.patch("/api/profile/me", headers=h, json={"username": "nicholas"})
        assert r.status_code == 200
        assert r.json()["username"] == "nicholas"

        # Login bằng username mới
        r = client.post("/api/auth/login", json={"identifier": "nicholas", "password": "secret1"})
        assert r.status_code == 200

    def test_duplicate_username_returns_409(self, client: TestClient) -> None:
        _register_and_login(client, "olivia", "olivia@example.com")
        _, peter_token = _register_and_login(client, "peter", "peter@example.com")
        h = {"Authorization": f"Bearer {peter_token}"}

        # Peter đổi username thành 'olivia' (đã tồn tại)
        r = client.patch("/api/profile/me", headers=h, json={"username": "olivia"})
        assert r.status_code == 409

    def test_profile_endpoints_require_auth(self, client: TestClient) -> None:
        r = client.get("/api/profile/me")
        assert r.status_code == 401

        r = client.patch("/api/profile/me", json={"bio": "anonymous"})
        assert r.status_code == 401


# =====================================================================
# F3: Sessions list + detail
# =====================================================================


class TestF3SessionsList:
    def _create_session_via_db(self, *, user_id: int, question: str = "test question") -> int:
        """Tạo 1 reading session trực tiếp vào DB (skip pipeline)."""
        import sqlalchemy as sa
        from src.db.models import Reading, ReadingSession, RecognizedCard, TarotCard
        from src.db.session import session_scope

        with session_scope() as session:
            rs = ReadingSession(
                user_id=user_id,
                question_text=question,
                status="completed",
            )
            session.add(rs)
            session.flush()

            # Thêm 1 tarot card (insert nếu chưa có)
            card = session.scalar(sa.select(TarotCard).limit(1))
            if card is None:
                card = TarotCard(name="The Lovers", arcana_type="Major", suit=None, number=6)
                session.add(card)
                session.flush()
            card_id = card.id

            session.add(
                RecognizedCard(
                    session_id=rs.id,
                    card_id=card_id,
                    orientation="upright",
                    confidence=0.85,
                    position_label="present",
                    order_index=0,
                )
            )
            session.add(
                Reading(
                    session_id=rs.id,
                    generated_text="## Tổng quan\nVí dụ luận giải tiếng Việt.",
                    llm_model="deterministic-fallback",
                )
            )
            session.flush()
            return rs.id

    def test_list_sessions_empty_for_new_user(self, client: TestClient) -> None:
        _, token = _register_and_login(client, "quinn", "quinn@example.com")
        h = {"Authorization": f"Bearer {token}"}

        r = client.get("/api/sessions", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["items"] == []
        assert body["total"] == 0

    def test_list_sessions_returns_user_sessions(self, client: TestClient) -> None:
        user, token = _register_and_login(client, "rita", "rita@example.com")
        h = {"Authorization": f"Bearer {token}"}

        s1 = self._create_session_via_db(user_id=user["id"], question="Câu hỏi 1")
        s2 = self._create_session_via_db(user_id=user["id"], question="Câu hỏi 2")

        r = client.get("/api/sessions", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 2
        ids = [item["id"] for item in body["items"]]
        assert s1 in ids and s2 in ids

        # Items có đủ field
        sample = body["items"][0]
        for field in ("id", "question_text", "status", "created_at", "card_count"):
            assert field in sample

    def test_session_detail_returns_cards_and_answer(self, client: TestClient) -> None:
        user, token = _register_and_login(client, "sam", "sam@example.com")
        h = {"Authorization": f"Bearer {token}"}

        sid = self._create_session_via_db(user_id=user["id"], question="Tình cảm của tôi?")

        r = client.get(f"/api/sessions/{sid}", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == sid
        assert body["question_text"] == "Tình cảm của tôi?"
        assert isinstance(body["cards"], list)
        assert len(body["cards"]) >= 1
        assert body["final_answer"] is not None
        assert "Tổng quan" in body["final_answer"]

    def test_cannot_access_other_user_session(self, client: TestClient) -> None:
        """Privacy: user A không xem được session của user B."""
        user_a, token_a = _register_and_login(client, "tom", "tom@example.com")
        user_b, token_b = _register_and_login(client, "ursula", "ursula@example.com")

        s_a = self._create_session_via_db(user_id=user_a["id"], question="A private")

        # B cố gọi session của A
        r = client.get(
            f"/api/sessions/{s_a}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert r.status_code == 404

    def test_sessions_list_requires_auth(self, client: TestClient) -> None:
        r = client.get("/api/sessions")
        assert r.status_code == 401

    def test_pagination_works(self, client: TestClient) -> None:
        user, token = _register_and_login(client, "vince", "vince@example.com")
        h = {"Authorization": f"Bearer {token}"}

        for i in range(5):
            self._create_session_via_db(user_id=user["id"], question=f"Q{i}")

        r = client.get("/api/sessions?limit=2&offset=0", headers=h)
        assert r.status_code == 200
        assert len(r.json()["items"]) == 2
        assert r.json()["total"] == 5


# =====================================================================
# F1: LLM tiếng Việt + Markdown
# =====================================================================


class TestF1VietnameseLLM:
    def test_system_prompt_is_vietnamese(self) -> None:
        from pathlib import Path

        prompt_dir = Path(__file__).resolve().parents[1] / "src" / "llm" / "prompts"
        sys_prompt = (prompt_dir / "system.md").read_text(encoding="utf-8")
        assert "tiếng Việt" in sys_prompt
        assert "Markdown" in sys_prompt
        assert "Tổng quan" in sys_prompt

    def test_reading_template_is_vietnamese(self) -> None:
        from pathlib import Path

        prompt_dir = Path(__file__).resolve().parents[1] / "src" / "llm" / "prompts"
        template = (prompt_dir / "reading_template.md").read_text(encoding="utf-8")
        assert "tiếng Việt" in template
        assert "Lời khuyên 7 ngày" in template

    def test_deterministic_fallback_returns_vietnamese_markdown(self, monkeypatch) -> None:
        monkeypatch.setenv("OLLAMA_ENABLED", "false")
        monkeypatch.setenv("GEMINI_API_KEY", "")
        monkeypatch.setenv("OPENAI_API_KEY", "")

        from src.llm.generate import ReadingGenerator

        gen = ReadingGenerator()
        gen.api_key = ""
        gen.gemini_api_key = ""

        cards = [
            {"name": "The Lovers", "orientation": "upright", "position": "past", "confidence": 0.9, "topk_candidates": []},
            {"name": "The Star", "orientation": "upright", "position": "present", "confidence": 0.9, "topk_candidates": []},
            {"name": "The Moon", "orientation": "reversed", "position": "future", "confidence": 0.7, "topk_candidates": []},
        ]
        answer, warnings = gen.generate(
            question="Tình cảm của tôi tuần tới ra sao?",
            transcript=None,
            spread_type="three",
            cards=cards,
            rag_snippets=[],
            emotion_state=None,
            warnings=[],
        )

        # Markdown structure
        assert "## Tổng quan" in answer
        assert "### Diễn giải từng lá" in answer
        assert "### Lời khuyên 7 ngày" in answer

        # Tiếng Việt
        assert "Quá khứ" in answer
        assert "Hiện tại" in answer
        assert "Tương lai" in answer
        assert "tình cảm" in answer

        # Đúng tên lá bài
        assert "The Lovers" in answer
        assert "The Star" in answer
        assert "The Moon" in answer

        # KHÔNG có chữ tiếng Anh "career"
        assert "career" not in answer.lower() or "sự nghiệp" in answer

        # Fallback warning
        assert any("Chưa cấu hình mô hình ngôn ngữ" in w for w in warnings)


# =====================================================================
# B1: JWT_SECRET production fail-fast
# =====================================================================


class TestB1JwtSecretProduction:
    def test_production_with_placeholder_secret_raises(self, monkeypatch) -> None:
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "change_me_in_production_min_32_chars")

        from src.auth.security import _jwt_secret

        with pytest.raises(RuntimeError, match="JWT_SECRET_KEY"):
            _jwt_secret()

    def test_production_with_short_secret_raises(self, monkeypatch) -> None:
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "short")

        from src.auth.security import _jwt_secret

        with pytest.raises(RuntimeError):
            _jwt_secret()

    def test_production_with_empty_secret_raises(self, monkeypatch) -> None:
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "")

        from src.auth.security import _jwt_secret

        with pytest.raises(RuntimeError):
            _jwt_secret()

    def test_production_with_strong_secret_works(self, monkeypatch) -> None:
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("JWT_SECRET_KEY", "this-is-a-strong-secret-with-more-than-32-chars-aaaaa")

        from src.auth.security import _jwt_secret

        assert _jwt_secret() == "this-is-a-strong-secret-with-more-than-32-chars-aaaaa"

    def test_development_with_placeholder_returns_default(self, monkeypatch) -> None:
        monkeypatch.delenv("APP_ENV", raising=False)
        monkeypatch.delenv("PRODUCTION", raising=False)
        monkeypatch.setenv("JWT_SECRET_KEY", "")

        from src.auth.security import _jwt_secret

        # Dev mode chỉ warn, không raise
        secret = _jwt_secret()
        assert isinstance(secret, str)
        assert len(secret) > 0


# =====================================================================
# B2: Rate-limit cho /api/ask*
# =====================================================================


class TestB2AskRateLimit:
    def test_ask_rate_limit_blocks_after_threshold(self, monkeypatch, tmp_path) -> None:
        db_path = tmp_path / "rl.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
        monkeypatch.setenv("OLLAMA_ENABLED", "false")
        monkeypatch.setenv("GEMINI_API_KEY", "")
        monkeypatch.setenv("OPENAI_API_KEY", "")
        monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
        monkeypatch.setenv("ASK_RATE_LIMIT_MAX", "3")
        monkeypatch.setenv("ASK_RATE_LIMIT_WINDOW", "60")
        monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-x" * 4)

        from src.db.init_db import reset_database_bootstrap_for_tests
        from src.db.session import reset_database_caches_for_tests
        from src.utils.rate_limit import reset_rate_limiter_for_tests

        reset_database_caches_for_tests()
        reset_database_bootstrap_for_tests()
        reset_rate_limiter_for_tests()

        from src.db import initialize_database

        initialize_database(seed_reference_data=False)

        from src.main import app

        # Mock pipeline để tránh download model
        from unittest.mock import MagicMock, patch

        fake_pipeline = MagicMock()
        fake_pipeline.run_pipeline.return_value = {
            "question": "test",
            "transcript": None,
            "spread_type": "three",
            "cards": [],
            "rag_snippets": [],
            "final_answer": "fake",
            "llm_model": "test",
            "warnings": [],
        }

        with TestClient(app) as c, patch("src.main._get_pipeline", return_value=fake_pipeline):
            payload = {"question": "q?", "spread_type": "three", "random_draw": True}

            # 3 request đầu OK
            for i in range(3):
                r = c.post("/api/ask", json=payload)
                assert r.status_code == 200, f"req {i} blocked unexpectedly: {r.status_code}"

            # Request thứ 4 phải 429
            r = c.post("/api/ask", json=payload)
            assert r.status_code == 429
            assert "Too many" in r.json()["detail"]

        reset_rate_limiter_for_tests()
        reset_database_caches_for_tests()
        reset_database_bootstrap_for_tests()


# =====================================================================
# Integration: full user journey
# =====================================================================


class TestEndToEndUserJourney:
    """Simulate 1 user dùng app từ đầu đến cuối."""

    def test_full_journey(self, client: TestClient) -> None:
        # 1. Register
        r = client.post(
            "/api/auth/register",
            json={
                "email": "journey@example.com",
                "password": "myStrongPass1",
                "username": "journeyman",
                "display_name": "Journey Man",
            },
        )
        assert r.status_code == 200
        user = r.json()
        assert user["username"] == "journeyman"

        # 2. Login bằng username
        r = client.post(
            "/api/auth/login",
            json={"identifier": "journeyman", "password": "myStrongPass1"},
        )
        assert r.status_code == 200
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        # 3. Get profile
        r = client.get("/api/profile/me", headers=h)
        assert r.status_code == 200
        assert r.json()["display_name"] == "Journey Man"

        # 4. Update bio + avatar
        r = client.patch(
            "/api/profile/me",
            headers=h,
            json={
                "bio": "Tôi yêu tarot 🔮",
                "avatar_url": "https://example.com/journey.png",
            },
        )
        assert r.status_code == 200

        # 5. List sessions (empty)
        r = client.get("/api/sessions", headers=h)
        assert r.status_code == 200
        assert r.json()["items"] == []

        # 6. Forgot password
        r = client.post("/api/auth/forgot-password", json={"email": "journey@example.com"})
        assert r.status_code == 200
        reset_token = r.json()["dev_only_token"]

        # 7. Reset password
        r = client.post(
            "/api/auth/reset-password",
            json={"token": reset_token, "new_password": "newJourneyPass1"},
        )
        assert r.status_code == 200

        # 8. Login với pass mới
        r = client.post(
            "/api/auth/login",
            json={"identifier": "journeyman", "password": "newJourneyPass1"},
        )
        assert r.status_code == 200
        new_token = r.json()["access_token"]

        # 9. Verify bio vẫn còn (không bị reset cùng password)
        r = client.get(
            "/api/profile/me",
            headers={"Authorization": f"Bearer {new_token}"},
        )
        assert r.json()["bio"] == "Tôi yêu tarot 🔮"
