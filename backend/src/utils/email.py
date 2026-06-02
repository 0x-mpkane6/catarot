"""Helper SMTP dùng chung (tách từ pattern _send_rating_email trong rating_reminders.py).

Mục đích: nhiều nơi (notifications, oracle, rating) cùng gửi email text thuần qua
SMTP với CÙNG bộ env var. Gom về một chỗ để tái dùng, thay đổi tối thiểu — KHÔNG
sửa rating_reminders.py để tránh rủi ro với test hiện có.
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _BOOL_TRUE


def _smtp_port() -> int:
    try:
        return int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        return 587


def smtp_configured() -> bool:
    """True nếu đủ cấu hình SMTP tối thiểu (host + from) để thử gửi."""
    return bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip())


def send_email(*, to_email: str, subject: str, body: str) -> None:
    """Gửi 1 email text thuần. Ném RuntimeError nếu chưa cấu hình SMTP / thiếu người nhận.

    Người gọi (vd dispatch_notification) tự bọc try/except để best-effort, không để
    lỗi SMTP làm hỏng luồng chính.
    """
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls = _as_bool(os.getenv("SMTP_USE_TLS", "true"), default=True)

    if not host or not sender:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_FROM missing).")
    if not (to_email or "").strip():
        raise RuntimeError("recipient email is empty")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(host=host, port=_smtp_port(), timeout=15) as server:
        if use_tls:
            server.starttls()
        if username:
            server.login(username, password)
        server.send_message(msg)
