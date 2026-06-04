"""Add daily_deep_readings table (RAG+LLM deep reading cache per user/day/topic).

Tái dùng đúng kiểu create_all(checkfirst=True) như các revision advanced trước đó,
nên chỉ tạo bảng mới daily_deep_readings và idempotent trên DB đã bootstrap sẵn.

Revision ID: 20260603_000004
Revises: 20260602_000003
Create Date: 2026-06-03 00:00:00
"""
from __future__ import annotations

from alembic import op

from src.db.models import Base

# revision identifiers, used by Alembic.
revision = "20260603_000004"
down_revision = "20260602_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # checkfirst=True: chỉ tạo bảng mới daily_deep_readings; các bảng cũ đã tồn tại
    # sẽ bị bỏ qua.
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    table = Base.metadata.tables.get("daily_deep_readings")
    if table is not None:
        table.drop(bind=bind, checkfirst=True)
