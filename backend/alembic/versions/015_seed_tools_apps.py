"""Seed Tools apps (Terminal, Terminator, SSHPilot) if missing

Revision ID: 015
Revises: 014
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None

# Matches app/services/seed.py PRESETS for these Tools entries.
_TOOLS_APPS = [
    {
        "name": "Terminal",
        "description": "Lightweight web terminal (bash, no desktop overhead).",
        "category": "Tools",
        "icon_url": "/icons/terminal.svg",
        "app_type": "stream",
        "container_image": "lwp-terminal:latest",
        "proxy_port": 7681,
        "cpu_limit": "200m",
        "mem_limit": "256Mi",
        "shm_size": "0",
        "mount_home": False,
    },
    {
        "name": "Terminator",
        "description": "Terminator terminal emulator (X11 desktop).",
        "category": "Tools",
        "icon_url": "/icons/terminal.svg",
        "app_type": "stream",
        "container_image": "lwp-terminator:latest",
        "proxy_port": 8080,
        "cpu_limit": "500m",
        "mem_limit": "512Mi",
        "shm_size": "256Mi",
        "mount_home": True,
    },
    {
        "name": "SSHPilot",
        "description": "SSHPilot — GUI SSH client for managing remote connections.",
        "category": "Tools",
        "icon_url": "/icons/sshpilot.svg",
        "app_type": "stream",
        "container_image": "lwp-sshpilot:latest",
        "proxy_port": 8080,
        "cpu_limit": "500m",
        "mem_limit": "512Mi",
        "shm_size": "256Mi",
        "mount_home": True,
    },
]


def upgrade() -> None:
    bind = op.get_bind()
    for app in _TOOLS_APPS:
        # Insert only if no app with this name exists (idempotent; leaves any
        # admin-created/customised app of the same name untouched).
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
    for app in _TOOLS_APPS:
        bind.execute(
            sa.text("DELETE FROM apps WHERE name = :name AND container_image = :container_image"),
            {"name": app["name"], "container_image": app["container_image"]},
        )
