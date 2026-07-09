"""Seed JupyterLab + pgweb (web-native) if missing

Revision ID: 022
Revises: 021
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None

_APPS = [
    ("JupyterLab", "JupyterLab notebooks in the browser (no desktop).",
     "Development", "/icons/jupyterlab.svg", "lwp-jupyterlab:latest", "1000m", "1Gi"),
    ("pgweb", "pgweb — PostgreSQL web client (connect via the UI).",
     "Development", "/icons/pgweb.svg", "lwp-pgweb:latest", "300m", "256Mi"),
]


def upgrade() -> None:
    bind = op.get_bind()
    for name, desc, cat, icon, image, cpu, mem in _APPS:
        bind.execute(sa.text("""
            INSERT INTO apps
                (id, name, description, category, icon_url, app_type,
                 container_image, proxy_port, cpu_limit, mem_limit, shm_size,
                 env_json, mount_home, is_enabled, is_deleted)
            SELECT gen_random_uuid(), :name, :desc, :cat, :icon, 'stream',
                   :image, 8080, :cpu, :mem, '0', '{}', true, true, false
            WHERE NOT EXISTS (SELECT 1 FROM apps WHERE name = :name)
        """), {"name": name, "desc": desc, "cat": cat, "icon": icon,
               "image": image, "cpu": cpu, "mem": mem})


def downgrade() -> None:
    bind = op.get_bind()
    for name, *_ in _APPS:
        bind.execute(sa.text("DELETE FROM apps WHERE name = :name"), {"name": name})
