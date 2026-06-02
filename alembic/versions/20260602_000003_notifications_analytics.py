"""Add notifications, notification_preferences and analytics_events tables.

Phase-1 retention + measurement. Reuses the same create_all(checkfirst=True)
style as the baseline advanced revision so it only materializes the new tables
and is idempotent against an already-bootstrapped DB.

Revision ID: 20260602_000003
Revises: 20260428_000002
Create Date: 2026-06-02 00:00:00
"""
from __future__ import annotations

from alembic import op

from src.db.models import Base

# revision identifiers, used by Alembic.
revision = "20260602_000003"
down_revision = "20260428_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # checkfirst=True: chỉ tạo các bảng mới (notification_preferences,
    # notifications, analytics_events); các bảng cũ đã tồn tại sẽ bị bỏ qua.
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    for table_name in ("analytics_events", "notifications", "notification_preferences"):
        table = Base.metadata.tables.get(table_name)
        if table is not None:
            table.drop(bind=bind, checkfirst=True)
