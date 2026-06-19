from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select

from src.auth.security import create_access_token, hash_password, verify_password
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


def register_user(
    *,
    email: str,
    password: str,
    role: str = "member",
    username: str | None = None,
    display_name: str | None = None,
) -> AuthUser:
    clean_email = normalize_email(email)
    clean_password = (password or "").strip()
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
        session.flush()
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
    clean_password = (password or "").strip()
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


def _send_reset_email(*, to_email: str, token: str, expires_at: datetime) -> None:
    """Gửi email link đặt lại mật khẩu. BEST-EFFORT: nuốt mọi lỗi (kể cả SMTP chưa cấu hình)
    để KHÔNG lộ email có tồn tại hay không và không làm hỏng luồng forgot-password.
    Có link nếu biết FRONTEND_BASE_URL; nếu không thì gửi mã token để dán vào trang đặt lại."""
    try:
        from src.utils.email import send_email, smtp_configured

        if not smtp_configured():
            LOGGER.info("Bỏ qua gửi email đặt lại mật khẩu: SMTP chưa cấu hình.")
            return

        minutes = _RESET_TOKEN_TTL_MIN
        base = _frontend_base_url()
        if base:
            link = f"{base}/reset-password?token={token}"
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
        )
    except Exception as exc:  # best-effort: không để lỗi SMTP nổi ra ngoài
        LOGGER.warning("Gửi email đặt lại mật khẩu thất bại: %s", str(exc))


def request_password_reset(*, email: str) -> tuple[bool, str | None, datetime | None]:
    """Sinh reset token cho email. Trả (found, token_if_dev, expires_at).

    `token_if_dev` chỉ trả về khi EXPOSE_RESET_TOKEN_IN_RESPONSE=true để dev test.
    Production gửi qua email.
    """
    clean_email = normalize_email(email)
    if not is_valid_email(clean_email):
        return False, None, None

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(minutes=_RESET_TOKEN_TTL_MIN)

    with session_scope() as session:
        user = session.scalar(
            select(User).where(func.lower(User.email) == clean_email)
        )
        if user is None:
            return False, None, None
        user.reset_token = token
        user.reset_token_expires_at = expires

    # Gửi email chứa link đặt lại (best-effort; degrade an toàn nếu chưa cấu hình SMTP).
    _send_reset_email(to_email=clean_email, token=token, expires_at=expires)

    expose = os.getenv("EXPOSE_RESET_TOKEN_IN_RESPONSE", "false").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    return True, (token if expose else None), expires


def reset_password_with_token(*, token: str, new_password: str) -> None:
    clean_password = (new_password or "").strip()
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
            session.flush()
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
            user.avatar_url = payload.avatar_url.strip() or None
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
