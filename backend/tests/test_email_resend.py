"""Test module gửi email dùng chung: định tuyến Resend → SMTP → lỗi khi chưa cấu hình.

Không gọi mạng thật: monkeypatch `requests.post` (Resend) và `smtplib.SMTP` (fallback).
"""
from __future__ import annotations

import smtplib

import pytest

from src.utils import email as email_mod

_ENV_KEYS = (
    "RESEND_API_KEY",
    "RESEND_FROM",
    "SMTP_HOST",
    "SMTP_FROM",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "SMTP_USE_TLS",
    "SMTP_PORT",
)


@pytest.fixture(autouse=True)
def _clean_email_env(monkeypatch):
    """Mỗi test bắt đầu với môi trường email trống để khỏi rò cấu hình giữa các test."""
    for key in _ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    yield


class _FakeResp:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text


# ---------------------------------------------------------------------------
# Cờ cấu hình
# ---------------------------------------------------------------------------


def test_email_not_configured_by_default():
    assert email_mod.resend_configured() is False
    assert email_mod.smtp_configured() is False
    assert email_mod.email_configured() is False


def test_resend_configured_requires_key_and_sender(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_123")
    assert email_mod.resend_configured() is False  # thiếu người gửi
    monkeypatch.setenv("RESEND_FROM", "CATAROT <no-reply@catarot.me>")
    assert email_mod.resend_configured() is True
    assert email_mod.email_configured() is True


def test_resend_from_falls_back_to_smtp_from(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_123")
    monkeypatch.setenv("SMTP_FROM", "no-reply@catarot.me")
    assert email_mod.resend_configured() is True


# ---------------------------------------------------------------------------
# Định tuyến gửi
# ---------------------------------------------------------------------------


def test_send_email_uses_resend_when_configured(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_secret")
    monkeypatch.setenv("RESEND_FROM", "CATAROT <no-reply@catarot.me>")

    captured: dict = {}

    def _fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return _FakeResp(200, '{"id":"abc"}')

    monkeypatch.setattr("requests.post", _fake_post)

    email_mod.send_email(
        to_email="user@example.com",
        subject="Đặt lại mật khẩu CATAROT",
        body="text body",
        html="<b>html body</b>",
    )

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer re_secret"
    assert captured["json"]["from"] == "CATAROT <no-reply@catarot.me>"
    assert captured["json"]["to"] == ["user@example.com"]
    assert captured["json"]["text"] == "text body"
    assert captured["json"]["html"] == "<b>html body</b>"


def test_send_email_resend_api_error_raises(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_secret")
    monkeypatch.setenv("RESEND_FROM", "no-reply@catarot.me")

    monkeypatch.setattr(
        "requests.post",
        lambda *a, **k: _FakeResp(422, "invalid from address"),
    )

    with pytest.raises(RuntimeError, match="Resend API error 422"):
        email_mod.send_email(to_email="u@example.com", subject="s", body="b")


def test_send_email_falls_back_to_smtp(monkeypatch):
    # Không có Resend, chỉ có SMTP → dùng SMTP.
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "no-reply@catarot.me")

    sent: dict = {}

    class _FakeSMTP:
        def __init__(self, host=None, port=None, timeout=None):
            sent["host"] = host
            sent["port"] = port

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            sent["tls"] = True

        def login(self, username, password):
            sent["login"] = (username, password)

        def send_message(self, msg):
            sent["subject"] = msg["Subject"]
            sent["to"] = msg["To"]

    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    email_mod.send_email(to_email="user@example.com", subject="Hi", body="body")

    assert sent["host"] == "smtp.example.com"
    assert sent["to"] == "user@example.com"
    assert sent["subject"] == "Hi"
    assert sent.get("tls") is True


def test_send_email_smtp_includes_html_alternative(monkeypatch):
    """Nhánh html của _send_via_smtp phải đính kèm phần HTML (msg.add_alternative)."""
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "no-reply@catarot.me")

    captured: dict = {}

    class _FakeSMTP:
        def __init__(self, host=None, port=None, timeout=None):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            pass

        def login(self, username, password):
            pass

        def send_message(self, msg):
            captured["msg"] = msg

    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    email_mod.send_email(
        to_email="user@example.com", subject="Hi", body="text", html="<b>body</b>"
    )

    msg = captured["msg"]
    html_part = msg.get_body(preferencelist=("html",))
    assert html_part is not None
    assert "<b>body</b>" in html_part.get_content()


def test_send_email_smtp_port_465_uses_implicit_tls(monkeypatch):
    """Cổng 465 phải dùng SMTP_SSL và KHÔNG gọi starttls()."""
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM", "no-reply@catarot.me")
    monkeypatch.setenv("SMTP_PORT", "465")

    used: dict = {"ssl": False, "plain": False, "starttls": False}

    class _FakeSMTPSSL:
        def __init__(self, host=None, port=None, timeout=None):
            used["ssl"] = True
            used["port"] = port

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def login(self, username, password):
            pass

        def send_message(self, msg):
            pass

    class _FakeSMTP:
        def __init__(self, *a, **k):
            used["plain"] = True

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def starttls(self):
            used["starttls"] = True

        def login(self, *a, **k):
            pass

        def send_message(self, msg):
            pass

    monkeypatch.setattr(smtplib, "SMTP_SSL", _FakeSMTPSSL)
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)

    email_mod.send_email(to_email="user@example.com", subject="Hi", body="text")

    assert used["ssl"] is True
    assert used["port"] == 465
    assert used["plain"] is False
    assert used["starttls"] is False


def test_send_email_raises_when_unconfigured():
    with pytest.raises(RuntimeError, match="Email chưa cấu hình"):
        email_mod.send_email(to_email="u@example.com", subject="s", body="b")


def test_send_email_rejects_empty_recipient(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_secret")
    monkeypatch.setenv("RESEND_FROM", "no-reply@catarot.me")
    with pytest.raises(RuntimeError, match="recipient email is empty"):
        email_mod.send_email(to_email="  ", subject="s", body="b")


# ---------------------------------------------------------------------------
# HTML email đặt lại mật khẩu
# ---------------------------------------------------------------------------


def test_reset_email_html_with_link_has_button():
    from src.auth.service import _reset_email_html

    html = _reset_email_html(
        link="https://catarot.me/reset-password?token=abc", token="abc", minutes=30
    )
    assert "https://catarot.me/reset-password?token=abc" in html
    assert "Đặt lại mật khẩu" in html
    assert "30 phút" in html


def test_reset_email_html_without_link_shows_code():
    from src.auth.service import _reset_email_html

    html = _reset_email_html(link=None, token="SECRET-CODE-123", minutes=15)
    assert "SECRET-CODE-123" in html
    assert "Mã đặt lại" in html
    assert "15 phút" in html
