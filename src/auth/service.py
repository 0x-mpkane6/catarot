from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select

from src.auth.security import create_access_token, hash_password, verify_password
from src.db.models import User
from src.db.session import session_scope


@dataclass
class AuthUser:
    id: int
    email: str
    role: str


def register_user(*, email: str, password: str, role: str = "member") -> AuthUser:
    clean_email = (email or "").strip().lower()
    clean_password = (password or "").strip()
    if not clean_email or "@" not in clean_email:
        raise ValueError("invalid email")
    if len(clean_password) < 6:
        raise ValueError("password must be at least 6 characters")

    with session_scope() as session:
        existing = session.scalar(select(User).where(func.lower(User.email) == clean_email))
        if existing is not None:
            raise ValueError("email already exists")
        user = User(
            email=clean_email,
            password_hash=hash_password(clean_password),
            role=role or "member",
        )
        session.add(user)
        session.flush()
        return AuthUser(id=user.id, email=user.email, role=user.role)


def authenticate_user(*, email: str, password: str) -> tuple[AuthUser, str]:
    clean_email = (email or "").strip().lower()
    clean_password = (password or "").strip()

    with session_scope() as session:
        user = session.scalar(select(User).where(func.lower(User.email) == clean_email))
        if user is None or not verify_password(clean_password, user.password_hash):
            raise ValueError("invalid credentials")
        auth_user = AuthUser(id=user.id, email=user.email, role=user.role)

    token = create_access_token(user_id=auth_user.id, role=auth_user.role)
    return auth_user, token


def get_user_by_id(user_id: int) -> AuthUser | None:
    with session_scope() as session:
        user = session.scalar(select(User).where(User.id == user_id))
    if user is None:
        return None
    return AuthUser(id=user.id, email=user.email, role=user.role)

