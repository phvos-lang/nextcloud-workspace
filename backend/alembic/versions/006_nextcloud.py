"""Add Nextcloud per-user config columns

Revision ID: 006
Revises: 005
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa


revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("nc_url", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("nc_username", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("nc_password_enc", sa.String(1000), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "nc_password_enc")
    op.drop_column("users", "nc_username")
    op.drop_column("users", "nc_url")
