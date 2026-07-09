import uuid

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.user import User
from app.security import verify_token_claims


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = verify_token_claims(access_token, expected_type="access")
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # Coerce to UUID — asyncpg casts strings implicitly but SQLite (tests) won't
    try:
        user_id = uuid.UUID(payload["sub"])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    result = await session.execute(select(User).where(User.id == user_id, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Single-session takeover: a newer login elsewhere bumped token_version,
    # so this browser's token is stale — force it back to login.
    if user.token_version != payload.get("ver", 0):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Signed in on another device")

    return user


def require_role(roles: list[str]):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if "admin" in roles and user.is_admin:
            return user
        # Role check via user.roles join — simplified: admin bypasses all
        if not user.is_admin and roles == ["admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return _check


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return user
