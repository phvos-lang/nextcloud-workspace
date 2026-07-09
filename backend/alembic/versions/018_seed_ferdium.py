"""Seed Ferdium app if missing

Revision ID: 018
Revises: 017
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text("""
        INSERT INTO apps
            (id, name, description, category, icon_url, app_type,
             container_image, proxy_port, cpu_limit, mem_limit, shm_size,
             env_json, mount_home, is_enabled, is_deleted)
        SELECT
            gen_random_uuid(), 'Ferdium',
            'Ferdium — all your messaging services in one app.',
            'Internet', '/icons/ferdium.svg', 'stream',
            'lwp-ferdium:latest', 8080, '1000m', '1Gi', '256Mi',
            '{}', true, true, false
        WHERE NOT EXISTS (SELECT 1 FROM apps WHERE name = 'Ferdium')
    """))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "DELETE FROM apps WHERE name = 'Ferdium' AND container_image = 'lwp-ferdium:latest'"
    ))
