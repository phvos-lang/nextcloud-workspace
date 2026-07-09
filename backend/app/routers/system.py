from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user
from app.models.settings import Setting
from app.models.user import User

router = APIRouter(prefix="/api/system", tags=["system"])

_KEYS = [
    "announcement.text", "announcement.level",
    "maintenance.enabled", "maintenance.message",
    "broadcast.message", "broadcast.level", "broadcast.ts",
]


async def read_settings(session: AsyncSession) -> dict:
    result = await session.execute(select(Setting).where(Setting.key.in_(_KEYS)))
    return {s.key: s.value for s in result.scalars()}


@router.get("/status")
async def system_status(
    _: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Announcement banner + maintenance state for the current user."""
    rows = await read_settings(session)
    return {
        "announcement": rows.get("announcement.text", ""),
        "announcement_level": rows.get("announcement.level", "info"),
        "maintenance": rows.get("maintenance.enabled", "false") == "true",
        "maintenance_message": rows.get("maintenance.message", ""),
        # One-shot admin broadcast — clients toast when ts changes
        "broadcast": rows.get("broadcast.message", ""),
        "broadcast_level": rows.get("broadcast.level", "info"),
        "broadcast_ts": rows.get("broadcast.ts", ""),
    }
