from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user
from app.models.app_catalog import App, AppPermission
from app.models.user import User, UserGroup

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.get("")
async def list_apps(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Return apps the current user has access to.
    Admins see everything; regular users see apps whose groups they belong to
    or apps with no permission restrictions (open to all).
    """
    if user.is_admin:
        result = await db.execute(
            select(App).where(App.is_enabled == True, App.is_deleted == False)  # noqa: E712
            .order_by(App.category, App.name)
        )
        apps = result.scalars().all()
    else:
        # Collect user group ids
        group_result = await db.execute(
            select(UserGroup.group_id).where(UserGroup.user_id == user.id)
        )
        group_ids = [r for r in group_result.scalars().all()]

        # Apps the user's groups can access OR apps with no permissions set (open)
        open_result = await db.execute(
            select(App)
            .where(App.is_enabled == True, App.is_deleted == False)  # noqa: E712
            .where(
                ~App.id.in_(select(AppPermission.app_id).distinct())
                | App.id.in_(
                    select(AppPermission.app_id).where(AppPermission.group_id.in_(group_ids))
                )
            )
            .order_by(App.category, App.name)
        )
        apps = open_result.scalars().all()

    return [_app_out(a) for a in apps]


def _app_out(a: App) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "description": a.description,
        "category": a.category,
        "icon_url": a.icon_url,
        "app_type": a.app_type,
        "web_native": a.web_native,
        "proxy_port": a.proxy_port,
        "cpu_limit": a.cpu_limit,
        "mem_limit": a.mem_limit,
        "container_image": a.container_image,
        "web_url": a.web_url,
        "mount_home": a.mount_home,
        "is_enabled": a.is_enabled,
        # VPN gateway app — drives the taskbar VPN indicator
        "is_vpn": (a.env_json or {}).get("LWP_VPN_ROLE") == "gateway",
        # Eligible for the user's "keep running in background" preference
        "bg_allowed": (a.env_json or {}).get("LWP_BG_ALLOWED") == "1",
    }
