"""Seed default per-role session limits into settings table

Revision ID: 010
Revises: 009
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    for key, value, description in [
        (
            "session_limit.admin",
            "10",
            "Maximum concurrent sessions for admin users",
        ),
        (
            "session_limit.user",
            "3",
            "Maximum concurrent sessions for regular users",
        ),
    ]:
        bind.execute(sa.text("""
            INSERT INTO settings (key, value, description)
            VALUES (:key, :value, :description)
            ON CONFLICT (key) DO NOTHING
        """), {"key": key, "value": value, "description": description})


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text(
        "DELETE FROM settings WHERE key IN ('session_limit.admin', 'session_limit.user')"
    ))
