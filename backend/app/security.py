import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


def create_access_token(user_id: str, token_version: int = 0) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": user_id, "ver": token_version, "exp": expire, "type": "access"}, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode({"sub": user_id, "ver": token_version, "exp": expire, "type": "refresh"}, settings.secret_key, algorithm=ALGORITHM)


def create_totp_pending_token(user_id: str) -> str:
    """Short-lived token issued after password OK but before TOTP code entered."""
    expire = datetime.now(UTC) + timedelta(minutes=5)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "totp_pending"}, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def verify_token(token: str, expected_type: str = "access") -> str | None:
    try:
        payload = decode_token(token)
        if payload.get("type") != expected_type:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def verify_token_claims(token: str, expected_type: str = "access") -> dict | None:
    """Like verify_token but returns the full payload (sub, ver, …) so callers
    can enforce single-session takeover via the `ver` claim."""
    try:
        payload = decode_token(token)
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)
