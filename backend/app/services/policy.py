"""Per-group security policy resolution. Unlike quotas (most generous wins),
policies are restrictive: any group that sets a flag applies it to the user.

Known flags:
  record_sessions    — record the X display of every desktop session
  disable_download   — block file downloads out of the workspace
  disable_upload     — block file uploads into the workspace
  disable_clipboard  — block the clipboard bridge
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Group, UserGroup

FLAGS = ("record_sessions", "disable_download", "disable_upload", "disable_clipboard")


async def effective_policy(db: AsyncSession, user_id) -> dict[str, bool]:
    rows = await db.execute(
        select(Group.policies)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user_id)
    )
    merged = {f: False for f in FLAGS}
    for (pol,) in rows.all():
        for f in FLAGS:
            if (pol or {}).get(f):
                merged[f] = True
    return merged
