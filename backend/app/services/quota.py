"""Per-group quota resolution. A user gets the most generous value across all
their groups; cpu/mem act as ceilings that clamp an app's resource request."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Group, UserGroup


def cpu_to_millis(s: str | None) -> int:
    s = (s or "").strip()
    if not s:
        return 0
    try:
        return int(s[:-1]) if s.endswith("m") else int(float(s) * 1000)
    except ValueError:
        return 0


def mem_to_bytes(s: str | None) -> int:
    from app.services.container import _parse_size
    try:
        return _parse_size(s) if s else 0
    except Exception:
        return 0


async def effective_quota(db: AsyncSession, user_id) -> tuple[int | None, str | None, str | None]:
    """(max_sessions, cpu_ceiling, mem_ceiling) — most generous across the user's
    groups. Any of them None means "no group-specific limit"."""
    rows = (await db.execute(
        select(Group.max_sessions, Group.cpu_limit, Group.mem_limit)
        .join(UserGroup, UserGroup.group_id == Group.id)
        .where(UserGroup.user_id == user_id)
    )).all()
    max_sessions: int | None = None
    cpu: str | None = None
    mem: str | None = None
    for ms, c, m in rows:
        if ms is not None:
            max_sessions = ms if max_sessions is None else max(max_sessions, ms)
        if c and (cpu is None or cpu_to_millis(c) > cpu_to_millis(cpu)):
            cpu = c
        if m and (mem is None or mem_to_bytes(m) > mem_to_bytes(mem)):
            mem = m
    return max_sessions, cpu, mem
