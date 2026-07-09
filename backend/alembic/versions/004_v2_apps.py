"""v2: apps table replaces images, update sessions

Revision ID: 004
Revises: 003
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Apps catalog ─────────────────────────────────────────────────────────
    op.create_table(
        "apps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(100), nullable=False, server_default="General"),
        sa.Column("icon_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("app_type", sa.String(20), nullable=False, server_default="stream"),
        sa.Column("container_image", sa.String(500), nullable=True),
        sa.Column("web_url", sa.String(500), nullable=True),
        sa.Column("proxy_port", sa.Integer(), nullable=False, server_default="8080"),
        sa.Column("cpu_limit", sa.String(20), nullable=False, server_default="2000m"),
        sa.Column("mem_limit", sa.String(20), nullable=False, server_default="2Gi"),
        sa.Column("shm_size", sa.String(20), nullable=False, server_default="1Gi"),
        sa.Column("env_json", postgresql.JSON(), nullable=False, server_default="{}"),
        sa.Column("mount_home", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_apps_category", "apps", ["category"])

    # ── App permissions ───────────────────────────────────────────────────────
    op.create_table(
        "app_permissions",
        sa.Column("app_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("apps.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
        sa.UniqueConstraint("app_id", "group_id"),
    )

    # ── Sessions: legacy image_id → nullable (replaced by app_id) ───────────
    op.alter_column("sessions", "image_id", nullable=True, existing_type=postgresql.UUID(as_uuid=True))

    # ── Sessions: add v2 columns ──────────────────────────────────────────────
    op.add_column("sessions", sa.Column(
        "app_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("apps.id"), nullable=True,
    ))
    op.add_column("sessions", sa.Column("app_type", sa.String(20), nullable=False, server_default="stream"))
    op.add_column("sessions", sa.Column("proxy_port", sa.Integer(), nullable=False, server_default="8080"))
    op.add_column("sessions", sa.Column("upstream_host", sa.String(253), nullable=False, server_default=""))
    op.add_column("sessions", sa.Column("window_state", postgresql.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("sessions", "window_state")
    op.drop_column("sessions", "upstream_host")
    op.drop_column("sessions", "proxy_port")
    op.drop_column("sessions", "app_type")
    op.drop_column("sessions", "app_id")
    op.alter_column("sessions", "image_id", nullable=False, existing_type=postgresql.UUID(as_uuid=True))
    op.drop_table("app_permissions")
    op.drop_index("ix_apps_category", "apps")
    op.drop_table("apps")
