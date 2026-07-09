"""Drop legacy images + image_permissions tables

images/image_permissions were the pre-v2 app catalog (before migration 004
introduced the apps table). All routes, models, and code referencing Image
have been removed. sessions.image_id (nullable FK, orphaned since 004) is
also dropped here.

Revision ID: 013
Revises: 012
Create Date: 2026-06-30
"""
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sessions.image_id: nullable FK to images.id, unused since migration 004
    op.drop_constraint("sessions_image_id_fkey", "sessions", type_="foreignkey")
    op.drop_column("sessions", "image_id")

    # image_permissions must go before images (FK dependency)
    op.drop_table("image_permissions")
    op.drop_table("images")


def downgrade() -> None:
    # Restore tables (empty — data is gone)
    import sqlalchemy as sa
    from sqlalchemy.dialects import postgresql

    op.create_table(
        "images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000), nullable=False, server_default=""),
        sa.Column("registry_tag", sa.String(500), nullable=False),
        sa.Column("category", sa.String(100), nullable=False, server_default="General"),
        sa.Column("icon_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("cpu_limit", sa.String(20), nullable=False, server_default="2000m"),
        sa.Column("mem_limit", sa.String(20), nullable=False, server_default="2Gi"),
        sa.Column("shm_size", sa.String(20), nullable=False, server_default="1Gi"),
        sa.Column("vnc_port", sa.Integer(), nullable=False, server_default="3000"),
        sa.Column("persistent_home", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("extra_env", sa.String(5000), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "image_permissions",
        sa.Column("image_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("images.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
        sa.UniqueConstraint("image_id", "group_id"),
    )
    op.add_column("sessions", sa.Column(
        "image_id", postgresql.UUID(as_uuid=True),
        sa.ForeignKey("images.id"), nullable=True,
    ))
