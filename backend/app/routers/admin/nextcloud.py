from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import require_admin
from app.models.user import User
from app.services import nextcloud as nc_svc

router = APIRouter(prefix="/api/admin/nextcloud", tags=["admin-nextcloud"])
_admin = [Depends(require_admin)]


@router.get("", dependencies=_admin)
async def get_config(db: AsyncSession = Depends(get_session)):
    cfg = await nc_svc.get_system_config(db)
    # Don't return the encrypted password
    return {
        "url": cfg["url"],
        "admin_user": cfg["admin_user"],
        "has_admin_password": bool(cfg["admin_password"]),
        "auto_provision": cfg["auto_provision"],
        "oidc_provision": cfg["oidc_provision"],
        "mount_path": cfg["mount_path"],
    }


@router.put("", dependencies=_admin)
async def save_config(body: dict, db: AsyncSession = Depends(get_session)):
    await nc_svc.save_system_config(
        db,
        url=body.get("url", "").strip(),
        admin_user=body.get("admin_user", "").strip(),
        admin_password=body.get("admin_password") or None,
        auto_provision=bool(body.get("auto_provision", False)),
        oidc_provision=bool(body.get("oidc_provision", False)),
        mount_path=body.get("mount_path", "/home/appuser/Files").strip(),
    )
    return {"ok": True}


@router.post("/test", dependencies=_admin)
async def test_config(body: dict, db: AsyncSession = Depends(get_session)):
    cfg = await nc_svc.get_system_config(db)
    url = body.get("url") or cfg["url"]
    user = body.get("admin_user") or cfg["admin_user"]
    # Accept plaintext password from request OR use stored encrypted one
    pw = body.get("admin_password")
    if not pw and cfg["admin_password"]:
        pw = nc_svc.decrypt(cfg["admin_password"])
    if not url or not user or not pw:
        raise HTTPException(422, "url, admin_user and admin_password required")
    return await nc_svc.test_connection(url, user, pw)


@router.post("/provision/{user_id}", dependencies=_admin)
async def provision_user(
    user_id: str,
    db: AsyncSession = Depends(get_session),
):
    from uuid import UUID
    cfg = await nc_svc.get_system_config(db)
    if not cfg["url"] or not cfg["admin_user"] or not cfg["admin_password"]:
        raise HTTPException(422, "System Nextcloud not configured")

    user = await db.get(User, UUID(user_id))
    if not user:
        raise HTTPException(404, "User not found")

    result = await nc_svc.provision_user(
        nc_url=cfg["url"],
        admin_user=cfg["admin_user"],
        admin_pass_enc=cfg["admin_password"],
        username=user.nc_username or user.username,
        email=user.email,
    )
    if result["ok"] and "nc_password" in result:
        # Store encrypted password on the user record
        user.nc_password_enc = nc_svc.encrypt(result["nc_password"])
        await db.commit()
    return result


@router.post("/provision-all", dependencies=_admin)
async def provision_all(db: AsyncSession = Depends(get_session)):
    cfg = await nc_svc.get_system_config(db)
    if not cfg["url"] or not cfg["admin_user"] or not cfg["admin_password"]:
        raise HTTPException(422, "System Nextcloud not configured")

    result = await db.execute(select(User).where(User.is_active == True))  # noqa: E712
    users = result.scalars().all()

    results = []
    for user in users:
        r = await nc_svc.provision_user(
            nc_url=cfg["url"],
            admin_user=cfg["admin_user"],
            admin_pass_enc=cfg["admin_password"],
            username=user.nc_username or user.username,
            email=user.email,
        )
        if r["ok"] and "nc_password" in r:
            user.nc_password_enc = nc_svc.encrypt(r["nc_password"])
        results.append({"user": user.username, **r})

    await db.commit()
    return results
