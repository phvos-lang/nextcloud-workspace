"""Seed web-native apps (VS Code / k9s / htop) if missing

Revision ID: 021
Revises: 020
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None

_APPS = [
    ("VS Code", "VS Code in the browser (code-server) — no desktop, fast and native.",
     "Development", "/icons/code-server.svg", "lwp-code-server:latest", 8080, "1000m", "1Gi", "0", True),
    ("k9s", "k9s — Kubernetes TUI in the browser (uses your ~/.kube).",
     "Development", "/icons/k9s.svg", "lwp-k9s:latest", 7681, "300m", "256Mi", "0", True),
    ("htop", "htop — system monitor in the browser.",
     "Tools", "/icons/htop.svg", "lwp-htop:latest", 7681, "200m", "128Mi", "0", False),
]


def upgrade() -> None:
    bind = op.get_bind()
    for name, desc, cat, icon, image, port, cpu, mem, shm, mount in _APPS:
        bind.execute(sa.text("""
            INSERT INTO apps
                (id, name, description, category, icon_url, app_type,
                 container_image, proxy_port, cpu_limit, mem_limit, shm_size,
                 env_json, mount_home, is_enabled, is_deleted)
            SELECT gen_random_uuid(), :name, :desc, :cat, :icon, 'stream',
                   :image, :port, :cpu, :mem, :shm, '{}', :mount, true, false
            WHERE NOT EXISTS (SELECT 1 FROM apps WHERE name = :name)
        """), {"name": name, "desc": desc, "cat": cat, "icon": icon, "image": image,
               "port": port, "cpu": cpu, "mem": mem, "shm": shm, "mount": mount})


def downgrade() -> None:
    bind = op.get_bind()
    for name, *_ in _APPS:
        bind.execute(sa.text("DELETE FROM apps WHERE name = :name"), {"name": name})
