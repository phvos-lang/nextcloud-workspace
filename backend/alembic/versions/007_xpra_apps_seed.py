"""Migrate app catalog from neko to xpra; seed default xpra apps

Revision ID: 007
Revises: 006
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None

_DEFAULT_APPS = [
    {
        "name": "Firefox",
        "description": "Mozilla Firefox web browser",
        "category": "Browsers",
        "icon_url": "/icons/firefox.svg",
        "app_type": "stream",
        "container_image": "lwp-firefox",
        "proxy_port": 8080,
        "cpu_limit": "2000m",
        "mem_limit": "2Gi",
        "shm_size": "256m",
    },
    {
        "name": "Chrome",
        "description": "Google Chrome web browser",
        "category": "Browsers",
        "icon_url": "/icons/chrome.svg",
        "app_type": "stream",
        "container_image": "lwp-chromium",
        "proxy_port": 8080,
        "cpu_limit": "2000m",
        "mem_limit": "2Gi",
        "shm_size": "256m",
    },
    {
        "name": "Thunderbird",
        "description": "Mozilla Thunderbird email client",
        "category": "Office",
        "icon_url": "/icons/thunderbird.svg",
        "app_type": "stream",
        "container_image": "lwp-thunderbird",
        "proxy_port": 8080,
        "cpu_limit": "1000m",
        "mem_limit": "1Gi",
        "shm_size": "64m",
    },
    {
        "name": "LibreOffice",
        "description": "LibreOffice productivity suite",
        "category": "Office",
        "icon_url": "/icons/libreoffice.svg",
        "app_type": "stream",
        "container_image": "lwp-libreoffice",
        "proxy_port": 8080,
        "cpu_limit": "2000m",
        "mem_limit": "2Gi",
        "shm_size": "64m",
    },
]


def upgrade() -> None:
    bind = op.get_bind()

    # Update existing apps whose container_image still references neko images
    bind.execute(sa.text("""
        UPDATE apps
        SET container_image = CASE
            WHEN name ILIKE '%firefox%'                           THEN 'lwp-firefox'
            WHEN name ILIKE '%chrome%' OR name ILIKE '%chromium%' THEN 'lwp-chromium'
            WHEN name ILIKE '%thunderbird%'                       THEN 'lwp-thunderbird'
            WHEN name ILIKE '%libreoffice%' OR name ILIKE '%libre office%' THEN 'lwp-libreoffice'
            ELSE container_image
        END
        WHERE container_image ILIKE '%neko%'
           OR container_image ILIKE '%lwp-neko%'
    """))

    # Seed default apps when the table is empty (fresh install)
    count = bind.execute(sa.text("SELECT COUNT(*) FROM apps")).scalar()
    if count == 0:
        for app in _DEFAULT_APPS:
            bind.execute(sa.text("""
                INSERT INTO apps
                    (id, name, description, category, icon_url, app_type,
                     container_image, proxy_port, cpu_limit, mem_limit, shm_size,
                     env_json, mount_home, is_enabled, is_deleted)
                VALUES
                    (gen_random_uuid(), :name, :description, :category, :icon_url,
                     :app_type, :container_image, :proxy_port,
                     :cpu_limit, :mem_limit, :shm_size,
                     '{}', true, true, false)
            """), app)


def downgrade() -> None:
    pass  # image name rollback is not meaningful
