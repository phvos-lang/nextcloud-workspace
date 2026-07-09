"""add storage_configs table

Revision ID: 003
Revises: 002
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storage_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("config_encrypted", sa.Text(), nullable=False),
        sa.Column("mount_path", sa.String(200), nullable=False, server_default="/media/storage"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "name"),
    )
    op.create_index("ix_storage_configs_user_id", "storage_configs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_storage_configs_user_id", "storage_configs")
    op.drop_table("storage_configs")
