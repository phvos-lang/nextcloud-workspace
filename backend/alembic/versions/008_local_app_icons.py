"""Use local icon files instead of external Wikipedia URLs

Revision ID: 008
Revises: 007
Create Date: 2026-06-29
"""
from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None

_ICON_MAP = [
    ("firefox",     "/icons/firefox.svg"),
    ("chrome",      "/icons/chrome.svg"),
    ("thunderbird", "/icons/thunderbird.svg"),
    ("libreoffice", "/icons/libreoffice.svg"),
]


def upgrade() -> None:
    for name_part, new_url in _ICON_MAP:
        op.execute(
            f"UPDATE apps SET icon_url = '{new_url}' "
            f"WHERE LOWER(name) LIKE '%{name_part}%' "
            f"   OR icon_url ILIKE '%{name_part}%'"
        )


def downgrade() -> None:
    pass
