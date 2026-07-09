"""User extra-storage mounts (SFTP, S3) — rclone-backed, like Nextcloud.

Each StorageConfig holds a Fernet-encrypted JSON blob of connection parameters.
At session launch the user's mounts are serialised into a single base64 env var
(LWP_MOUNTS) that the container's lwp-mounts.sh decodes and mounts under
~/Mount/<name> via rclone. Secrets ride the same env channel as the existing
Nextcloud password (LWP_NC_PASS); the container writes SSH keys to 0600 files.
"""
import base64
import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.storage import StorageConfig
from app.services.nextcloud import decrypt, encrypt

# Mount name → filesystem dir + rclone remote section, so keep it strict.
NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$")

PROVIDERS = ("sftp", "s3")


def valid_name(name: str) -> bool:
    return bool(NAME_RE.match(name or ""))


def encrypt_config(params: dict) -> str:
    return encrypt(json.dumps(params))


def _public_view(cfg: StorageConfig) -> dict:
    """Non-secret fields for the UI (never returns keys/secrets)."""
    try:
        params = json.loads(decrypt(cfg.config_encrypted))
    except Exception:
        params = {}
    safe = {
        "id": str(cfg.id),
        "name": cfg.name,
        "provider": cfg.provider,
        "mount_path": cfg.mount_path,
    }
    if cfg.provider == "sftp":
        safe.update(host=params.get("host"), port=params.get("port", 22),
                    user=params.get("user"), path=params.get("path", ""))
    elif cfg.provider == "s3":
        safe.update(endpoint=params.get("endpoint"), bucket=params.get("bucket"),
                    region=params.get("region", ""),
                    access_key_id=params.get("access_key_id"))
    return safe


async def list_configs(db: AsyncSession, user_id) -> list[dict]:
    rows = (await db.scalars(
        select(StorageConfig).where(StorageConfig.user_id == user_id)
        .order_by(StorageConfig.name)
    )).all()
    return [_public_view(c) for c in rows]


async def get_user_mount_env(db: AsyncSession, user_id) -> dict:
    """Serialise all of the user's mounts into LWP_MOUNTS (base64 JSON).
    Empty dict if the user has none."""
    rows = (await db.scalars(
        select(StorageConfig).where(StorageConfig.user_id == user_id)
    )).all()
    mounts = []
    for c in rows:
        try:
            params = json.loads(decrypt(c.config_encrypted))
        except Exception:
            continue
        mounts.append({
            "name": c.name,
            "provider": c.provider,
            "mount_path": c.mount_path,
            "params": params,
        })
    if not mounts:
        return {}
    blob = base64.b64encode(json.dumps(mounts).encode()).decode()
    return {"LWP_MOUNTS": blob}
