from __future__ import annotations

import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt


def _jwt_secret() -> str:
    default_secret = "change_me_in_production_min_32_chars"
    return os.getenv("JWT_SECRET_KEY", default_secret).strip() or default_secret


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
