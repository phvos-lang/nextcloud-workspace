import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import require_admin
from app.models.session import Session
from app.models.user import User
from app.services import audit as audit_svc
from app.services import container as container_svc
from app.services.auth_local import hash_password

router = APIRouter(prefix="/api/admin/users", tags=["admin"])


async def _stop_user_sessions(session: AsyncSession, user_id: uuid.UUID) -> int:
    """Stop all running/starting containers for a user. Returns count stopped."""
    result = await session.execute(
        select(Session).where(
            Session.user_id == user_id,
            Session.status.in_(["starting", "running", "suspended"]),
        )
    )
    sessions = result.scalars().all()
    for sess in sessions:
        if sess.app_type != "web":
            try:
                await container_svc.stop(sess.pod_name, sess.service_name)
            except Exception:
                pass
        sess.status = "stopped"
        sess.ended_at = datetime.now(UTC)
    return len(sessions)


class UserUpdate(BaseModel):
    display_name: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None


class UserCreate(BaseModel):
    username: str
    email: str
    display_name: str = ""
    password: str
    is_admin: bool = False


class SetPassword(BaseModel):
    password: str


@router.get("")
async def list_users(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    return [_user_out(u) for u in result.scalars().all()]


@router.post("")
async def create_user(
    body: UserCreate,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Create a local-auth user. Only useful when 'local' is in AUTH_METHODS."""
    existing = await session.execute(
        select(User).where(
            (User.username == body.username.lower()) | (User.email == body.email.lower())
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already exists")

    user = User(
        username=body.username.lower(),
        email=body.email.lower(),
        display_name=body.display_name or body.username,
        auth_source="local",
        password_hash=hash_password(body.password),
        is_admin=body.is_admin,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return _user_out(user)


@router.get("/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_out(user)


@router.put("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    await session.commit()
    return _user_out(user)


@router.post("/{user_id}/set-password")
async def set_password(
    user_id: uuid.UUID,
    body: SetPassword,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Set or reset a local-auth user's password."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.auth_source not in ("local",):
        raise HTTPException(status_code=400, detail=f"User auth_source is '{user.auth_source}', not 'local'")
    if not body.password or len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user.password_hash = hash_password(body.password)
    await session.commit()
    return {"ok": True}


@router.post("/sign-out-all")
async def sign_out_all(
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Revoke every user's browser session (bumps all token_versions). Signs the
    admin out too. Running desktops are left alone."""
    await session.execute(update(User).values(token_version=User.token_version + 1))
    await audit_svc.audit(session, action="admin.sign_out_all", user=admin, resource="users:*")
    await session.commit()
    return {"ok": True}


@router.post("/{user_id}/force-logout")
async def force_logout(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Kick a user out of all browsers (bumps token_version). Desktops keep running."""
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.token_version += 1
    await audit_svc.audit(session, action="admin.force_logout", user=admin, resource=f"user:{user.id}")
    await session.commit()
    return {"ok": True}


@router.post("/{user_id}/stop-sessions")
async def stop_sessions(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Stop all of a user's running desktops."""
    result = await session.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")
    n = await _stop_user_sessions(session, user_id)
    await audit_svc.audit(session, action="admin.stop_sessions", user=admin,
                          resource=f"user:{user_id}", detail=f"stopped {n}")
    await session.commit()
    return {"stopped": n}


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Delete a user, after stopping their desktops. Blocks self-delete and
    deleting the last admin."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        admin_count = await session.scalar(
            select(func.count()).select_from(User).where(User.is_admin == True, User.is_active == True)  # noqa: E712
        )
        if (admin_count or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    await _stop_user_sessions(session, user_id)
    await audit_svc.audit(session, action="admin.delete_user", user=admin,
                          resource=f"user:{user_id}", detail=user.username)
    await session.delete(user)
    await session.commit()
    return {"ok": True}


def _user_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "username": u.username,
        "display_name": u.display_name,
        "auth_source": u.auth_source,
        "is_active": u.is_active,
        "is_admin": u.is_admin,
        "created_at": u.created_at.isoformat(),
    }
