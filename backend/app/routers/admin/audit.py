import csv
import io
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import require_admin
from app.models.audit import AuditLog
from app.models.user import User

router = APIRouter(prefix="/api/admin/audit", tags=["admin"])

ACTION_LABELS = {
    "session.start":   "Session started",
    "session.stop":    "Session stopped",
    "auth.login":      "Login",
    "auth.login_oidc": "Login (OIDC)",
    "app.create":      "App created",
    "app.update":      "App updated",
    "app.delete":      "App deleted",
    "user.role":       "Role changed",
}

ACTION_COLORS = {
    "session.start":   "text-green-400",
    "session.stop":    "text-gray-400",
    "auth.login":      "text-blue-400",
    "auth.login_oidc": "text-blue-400",
    "app.create":      "text-indigo-400",
    "app.update":      "text-yellow-400",
    "app.delete":      "text-red-400",
    "user.role":       "text-orange-400",
}


def _audit_query(
    action: str | None,
    user_id: str | None,
    q: str | None,
    date_from: str | None,
    date_to: str | None,
):
    stmt = (
        select(AuditLog, User.username, User.display_name)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.timestamp.desc())
    )
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            AuditLog.action.ilike(like),
            AuditLog.resource.ilike(like),
            AuditLog.detail.ilike(like),
            User.username.ilike(like),
            User.display_name.ilike(like),
        ))
    if date_from:
        stmt = stmt.where(AuditLog.timestamp >= datetime.fromisoformat(date_from))
    if date_to:
        # date-only input means "through the end of that day"
        end = datetime.fromisoformat(date_to)
        if len(date_to) == 10:
            end += timedelta(days=1)
        stmt = stmt.where(AuditLog.timestamp < end)
    return stmt


@router.get("")
async def list_audit(
    action: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    stmt = _audit_query(action, user_id, q, date_from, date_to).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return [
        {
            "id": str(e.id),
            "user_id": str(e.user_id) if e.user_id else None,
            "username": username or "(system)",
            "display_name": display_name or username or "(system)",
            "action": e.action,
            "action_label": ACTION_LABELS.get(e.action, e.action),
            "action_color": ACTION_COLORS.get(e.action, "text-gray-400"),
            "resource": e.resource,
            "detail": e.detail,
            "timestamp": e.timestamp.isoformat(),
        }
        for e, username, display_name in result.all()
    ]


@router.get("/export")
async def export_audit_csv(
    action: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    q: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """CSV export of the (filtered) audit log, capped at 10k rows."""
    stmt = _audit_query(action, user_id, q, date_from, date_to).limit(10_000)
    result = await session.execute(stmt)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["timestamp", "username", "action", "resource", "detail"])
    for e, username, _display in result.all():
        writer.writerow([e.timestamp.isoformat(), username or "(system)", e.action, e.resource, e.detail])
    buf.seek(0)

    fname = f"audit-{datetime.now().strftime('%Y%m%d-%H%M')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/actions")
async def list_actions(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Return distinct action types present in the log."""
    result = await session.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    return [r for r, in result.all()]
