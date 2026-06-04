"""Add dream_entries.interpretation_json (RAG/LLM dream interpretation, nullable).

Cột nullable lưu object JSON diễn giải tổng hợp giấc mơ (summary_interpretation,
main_theme, emotional_tone, reflection_questions, suggested_action,
recent_reading_connections, llm_model, source, warnings). Idempotent: chỉ thêm cột
nếu chưa có (runtime cũng tự thêm qua _apply_lightweight_migrations). Giấc mơ cũ -> NULL.

Revision ID: 20260603_000005
Revises: 20260603_000004
Create Date: 2026-06-04 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260603_000005"
down_revision = "20260603_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in sa.inspect(bind).get_columns("dream_entries")}
    if "interpretation_json" not in existing:
        op.add_column("dream_entries", sa.Column("interpretation_json", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    existing = {col["name"] for col in sa.inspect(bind).get_columns("dream_entries")}
    if "interpretation_json" in existing:
        with op.batch_alter_table("dream_entries") as batch_op:
            batch_op.drop_column("interpretation_json")
