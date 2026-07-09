"""Add per-group quotas (max_sessions, cpu/mem ceilings)

Revision ID: 020
Revises: 019
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("max_sessions", sa.Integer(), nullable=True))
    op.add_column("groups", sa.Column("cpu_limit", sa.String(20), nullable=True))
    op.add_column("groups", sa.Column("mem_limit", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("groups", "mem_limit")
    op.drop_column("groups", "cpu_limit")
    op.drop_column("groups", "max_sessions")
