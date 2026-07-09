"""Add build_jobs table

Revision ID: 005
Revises: 004
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "build_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("image_tag", sa.String(500), nullable=False),
        sa.Column("registry_url", sa.String(500), nullable=True),
        sa.Column("registry_username", sa.String(200), nullable=True),
        sa.Column("registry_password_enc", sa.Text, nullable=True),
        sa.Column("dockerfile", sa.Text, nullable=False),
        sa.Column("entrypoint", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("build_log", sa.Text, server_default="", nullable=False),
        sa.Column("app_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("apps.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("build_jobs")
