"""Add web_native flag to apps + tag the web-native apps

Revision ID: 023
Revises: 022
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None

# Apps that serve their own web UI (no VNC/desktop).
_WEB_APPS = ("Terminal", "VS Code", "k9s", "htop", "JupyterLab", "pgweb")


def upgrade() -> None:
    op.add_column("apps", sa.Column("web_native", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.get_bind().execute(
        sa.text("UPDATE apps SET web_native = true WHERE name = ANY(:names)"),
        {"names": list(_WEB_APPS)},
    )


def downgrade() -> None:
    op.drop_column("apps", "web_native")
