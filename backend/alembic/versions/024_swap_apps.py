"""Remove Chromium/k9s/VS Code (code-server); add Vivaldi

Revision ID: 024
Revises: 023
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None

# Soft-delete (keep rows so existing sessions' FK stays valid).
_REMOVE = ("Chromium", "k9s", "VS Code")


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text("UPDATE apps SET is_enabled = false, is_deleted = true WHERE name = ANY(:names)"),
        {"names": list(_REMOVE)},
    )
    bind.execute(sa.text("""
        INSERT INTO apps
            (id, name, description, category, icon_url, app_type,
             container_image, proxy_port, cpu_limit, mem_limit, shm_size,
             env_json, mount_home, web_native, is_enabled, is_deleted)
        SELECT gen_random_uuid(), 'Vivaldi', 'Vivaldi browser.', 'Browsers',
               '/icons/vivaldi.svg', 'stream', 'lwp-vivaldi:latest', 8080,
               '2000m', '2Gi', '1Gi', '{}', true, false, true, false
        WHERE NOT EXISTS (SELECT 1 FROM apps WHERE name = 'Vivaldi')
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM apps WHERE name = 'Vivaldi'"))
    bind.execute(
        sa.text("UPDATE apps SET is_enabled = true, is_deleted = false WHERE name = ANY(:names)"),
        {"names": list(_REMOVE)},
    )
