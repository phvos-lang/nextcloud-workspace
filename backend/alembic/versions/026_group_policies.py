"""Per-group security policy flags (recording + DLP)

Revision ID: 026
Revises: 025
Create Date: 2026-07-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("policies", JSONB(), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("groups", "policies")
