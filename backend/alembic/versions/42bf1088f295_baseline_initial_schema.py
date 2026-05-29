"""baseline initial schema

Revision ID: 42bf1088f295
Revises: 
Create Date: 2026-05-22 19:10:54.148940

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '42bf1088f295'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Idempotent baseline: create only missing tables using Base.metadata.

    Sử dụng Base.metadata.create_all() để xử lý cả DB trống lẫn DB legacy
    đã có một số bảng (vd: bảng users từ MVP cũ). SQLAlchemy create_all
    bỏ qua bảng đã tồn tại nên migration này an toàn để stamp/upgrade trên
    môi trường đang chạy.
    """
    from src.db.models import Base

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    """Drop tất cả bảng trong metadata. Cẩn thận: mất toàn bộ dữ liệu."""
    from src.db.models import Base

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
