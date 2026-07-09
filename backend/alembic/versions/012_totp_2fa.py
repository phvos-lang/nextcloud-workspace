"""Add TOTP 2FA columns to users

Revision ID: 012
Revises: 011
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret_enc", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("totp_pending_enc", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "totp_pending_enc")
    op.drop_column("users", "totp_secret_enc")
