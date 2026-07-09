"""Thin helper for writing audit log entries."""
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User

log = logging.getLogger(__name__)


async def audit(
    db: AsyncSession,
    *,
    action: str,
    resource: str,
    user: User | None = None,
    detail: str = "",
) -> None:
    """Write one audit log entry and flush (caller must commit)."""
    entry = AuditLog(
        user_id=user.id if user else None,
        action=action,
        resource=resource,
        detail=detail,
    )
    db.add(entry)
    try:
        await db.flush()
    except Exception:
        log.exception("audit flush failed for action=%s resource=%s", action, resource)

    # Best-effort forward to external syslog/SIEM (no-op unless configured).
    try:
        from app.services import siem
        await siem.forward(db, action=action, resource=resource,
                           username=(user.username if user else None), detail=detail)
    except Exception:
        log.debug("siem forward error", exc_info=True)
