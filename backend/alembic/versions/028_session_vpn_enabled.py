"""Per-window VPN routing toggle on client sessions (relay mode)

Revision ID: 028
Revises: 027
Create Date: 2026-07-05
"""
from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NULL = session launched without VPN plumbing (no gateway running).
    op.add_column(
        "sessions",
        sa.Column("vpn_enabled", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sessions", "vpn_enabled")
