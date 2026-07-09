import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import require_admin
from app.models.user import Group, User, UserGroup
from app.services import policy as policy_svc

router = APIRouter(prefix="/api/admin/groups", tags=["admin"])


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    max_sessions: int | None = None
    cpu_limit: str | None = None
    mem_limit: str | None = None
    policies: dict = {}


@router.get("")
async def list_groups(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).order_by(Group.name))
    return [_out(g) for g in result.scalars().all()]


@router.post("", status_code=201)
async def create_group(
    body: GroupCreate,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    group = Group(
        name=body.name, description=body.description,
        max_sessions=body.max_sessions,
        cpu_limit=(body.cpu_limit or None), mem_limit=(body.mem_limit or None),
        policies=_clean_policies(body.policies),
    )
    session.add(group)
    await session.commit()
    await session.refresh(group)
    return _out(group)


@router.put("/{group_id}")
async def update_group(
    group_id: uuid.UUID,
    body: GroupCreate,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.name = body.name
    group.description = body.description
    group.max_sessions = body.max_sessions
    group.cpu_limit = body.cpu_limit or None
    group.mem_limit = body.mem_limit or None
    group.policies = _clean_policies(body.policies)
    await session.commit()
    return _out(group)


@router.delete("/{group_id}")
async def delete_group(
    group_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    await session.delete(group)
    await session.commit()
    return {"ok": True}


@router.get("/{group_id}/members")
async def list_members(
    group_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(User)
        .join(UserGroup, User.id == UserGroup.user_id)
        .where(UserGroup.group_id == group_id)
    )
    return [{"id": str(u.id), "email": u.email, "display_name": u.display_name} for u in result.scalars()]


@router.post("/{group_id}/members")
async def add_member(
    group_id: uuid.UUID,
    body: dict,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(status_code=422, detail="user_id required")
    existing = await session.execute(
        select(UserGroup).where(UserGroup.group_id == group_id, UserGroup.user_id == uuid.UUID(user_id))
    )
    if not existing.scalar_one_or_none():
        session.add(UserGroup(group_id=group_id, user_id=uuid.UUID(user_id)))
        await session.commit()
    return {"ok": True}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(UserGroup).where(UserGroup.group_id == group_id, UserGroup.user_id == user_id)
    )
    ug = result.scalar_one_or_none()
    if ug:
        await session.delete(ug)
        await session.commit()
    return {"ok": True}


def _clean_policies(p: dict) -> dict:
    """Keep only known policy flags, as booleans."""
    return {f: bool(p.get(f)) for f in policy_svc.FLAGS if p.get(f)}


def _out(g: Group) -> dict:
    return {
        "id": str(g.id), "name": g.name, "description": g.description,
        "max_sessions": g.max_sessions, "cpu_limit": g.cpu_limit, "mem_limit": g.mem_limit,
        "policies": g.policies or {},
    }
