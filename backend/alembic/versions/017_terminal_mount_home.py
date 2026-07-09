"""Enable persistent home volume for the Terminal app

Revision ID: 017
Revises: 016
Create Date: 2026-07-01
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        "UPDATE apps SET mount_home = true "
        "WHERE name = 'Terminal' AND container_image = 'lwp-terminal:latest'"
    ))


def downgrade() -> None:
    op.get_bind().execute(sa.text(
        "UPDATE apps SET mount_home = false "
        "WHERE name = 'Terminal' AND container_image = 'lwp-terminal:latest'"
    ))
