from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import require_admin
from app.models.settings import Setting
from app.models.user import User

router = APIRouter(prefix="/api/admin/settings", tags=["admin"])


@router.get("")
async def list_settings(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Setting).order_by(Setting.key))
    return [{"key": s.key, "value": s.value, "description": s.description} for s in result.scalars()]


@router.put("")
async def update_settings(
    body: dict,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    for key, value in body.items():
        result = await session.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = str(value)
        else:
            session.add(Setting(key=key, value=str(value)))
    await session.commit()
    if any(k.startswith("siem.") for k in body):
        from app.services import siem
        siem.invalidate_cache()
    if any(k.startswith("security.") for k in body):
        from app.services import security_gate
        security_gate.invalidate_cache()
    return {"ok": True}


@router.post("/broadcast")
async def broadcast(
    body: dict,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """One-shot message to all active desktops (clients poll /api/system/status
    and toast when broadcast.ts changes)."""
    message = (body.get("message") or "").strip()
    if not message:
        return {"ok": False, "detail": "message required"}
    level = body.get("level") if body.get("level") in ("info", "warning", "critical") else "info"
    values = {
        "broadcast.message": message[:500],
        "broadcast.level": level,
        "broadcast.ts": datetime.now(UTC).isoformat(),
    }
    for key, value in values.items():
        result = await session.execute(select(Setting).where(Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            session.add(Setting(key=key, value=value))
    from app.services import audit as audit_svc
    await audit_svc.audit(
        session, action="admin.broadcast", user=admin,
        resource="system", detail=f"level={level} msg={message[:100]}",
    )
    await session.commit()
    return {"ok": True}


@router.post("/siem/test")
async def siem_test(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Send a test event to the configured SIEM/syslog target."""
    from app.services import siem
    siem.invalidate_cache()
    cfg = await siem._get_cfg(session)
    if not cfg["enabled"]:
        return {"ok": False, "detail": "SIEM forwarding is disabled"}
    try:
        await siem._deliver(cfg, {
            "ts": datetime.now(UTC).isoformat(),
            "action": "siem.test", "user": "admin",
            "resource": "siem", "detail": "test event from Nextcloud Linux Workspace",
        })
        return {"ok": True, "detail": f"Sent via {cfg['protocol']} to {cfg['host'] or cfg['http_url']}"}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)}
