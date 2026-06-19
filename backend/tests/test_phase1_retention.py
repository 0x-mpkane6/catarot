"""Tests cho phase-1 retention + đo lường: daily-card một-chạm, notifications,
share image, analytics funnel. Mirror harness của test_unique_features.py."""
from __future__ import annotations

import importlib
from datetime import datetime

import pytest

from src.db.init_db import reset_database_bootstrap_for_tests
from src.db.session import reset_database_caches_for_tests
from src.utils.rate_limit import reset_rate_limiter_for_tests


def _bootstrap(monkeypatch, tmp_path):
    pytest.importorskip("fastapi")
    db_path = tmp_path / "phase1.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("DB_ENABLED", "true")
    monkeypatch.setenv("RATING_REMINDER_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ARCHETYPE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("ORACLE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("TIME_CAPSULE_SCHEDULER_ENABLED", "false")
    monkeypatch.setenv("NOTIFICATION_SCHEDULER_ENABLED", "false")  # không chạy thread nền trong test
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    # Đảm bảo SMTP KHÔNG cấu hình theo mặc định (mỗi test tự bật nếu cần).
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_FROM", raising=False)
    monkeypatch.setenv("SHARE_IMAGE_CACHE_DIR", str(tmp_path / "share_cache"))

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


# ==== Models / migration =============================================


def test_new_tables_exist_and_create_all_idempotent(monkeypatch, tmp_path):
    _bootstrap(monkeypatch, tmp_path)
    from sqlalchemy import inspect
    from src.db.models import Base
    from src.db.session import get_engine

    tables = set(inspect(get_engine()).get_table_names())
    assert {"notification_preferences", "notifications", "analytics_events"} <= tables
    # Idempotent: chạy lại create_all không lỗi (checkfirst mặc định True).
    Base.metadata.create_all(bind=get_engine())
    Base.metadata.create_all(bind=get_engine())


# ==== Daily card một-chạm + streak ===================================


def test_daily_card_one_tap_creates_and_returns_streak(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "onetap@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        first = client.get("/api/daily-card", headers=headers)
        assert first.status_code == 200, first.text
        body = first.json()
        assert body["item"]["card_name"]
        assert body["item"]["orientation"] in {"upright", "reversed"}
        assert body["streak"]["current_streak"] == 1
        assert body["streak"]["total_draws"] == 1

        # Gọi lại cùng ngày -> get-or-create trả CÙNG lá, streak không tăng.
        second = client.get("/api/daily-card", headers=headers)
        assert second.status_code == 200
        assert second.json()["item"]["id"] == body["item"]["id"]
        assert second.json()["streak"]["current_streak"] == 1

    # /api/daily-card KHÔNG phá các route cũ.
    with TestClient(main_module.app) as client:
        _, token2 = _register_login(client, "onetap2@example.com")
        headers2 = {"Authorization": f"Bearer {token2}"}
        assert client.get("/api/daily-card/today", headers=headers2).status_code == 200
        assert client.get("/api/daily-card/streak", headers=headers2).status_code == 200


def test_daily_card_reflection_can_be_cleared(monkeypatch, tmp_path):
    """Gửi reflection rỗng phải XOÁ chiêm nghiệm cũ; không gửi field thì giữ nguyên."""
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "reflectclear@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        card_id = client.get("/api/daily-card", headers=headers).json()["item"]["id"]

        # 1) Lưu chiêm nghiệm ban đầu.
        saved = client.post(
            f"/api/daily-card/{card_id}/reflect",
            headers=headers,
            json={"reflection": "Hôm nay mình thấy bình an.", "mood_post": "joyful"},
        )
        assert saved.status_code == 200, saved.text
        assert saved.json()["reflection"] == "Hôm nay mình thấy bình an."
        assert saved.json()["mood_post"] == "joyful"

        # 2) Gửi reflection rỗng (kèm mood mới) → XOÁ chiêm nghiệm cũ, mood vẫn cập nhật.
        cleared = client.post(
            f"/api/daily-card/{card_id}/reflect",
            headers=headers,
            json={"reflection": "", "mood_post": "calm"},
        )
        assert cleared.status_code == 200, cleared.text
        assert not cleared.json()["reflection"]  # None hoặc rỗng — đã xoá
        assert cleared.json()["mood_post"] == "calm"

        # 3) KHÔNG gửi field reflection (chỉ cập nhật mood) → reflection giữ nguyên.
        client.post(
            f"/api/daily-card/{card_id}/reflect",
            headers=headers,
            json={"reflection": "Ghi chú mới", "mood_post": "hopeful"},
        )
        mood_only = client.post(
            f"/api/daily-card/{card_id}/reflect",
            headers=headers,
            json={"mood_post": "grateful"},
        )
        assert mood_only.status_code == 200, mood_only.text
        assert mood_only.json()["reflection"] == "Ghi chú mới"  # không bị xoá khi thiếu field
        assert mood_only.json()["mood_post"] == "grateful"


def test_daily_card_requires_auth(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        assert client.get("/api/daily-card").status_code == 401


# ==== Share image ====================================================


def test_daily_card_image_png_and_base64(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "img@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        card = client.get("/api/daily-card", headers=headers).json()["item"]
        date_key = card["draw_date"]

        png = client.get(f"/api/daily-card/{date_key}/image", headers=headers)
        assert png.status_code == 200, png.text
        assert png.headers["content-type"] == "image/png"
        assert png.content[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic

        b64 = client.get(f"/api/daily-card/{date_key}/image?format=base64", headers=headers)
        assert b64.status_code == 200
        assert b64.json()["image_base64"].startswith("data:image/png;base64,")


def test_daily_card_image_404_when_no_card(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "noimg@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        res = client.get("/api/daily-card/2099-01-01/image", headers=headers)
        assert res.status_code == 404


# ==== Notification preferences =======================================


def test_notification_preferences_get_default_and_update(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "pref@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        default = client.get("/api/notification-preferences", headers=headers).json()
        assert default["daily_card_enabled"] is True
        assert default["daily_card_hour"] == 8
        assert default["email_enabled"] is True

        updated = client.put(
            "/api/notification-preferences",
            headers=headers,
            json={"daily_card_hour": 20, "email_enabled": False, "timezone": "Asia/Tokyo"},
        )
        assert updated.status_code == 200, updated.text
        body = updated.json()
        assert body["daily_card_hour"] == 20
        assert body["email_enabled"] is False
        assert body["timezone"] == "Asia/Tokyo"

        # Giờ ngoài 0-23 bị Pydantic chặn (422).
        bad = client.put("/api/notification-preferences", headers=headers, json={"daily_card_hour": 99})
        assert bad.status_code == 422
        # Timezone rác -> 400 từ service.
        bad_tz = client.put(
            "/api/notification-preferences", headers=headers, json={"timezone": "Not/AZone"}
        )
        assert bad_tz.status_code == 400


# ==== Notifications feed + dispatch ==================================


def test_dispatch_in_app_only_when_no_smtp(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    from src.advanced.notifications import dispatch_notification
    with TestClient(main_module.app) as client:
        user_id, token = _register_login(client, "feed@example.com")
        headers = {"Authorization": f"Bearer {token}"}

        # Không cấu hình SMTP -> chỉ ghi in-app, status 'sent', KHÔNG ném.
        result = dispatch_notification(
            user_id=user_id, type="custom", title="Xin chào", body="Thân ái"
        )
        assert result["status"] == "sent"
        assert result["id"] is not None

        feed = client.get("/api/notifications", headers=headers).json()["items"]
        assert len(feed) == 1
        assert feed[0]["title"] == "Xin chào"
        assert feed[0]["status"] == "sent"

        notif_id = feed[0]["id"]
        read = client.post(f"/api/notifications/{notif_id}/read", headers=headers)
        assert read.status_code == 200
        assert read.json()["status"] == "read"


def test_dispatch_email_failure_marks_failed_not_raise(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    import src.advanced.notifications as notif_module
    # Bật SMTP "có cấu hình" nhưng ép send_email ném lỗi -> status 'failed', KHÔNG ném.
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "noreply@example.com")

    def _boom(**kwargs):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(notif_module, "send_email", _boom)
    with TestClient(main_module.app) as client:
        user_id, _ = _register_login(client, "fail@example.com")
        result = notif_module.dispatch_notification(
            user_id=user_id, type="daily_card", title="T", body="B"
        )
        assert result["status"] == "failed"  # không ném, chỉ đánh dấu failed


def test_mark_read_other_user_is_404(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    from src.advanced.notifications import dispatch_notification
    with TestClient(main_module.app) as client:
        owner_id, _ = _register_login(client, "owner@example.com")
        _, other_token = _register_login(client, "intruder@example.com")
        n = dispatch_notification(user_id=owner_id, type="custom", title="Riêng tư", body="x")
        res = client.post(
            f"/api/notifications/{n['id']}/read",
            headers={"Authorization": f"Bearer {other_token}"},
        )
        assert res.status_code == 404


# ==== Scheduler idempotency ==========================================


def test_daily_card_notification_idempotent_per_day(monkeypatch, tmp_path):
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    import src.advanced.notifications as notif_module
    from src.utils.timezone import get_app_timezone
    with TestClient(main_module.app) as client:
        _, token = _register_login(client, "sched@example.com")
        headers = {"Authorization": f"Bearer {token}"}
        # Đặt giờ thông báo = giờ địa phương HIỆN TẠI để job kích hoạt.
        current_hour = datetime.now(get_app_timezone()).hour
        client.put(
            "/api/notification-preferences",
            headers=headers,
            json={"daily_card_enabled": True, "daily_card_hour": current_hour},
        )

        stats1 = notif_module.process_daily_card_notifications()
        stats2 = notif_module.process_daily_card_notifications()
        assert stats1["created"] == 1
        assert stats2["created"] == 0  # idempotent: lần 2 bỏ qua

        feed = client.get("/api/notifications", headers=headers).json()["items"]
        daily = [n for n in feed if n["type"] == "daily_card"]
        assert len(daily) == 1  # tối đa 1 daily_card notif/ngày


# ==== Analytics funnel + track_event =================================


def test_track_event_swallows_errors(monkeypatch, tmp_path):
    _bootstrap(monkeypatch, tmp_path)
    import src.advanced.analytics as analytics

    # Ép session_scope ném -> track_event PHẢI nuốt lỗi, không raise.
    def _boom(*a, **k):
        raise RuntimeError("db down")

    monkeypatch.setattr(analytics, "session_scope", _boom)
    analytics.track_event(1, "should_not_raise", {"k": "v"})  # không được ném

    # Props không serialize được vẫn không làm vỡ (ghi với props_json=None).
    monkeypatch.undo()
    _bootstrap(monkeypatch, tmp_path)
    import src.advanced.analytics as analytics2
    analytics2.track_event(1, "weird_props", {"bad": object()})


def test_analytics_funnel_admin_only(monkeypatch, tmp_path):
    monkeypatch.setenv("ADMIN_EMAILS", "boss@example.com")
    main_module = _bootstrap(monkeypatch, tmp_path)
    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as client:
        # User thường -> 403.
        _, member_token = _register_login(client, "member@example.com")
        forbid = client.get(
            "/api/admin/analytics/funnel",
            headers={"Authorization": f"Bearer {member_token}"},
        )
        assert forbid.status_code == 403

        # Admin (email trong ADMIN_EMAILS) -> 200, có counts.
        _, admin_token = _register_login(client, "boss@example.com")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        # Tạo vài event: register đã ghi user_registered; xem daily-card ghi daily_card_viewed.
        client.get("/api/daily-card", headers=admin_headers)

        res = client.get("/api/admin/analytics/funnel", headers=admin_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "counts" in data and "retention" in data
        assert data["counts"].get("user_registered", 0) >= 1
        assert data["counts"].get("daily_card_viewed", 0) >= 1
        assert "d1" in data["retention"] and "d7" in data["retention"]
