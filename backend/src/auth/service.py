from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from src.auth.security import _is_production, create_access_token, hash_password, verify_password
from src.db.models import User
from src.db.session import session_scope
from src.utils.validators import is_valid_email, normalize_email
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)


@dataclass
class AuthUser:
    id: int
    email: str
    role: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


def _admin_emails() -> set[str]:
    """Email được cấp quyền admin qua biến môi trường ADMIN_EMAILS (phân tách dấu phẩy)."""
    raw = os.getenv("ADMIN_EMAILS", "") or ""
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def _to_auth_user(user: User) -> AuthUser:
    # Bootstrap admin: email nằm trong ADMIN_EMAILS luôn được coi là admin. Tính lại mỗi lần
    # dựng user nên KHÔNG cần sửa DB và vẫn đúng kể cả khi DB bị reset. Đăng ký thường vẫn
    # chỉ là "member" (không tự phong admin được).
    role = "admin" if (user.email or "").strip().lower() in _admin_emails() else user.role
    return AuthUser(
        id=user.id,
        email=user.email,
        role=role,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
    )


def _normalize_username(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip().lower()
    return cleaned or None


def _validate_avatar_url(value: str | None) -> str | None:
    """Chỉ chấp nhận avatar_url scheme http/https; chặn 'javascript:'/'data:' (XSS khi render)."""
    cleaned = (value or "").strip()
    if not cleaned:
        return None
    from urllib.parse import urlparse

    if urlparse(cleaned).scheme.lower() not in {"http", "https"}:
        raise ValueError("avatar_url phải là đường dẫn http/https hợp lệ")
    return cleaned


def register_user(
    *,
    email: str,
    password: str,
    role: str = "member",
    username: str | None = None,
    display_name: str | None = None,
) -> AuthUser:
    clean_email = normalize_email(email)
    # KHÔNG strip() mật khẩu: '  abc  ' và 'abc' phải là hai mật khẩu khác nhau (giữ entropy).
    clean_password = password or ""
    clean_username = _normalize_username(username)
    if not is_valid_email(clean_email):
        raise ValueError("invalid email")
    if len(clean_password) < 6:
        raise ValueError("password must be at least 6 characters")
    if clean_username is not None and len(clean_username) < 3:
        raise ValueError("username must be at least 3 characters")

    with session_scope() as session:
        existing_email = session.scalar(
            select(User).where(func.lower(User.email) == clean_email)
        )
        if existing_email is not None:
            raise ValueError("email already exists")

        if clean_username:
            existing_username = session.scalar(
                select(User).where(User.username == clean_username)
            )
            if existing_username is not None:
                raise ValueError("username already exists")

        user = User(
            email=clean_email,
            username=clean_username,
            display_name=(display_name or clean_username or clean_email.split("@")[0]),
            password_hash=hash_password(clean_password),
            role=role or "member",
        )
        session.add(user)
        try:
            session.flush()
        except IntegrityError as exc:
            # Đua đăng ký cùng email/username → trả lỗi nghiệp vụ (400) thay vì HTTP 500.
            # Phân biệt nguyên nhân qua NỘI DUNG lỗi (không mở query mới trong transaction
            # đang hỏng — tránh "database is locked" trên SQLite). Mặc định coi như trùng email.
            detail = str(getattr(exc, "orig", exc)).lower()
            if clean_username and "username" in detail and "email" not in detail:
                raise ValueError("username already exists") from exc
            raise ValueError("email already exists") from exc
        return _to_auth_user(user)


def authenticate_user(*, email: str, password: str) -> tuple[AuthUser, str]:
    """Legacy email-only login giữ lại cho backward-compat (chuyển sang identifier)."""
    return authenticate_user_by_identifier(identifier=email, password=password)


def authenticate_user_by_identifier(
    *,
    identifier: str,
    password: str,
) -> tuple[AuthUser, str]:
    """Cho phép đăng nhập bằng username HOẶC email + password."""
    raw = (identifier or "").strip()
    # KHÔNG strip() mật khẩu khi xác thực — phải khớp đúng chuỗi lúc đăng ký/đặt lại.
    clean_password = password or ""
    if not raw:
        raise ValueError("missing username/email")

    lookup_email = raw.lower()
    lookup_username = raw.lower()

    with session_scope() as session:
        user = session.scalar(
            select(User).where(
                or_(
                    func.lower(User.email) == lookup_email,
                    User.username == lookup_username,
                )
            )
        )
        if user is None or not verify_password(clean_password, user.password_hash or ""):
            raise ValueError("invalid credentials")
        auth_user = _to_auth_user(user)

    token = create_access_token(user_id=auth_user.id, role=auth_user.role)
    return auth_user, token


def get_user_by_id(user_id: int) -> AuthUser | None:
    with session_scope() as session:
        user = session.scalar(select(User).where(User.id == user_id))
    if user is None:
        return None
    return _to_auth_user(user)


# =========================
# Password reset
# =========================

_RESET_TOKEN_TTL_MIN = int(os.getenv("RESET_TOKEN_TTL_MIN", "30"))


def _frontend_base_url() -> str:
    """URL gốc của frontend để dựng link đặt lại mật khẩu: lấy FRONTEND_BASE_URL; nếu trống
    thì dùng origin đầu tiên trong API_ALLOWED_ORIGINS. Trả "" nếu không có cấu hình nào."""
    explicit = os.getenv("FRONTEND_BASE_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    for origin in (os.getenv("API_ALLOWED_ORIGINS", "") or "").split(","):
        candidate = origin.strip().rstrip("/")
        if candidate:
            return candidate
    return ""


def _reset_email_html(*, link: str | None, token: str, minutes: int) -> str:
    """Bản HTML cho email đặt lại mật khẩu (inline CSS để hợp mọi email client)."""
    if link:
        action = (
            f'<a href="{link}" '
            'style="display:inline-block;padding:14px 28px;border-radius:10px;'
            "background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;"
            'font-size:15px;">Đặt lại mật khẩu</a>'
            f'<p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">'
            f'Nếu nút không bấm được, sao chép liên kết này vào trình duyệt:<br>'
            f'<span style="color:#a78bfa;word-break:break-all;">{link}</span></p>'
        )
    else:
        action = (
            '<p style="margin:0 0 6px;font-size:13px;color:#9ca3af;">Mã đặt lại của bạn:</p>'
            f'<p style="margin:0;padding:12px 16px;border-radius:8px;background:#1f2937;'
            'color:#a78bfa;font-family:monospace;font-size:18px;letter-spacing:1px;'
            f'word-break:break-all;">{token}</p>'
        )
    return (
        '<div style="margin:0;padding:32px 16px;background:#0b1020;">'
        '<div style="max-width:480px;margin:0 auto;padding:36px 32px;border-radius:16px;'
        'background:#11162a;font-family:Arial,Helvetica,sans-serif;color:#e5e7eb;">'
        '<h1 style="margin:0 0 4px;font-size:22px;color:#c4b5fd;letter-spacing:2px;">CATAROT</h1>'
        '<p style="margin:0 0 24px;font-size:12px;color:#6b7280;">Đặt lại mật khẩu</p>'
        '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;">'
        'Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản CATAROT. '
        f'Yêu cầu này sẽ hết hạn sau <strong>{minutes} phút</strong>.</p>'
        f'<div style="margin:0 0 24px;">{action}</div>'
        '<hr style="border:none;border-top:1px solid #1f2937;margin:24px 0;">'
        '<p style="margin:0;font-size:12px;color:#6b7280;line-height:1.6;">'
        'Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu sẽ không thay đổi.</p>'
        '</div></div>'
    )


def _send_reset_email(*, to_email: str, token: str, expires_at: datetime) -> None:
    """Gửi email link đặt lại mật khẩu. BEST-EFFORT: nuốt mọi lỗi (kể cả email chưa cấu hình)
    để KHÔNG lộ email có tồn tại hay không và không làm hỏng luồng forgot-password.
    Có link nếu biết FRONTEND_BASE_URL; nếu không thì gửi mã token để dán vào trang đặt lại."""
    try:
        from src.utils.email import email_configured, send_email

        if not email_configured():
            LOGGER.info("Bỏ qua gửi email đặt lại mật khẩu: chưa cấu hình kênh gửi (Resend/SMTP).")
            return

        minutes = _RESET_TOKEN_TTL_MIN
        base = _frontend_base_url()
        link = f"{base}/reset-password?token={token}" if base else None
        if link:
            body = (
                "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản CATAROT.\n\n"
                f"Nhấp vào liên kết sau để đặt mật khẩu mới (hết hạn sau {minutes} phút):\n{link}\n\n"
                "Nếu không phải bạn yêu cầu, hãy bỏ qua email này — mật khẩu sẽ không thay đổi."
            )
        else:
            body = (
                "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản CATAROT.\n\n"
                f"Mã đặt lại (hết hạn sau {minutes} phút):\n{token}\n\n"
                "Nhập mã này vào trang đặt lại mật khẩu. Nếu không phải bạn, hãy bỏ qua email này."
            )
        send_email(
            to_email=to_email,
            subject="Đặt lại mật khẩu CATAROT",
            body=body,
            html=_reset_email_html(link=link, token=token, minutes=minutes),
        )
    except Exception as exc:  # best-effort: không để lỗi gửi email nổi ra ngoài
        LOGGER.warning("Gửi email đặt lại mật khẩu thất bại: %s", str(exc))


def send_reset_email(*, to_email: str, token: str, expires_at: datetime) -> None:
    """Wrapper công khai để endpoint lên lịch gửi email đặt lại MK ở BackgroundTask (best-effort)."""
    _send_reset_email(to_email=to_email, token=token, expires_at=expires_at)


@dataclass
class PasswordResetRequest:
    found: bool
    dev_token: str | None
    expires_at: datetime | None
    # (to_email, token, expires) để endpoint gửi email ở NỀN; None khi không tìm thấy user.
    pending_email: tuple[str, str, datetime] | None


def request_password_reset(*, email: str) -> PasswordResetRequest:
    """Sinh reset token cho email. KHÔNG gửi email đồng bộ trong hàm này.

    Lý do tách gửi email: gửi email (mạng, tới ~15s) chỉ xảy ra khi email TỒN TẠI →
    tạo chênh lệch thời gian phản hồi giúp dò xem email có tồn tại không (enumeration).
    Endpoint lên lịch gửi qua BackgroundTask nên thời gian phản hồi gần như nhau ở cả hai
    trường hợp. `dev_token` chỉ khác None khi EXPOSE_RESET_TOKEN_IN_RESPONSE=true VÀ KHÔNG
    phải production.
    """
    clean_email = normalize_email(email)
    if not is_valid_email(clean_email):
        return PasswordResetRequest(found=False, dev_token=None, expires_at=None, pending_email=None)

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=_RESET_TOKEN_TTL_MIN)

    with session_scope() as session:
        user = session.scalar(
            select(User).where(func.lower(User.email) == clean_email)
        )
        if user is None:
            return PasswordResetRequest(found=False, dev_token=None, expires_at=None, pending_email=None)
        user.reset_token = token
        user.reset_token_expires_at = expires

    expose = os.getenv("EXPOSE_RESET_TOKEN_IN_RESPONSE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if expose and _is_production():
        # Chặn rò token qua response trên production (chiếm tài khoản không cần email).
        LOGGER.warning(
            "EXPOSE_RESET_TOKEN_IN_RESPONSE đang bật ở PRODUCTION — bỏ qua để không lộ token."
        )
        expose = False

    return PasswordResetRequest(
        found=True,
        dev_token=(token if expose else None),
        expires_at=expires,
        pending_email=(clean_email, token, expires),
    )


def reset_password_with_token(*, token: str, new_password: str) -> None:
    # KHÔNG strip() mật khẩu mới: giữ nguyên ký tự người dùng chọn (gồm khoảng trắng đầu/cuối).
    clean_password = new_password or ""
    if len(clean_password) < 6:
        raise ValueError("password must be at least 6 characters")

    now = datetime.now(timezone.utc)
    with session_scope() as session:
        user = session.scalar(select(User).where(User.reset_token == token))
        if user is None or not user.reset_token_expires_at:
            raise ValueError("invalid token")

        expires = user.reset_token_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            raise ValueError("token expired")

        user.password_hash = hash_password(clean_password)
        user.reset_token = None
        user.reset_token_expires_at = None


# =========================
# Google OAuth
# =========================


def authenticate_with_google(*, id_token_str: str) -> tuple[AuthUser, str]:
    """Verify Google id_token, create/login user, trả AuthUser + JWT."""
    client_id = (os.getenv("GOOGLE_CLIENT_ID", "") or "").strip()
    if not client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured")

    try:
        from google.auth.transport import requests as google_requests  # type: ignore
        from google.oauth2 import id_token as google_id_token  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "google-auth library not installed; run: pip install google-auth"
        ) from exc

    try:
        info = google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            audience=client_id,
        )
    except ValueError as exc:
        raise ValueError(f"invalid google id_token: {exc}") from exc

    google_sub = str(info.get("sub", "")).strip()
    email = normalize_email(info.get("email", ""))
    if not google_sub or not email:
        raise ValueError("google id_token missing sub/email")

    name = (info.get("name") or "").strip() or None
    picture = (info.get("picture") or "").strip() or None

    with session_scope() as session:
        user = session.scalar(select(User).where(User.google_id == google_sub))
        if user is None:
            user = session.scalar(
                select(User).where(func.lower(User.email) == email)
            )

        if user is None:
            user = User(
                email=email,
                google_id=google_sub,
                display_name=name or email.split("@")[0],
                avatar_url=picture,
                role="member",
            )
            session.add(user)
            try:
                session.flush()
            except IntegrityError as exc:
                # Đua đăng nhập Google lần đầu (2 tab) → lỗi nghiệp vụ để client thử lại,
                # thay vì IntegrityError lọt thành HTTP 500.
                raise ValueError(
                    "Đăng nhập Google gặp xung đột tài khoản, vui lòng thử lại."
                ) from exc
        else:
            if not user.google_id:
                user.google_id = google_sub
            if not user.avatar_url and picture:
                user.avatar_url = picture
            if not user.display_name and name:
                user.display_name = name

        auth_user = _to_auth_user(user)

    token = create_access_token(user_id=auth_user.id, role=auth_user.role)
    return auth_user, token


# =========================
# Profile update
# =========================


@dataclass
class ProfileUpdatePayload:
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    username: str | None = None


def update_user_profile(*, user_id: int, payload: ProfileUpdatePayload) -> AuthUser:
    with session_scope() as session:
        user = session.scalar(select(User).where(User.id == user_id))
        if user is None:
            raise ValueError("user not found")

        if payload.display_name is not None:
            user.display_name = payload.display_name.strip() or None
        if payload.avatar_url is not None:
            user.avatar_url = _validate_avatar_url(payload.avatar_url)
        if payload.bio is not None:
            user.bio = payload.bio.strip() or None
        if payload.username is not None:
            new_username = _normalize_username(payload.username)
            if new_username and new_username != user.username:
                if len(new_username) < 3:
                    raise ValueError("username must be at least 3 characters")
                duplicate = session.scalar(
                    select(User).where(
                        User.username == new_username,
                        User.id != user.id,
                    )
                )
                if duplicate is not None:
                    raise ValueError("username already exists")
                user.username = new_username

        session.flush()
        return _to_auth_user(user)
