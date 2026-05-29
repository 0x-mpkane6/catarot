from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, WebSocket
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.auth.security import decode_access_token
from src.auth.service import AuthUser, get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: int
    email: str
    role: str
    username: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


def _current_user_from_token(token: str) -> CurrentUser:
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid token") from exc

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="invalid token payload")

    try:
        user_id = int(str(sub))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid token payload") from exc

    user: AuthUser | None = get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="user not found")
    return CurrentUser(
        id=user.id,
        email=user.email,
        role=user.role,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="missing bearer token")
    return _current_user_from_token(credentials.credentials)


def get_current_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="admin role required")
    return current_user


def resolve_optional_user_id(request: Request | None) -> int | None:
    """Lấy user_id từ Bearer token nếu hợp lệ; None nếu thiếu/không hợp lệ.

    Dùng cho các endpoint cho phép cả khách lẫn user đăng nhập. KHÔNG tin user_id
    do client tự khai trong body/form → tránh ghi đè lịch sử/nhắc nhở của user khác.
    """
    if request is None:
        return None
    header = request.headers.get("Authorization", "") or ""
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    if not token:
        return None
    try:
        return _current_user_from_token(token).id
    except HTTPException:
        return None


def get_websocket_user(websocket: WebSocket) -> CurrentUser:
    token = websocket.query_params.get("token", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="missing websocket token")
    return _current_user_from_token(token)

