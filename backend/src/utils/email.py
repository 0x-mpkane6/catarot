"""Helper gửi email dùng chung. Hỗ trợ 2 kênh, ưu tiên theo thứ tự:

1. **Resend API (HTTPS)** — nếu có `RESEND_API_KEY` + người gửi (`RESEND_FROM`/`SMTP_FROM`).
   Gửi qua cổng 443 nên KHÔNG bị các nền tảng (vd HuggingFace Space) chặn cổng SMTP
   outbound. Khuyến nghị cho production.
2. **SMTP (smtplib)** — fallback nếu chưa có Resend nhưng có `SMTP_HOST` + `SMTP_FROM`.

Nhiều nơi (notifications, rating, đặt lại mật khẩu) cùng gọi `send_email`. Người gọi
tự bọc try/except để best-effort khi cần (vd dispatch_notification, _send_reset_email),
KHÔNG để lỗi gửi làm hỏng luồng chính.
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

import requests

from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}

_RESEND_API_URL = "https://api.resend.com/emails"
_EMAIL_TIMEOUT = 15.0  # giây — socket timeout cho SMTP (fallback)
# (connect, read) cho Resend HTTP: connect 5s để FAIL NHANH khi Resend không kết nối được,
# tránh giữ slot threadpool (dùng chung với /api/ask, /api/tts) quá lâu.
_RESEND_TIMEOUT = (5.0, 10.0)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in _BOOL_TRUE


def _smtp_port() -> int:
    try:
        return int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        return 587


def _sender() -> str:
    """Địa chỉ người gửi. Ưu tiên RESEND_FROM (cho phép định dạng "Tên <email>"),
    fallback SMTP_FROM để tái dùng cấu hình cũ."""
    return (os.getenv("RESEND_FROM", "").strip() or os.getenv("SMTP_FROM", "").strip())


def resend_configured() -> bool:
    """True nếu đủ cấu hình gửi qua Resend (API key + người gửi)."""
    return bool(os.getenv("RESEND_API_KEY", "").strip() and _sender())


def smtp_configured() -> bool:
    """True nếu đủ cấu hình SMTP tối thiểu (host + from) để thử gửi."""
    return bool(os.getenv("SMTP_HOST", "").strip() and os.getenv("SMTP_FROM", "").strip())


def email_configured() -> bool:
    """True nếu có BẤT KỲ kênh gửi email nào (Resend hoặc SMTP) đã cấu hình."""
    return resend_configured() or smtp_configured()


def _send_via_resend(*, to_email: str, subject: str, body: str, html: str | None) -> None:
    """Gửi qua Resend REST API. Ném RuntimeError khi API trả lỗi để người gọi xử lý."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    payload: dict = {
        "from": _sender(),
        "to": [to_email],
        "subject": subject,
        "text": body,
    }
    if html:
        payload["html"] = html

    resp = requests.post(
        _RESEND_API_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=_RESEND_TIMEOUT,
    )
    if resp.status_code >= 400:
        # Không log nội dung email; chỉ log mã + đoạn đầu lỗi để chẩn đoán cấu hình.
        raise RuntimeError(f"Resend API error {resp.status_code}: {resp.text[:300]}")


def _send_via_smtp(*, to_email: str, subject: str, body: str, html: str | None) -> None:
    host = os.getenv("SMTP_HOST", "").strip()
    sender = os.getenv("SMTP_FROM", "").strip()
    username = os.getenv("SMTP_USERNAME", "").strip()
    password = os.getenv("SMTP_PASSWORD", "")
    use_tls = _as_bool(os.getenv("SMTP_USE_TLS", "true"), default=True)

    if not host or not sender:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_FROM missing).")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")

    port = _smtp_port()
    # Cổng 465 = implicit TLS (SMTPS): bắt tay TLS ngay khi kết nối, KHÔNG gọi starttls().
    # Cổng khác (587/25) = plaintext rồi nâng cấp qua starttls() nếu bật SMTP_USE_TLS.
    if port == 465:
        with smtplib.SMTP_SSL(host=host, port=port, timeout=_EMAIL_TIMEOUT) as server:
            if username:
                server.login(username, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host=host, port=port, timeout=_EMAIL_TIMEOUT) as server:
            if use_tls:
                server.starttls()
            if username:
                server.login(username, password)
            server.send_message(msg)


def send_email(*, to_email: str, subject: str, body: str, html: str | None = None) -> None:
    """Gửi 1 email (text + tuỳ chọn HTML). Tự chọn kênh: Resend trước, SMTP sau.

    Ném RuntimeError nếu chưa cấu hình kênh nào / thiếu người nhận. Người gọi
    (vd dispatch_notification, _send_reset_email) tự bọc try/except để best-effort.
    """
    if not (to_email or "").strip():
        raise RuntimeError("recipient email is empty")

    if resend_configured():
        _send_via_resend(to_email=to_email, subject=subject, body=body, html=html)
        return
    if smtp_configured():
        _send_via_smtp(to_email=to_email, subject=subject, body=body, html=html)
        return

    raise RuntimeError(
        "Email chưa cấu hình: cần RESEND_API_KEY + RESEND_FROM (khuyến nghị) "
        "hoặc SMTP_HOST + SMTP_FROM."
    )
