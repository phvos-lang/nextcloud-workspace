"""add auth_source and password_hash to users

Revision ID: 002
Revises: 001
Create Date: 2026-06-27
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("auth_source", sa.String(20), nullable=False, server_default="oidc"))
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
    op.drop_column("users", "auth_source")
