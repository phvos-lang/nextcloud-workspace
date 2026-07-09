"""Migrate legacy kasm/webtop apps to stream type on port 8080

Revision ID: 009
Revises: 008
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None

# linuxserver/webtop images → our KasmVNC images
_IMAGE_MAP = [
    ("%firefox%",    "lwp-firefox"),
    ("%chrome%",     "lwp-chromium"),
    ("%chromium%",   "lwp-chromium"),
    ("%thunderbird%","lwp-thunderbird"),
    ("%libreoffice%","lwp-libreoffice"),
    ("%libre%",      "lwp-libreoffice"),
]


def upgrade() -> None:
    bind = op.get_bind()

    # Update container_image for any linuxserver/webtop-style images
    for pattern, new_image in _IMAGE_MAP:
        bind.execute(sa.text(
            "UPDATE apps SET container_image = :img "
            "WHERE (container_image ILIKE '%linuxserver%' "
            "   OR  container_image ILIKE '%webtop%' "
            "   OR  container_image ILIKE '%kasm%') "
            "  AND (name ILIKE :pat OR container_image ILIKE :pat)"
        ), {"img": new_image, "pat": pattern})

    # Convert kasm app_type → stream, fix port 3000 → 8080
    bind.execute(sa.text(
        "UPDATE apps SET app_type = 'stream', proxy_port = 8080 "
        "WHERE app_type = 'kasm'"
    ))


def downgrade() -> None:
    pass
