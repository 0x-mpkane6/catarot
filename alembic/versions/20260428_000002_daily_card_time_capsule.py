"""Add daily_cards and time_capsules tables for unique features.

Revision ID: 20260428_000002
Revises: 20260410_000001
Create Date: 2026-04-28 00:00:00
"""
from __future__ import annotations

from alembic import op

from src.db.models import Base

# revision identifiers, used by Alembic.
revision = "20260428_000002"
down_revision = "20260410_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # create_all is checkfirst=True; previous revision already created legacy
    # tables, so this revision only materializes the two new tables.
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.tables["time_capsules"].drop(bind=bind, checkfirst=True)
    Base.metadata.tables["daily_cards"].drop(bind=bind, checkfirst=True)
