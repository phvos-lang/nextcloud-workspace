"""Track VPN tunnel state on gateway sessions (taskbar indicator)

Revision ID: 027
Revises: 026
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("vpn_connected", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("sessions", "vpn_connected")
