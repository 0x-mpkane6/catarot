"""add user profile fields (username, avatar, bio, google, reset)

Revision ID: 1504d6078546
Revises: 42bf1088f295
Create Date: 2026-05-22 19:30:28.674992

Thêm các cột mới vào bảng users để hỗ trợ:
- username (login bằng username HOẶC email)
- display_name, avatar_url, bio (user profile)
- google_id (Google OAuth)
- reset_token, reset_token_expires_at (forgot-password flow)

Đồng thời chuyển password_hash thành NULLABLE để hỗ trợ tài khoản tạo qua Google
(không có password local).

Idempotent: skip cột đã tồn tại để chạy được trên DB cũ đã ALTER bằng tay.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1504d6078546"
down_revision: Union[str, None] = "42bf1088f295"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_COLUMNS: dict[str, sa.types.TypeEngine] = {
    "username": sa.String(length=64),
    "display_name": sa.String(length=120),
    "avatar_url": sa.String(length=512),
    "bio": sa.Text(),
    "google_id": sa.String(length=255),
    "reset_token": sa.String(length=255),
    "reset_token_expires_at": sa.DateTime(timezone=True),
}

_NEW_INDEXES: dict[str, tuple[str, bool]] = {
    # name -> (column, unique)
    "ix_users_username": ("username", True),
    "ix_users_google_id": ("google_id", True),
    "ix_users_reset_token": ("reset_token", True),
}


def _existing(inspector_method: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector_method == "columns":
        return {col["name"] for col in inspector.get_columns("users")}
    if inspector_method == "indexes":
        return {idx["name"] for idx in inspector.get_indexes("users")}
    return set()


def upgrade() -> None:
    existing_cols = _existing("columns")
    with op.batch_alter_table("users") as batch_op:
        for name, col_type in _NEW_COLUMNS.items():
            if name in existing_cols:
                continue
            batch_op.add_column(sa.Column(name, col_type, nullable=True))

    existing_indexes = _existing("indexes")
    for name, (column, unique) in _NEW_INDEXES.items():
        if name in existing_indexes:
            continue
        op.create_index(name, "users", [column], unique=unique)


def downgrade() -> None:
    existing_indexes = _existing("indexes")
    for name in _NEW_INDEXES:
        if name in existing_indexes:
            op.drop_index(name, table_name="users")

    existing_cols = _existing("columns")
    with op.batch_alter_table("users") as batch_op:
        for name in _NEW_COLUMNS:
            if name in existing_cols:
                batch_op.drop_column(name)
