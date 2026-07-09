"""Seed VSCodium, Headlamp, FileZilla, Remmina if missing

Revision ID: 016
Revises: 015
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None

# Matches app/services/seed.py PRESETS for these entries.
_NEW_APPS = [
    {
        "name": "VSCodium",
        "description": "VSCodium — open-source build of VS Code.",
        "category": "Development",
        "icon_url": "/icons/vscodium.svg",
        "app_type": "stream",
        "container_image": "lwp-vscodium:latest",
        "proxy_port": 8080,
        "cpu_limit": "1000m",
        "mem_limit": "1Gi",
        "shm_size": "256Mi",
        "mount_home": True,
    },
    {
        "name": "Headlamp",
        "description": "Headlamp — Kubernetes web UI desktop app.",
        "category": "Development",
        "icon_url": "/icons/headlamp.svg",
        "app_type": "stream",
        "container_image": "lwp-headlamp:latest",
        "proxy_port": 8080,
        "cpu_limit": "500m",
        "mem_limit": "512Mi",
        "shm_size": "256Mi",
        "mount_home": True,
    },
    {
        "name": "FileZilla",
        "description": "FileZilla — FTP/SFTP file transfer client.",
        "category": "Tools",
        "icon_url": "/icons/filezilla.svg",
        "app_type": "stream",
        "container_image": "lwp-filezilla:latest",
        "proxy_port": 8080,
        "cpu_limit": "500m",
        "mem_limit": "512Mi",
        "shm_size": "64Mi",
        "mount_home": True,
    },
    {
        "name": "Remmina",
        "description": "Remmina — remote desktop client (RDP/VNC).",
        "category": "Tools",
        "icon_url": "/icons/remmina.svg",
        "app_type": "stream",
        "container_image": "lwp-remmina:latest",
        "proxy_port": 8080,
        "cpu_limit": "500m",
        "mem_limit": "512Mi",
        "shm_size": "64Mi",
        "mount_home": True,
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    for app in _NEW_APPS:
        bind.execute(sa.text("""
            INSERT INTO apps
                (id, name, description, category, icon_url, app_type,
                 container_image, proxy_port, cpu_limit, mem_limit, shm_size,
                 env_json, mount_home, is_enabled, is_deleted)
            SELECT
                gen_random_uuid(), :name, :description, :category, :icon_url,
                :app_type, :container_image, :proxy_port,
                :cpu_limit, :mem_limit, :shm_size,
                '{}', :mount_home, true, false
            WHERE NOT EXISTS (SELECT 1 FROM apps WHERE name = :name)
        """), app)


def downgrade() -> None:
    bind = op.get_bind()
    for app in _NEW_APPS:
        bind.execute(
            sa.text("DELETE FROM apps WHERE name = :name AND container_image = :container_image"),
            {"name": app["name"], "container_image": app["container_image"]},
        )
