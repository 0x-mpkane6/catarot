from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

_DEFAULT_JWT_SECRET = "change_me_in_production_min_32_chars"
_INSECURE_JWT_SECRETS = {
    "",
    _DEFAULT_JWT_SECRET,
    "change_me",
    "change_me_in_production",
    "secret",
    "changeme",
}
_BOOL_TRUE = {"1", "true", "yes", "y", "on"}


def _is_production() -> bool:
    env = os.getenv("APP_ENV", "").strip().lower()
    if env in {"prod", "production"}:
        return True
    if os.getenv("PRODUCTION", "").strip().lower() in _BOOL_TRUE:
        return True
    return False


def _jwt_secret() -> str:
    raw = (os.getenv("JWT_SECRET_KEY", "") or "").strip()
    if _is_production():
        if not raw or raw in _INSECURE_JWT_SECRETS or len(raw) < 32:
            raise RuntimeError(
                "JWT_SECRET_KEY is missing, insecure, or shorter than 32 characters in production. "
                "Set APP_ENV=production and a strong JWT_SECRET_KEY in your deployment environment. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return raw
    # Development: warn nhưng không chặn để dev không bị tắc.
    if not raw or raw in _INSECURE_JWT_SECRETS:
        return _DEFAULT_JWT_SECRET
    return raw


def _jwt_algorithm() -> str:
    return os.getenv("JWT_ALGORITHM", "HS256").strip() or "HS256"


def _jwt_expire_minutes() -> int:
    try:
        return max(5, int(os.getenv("JWT_EXPIRE_MINUTES", "120")))
    except ValueError:
        return 120


def hash_password(password: str) -> str:
    clean = (password or "").encode("utf-8")
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", clean, salt, 200_000)
    return f"pbkdf2_sha256${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    clean = (password or "").encode("utf-8")
    parts = (stored or "").split("$")
    if len(parts) != 3 or parts[0] != "pbkdf2_sha256":
        return False
    try:
        salt = base64.b64decode(parts[1].encode())
        expected = base64.b64decode(parts[2].encode())
    except Exception:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", clean, salt, 200_000)
    return hmac.compare_digest(digest, expected)


def create_access_token(*, user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=_jwt_expire_minutes())).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_jwt_algorithm())


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, _jwt_secret(), algorithms=[_jwt_algorithm()])
