"""User-facing Nextcloud storage config + WebDAV file proxy."""
import mimetypes
import re
import urllib.parse
import xml.etree.ElementTree as ET
from collections.abc import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.dependencies import get_current_user
from app.models.storage import StorageConfig
from app.models.user import User
from app.services import mounts as mount_svc
from app.services import nextcloud as nc_svc
from app.services import policy as policy_svc

router = APIRouter(prefix="/api/storage", tags=["storage"])


async def _local_fs_host(user: User, db: AsyncSession) -> str:
    """host:port for the user's active session's in-container fileserver sidecar."""
    from app.models.session import Session

    sess = await db.scalar(select(Session).where(
        Session.user_id == user.id, Session.status.in_(["running", "paused"])
    ).order_by(Session.started_at.desc()).limit(1))
    if not sess:
        raise HTTPException(404, "No active session found")
    host = (sess.upstream_host or sess.pod_name) if settings.is_dev \
        else f"{sess.service_name}.lwp.svc.cluster.local"
    return f"{host}:19090"


# ── Extra storage mounts (SFTP / S3, rclone-backed, mounted at ~/Mount/<name>) ──

class MountIn(BaseModel):
    name: str
    provider: str  # sftp | s3
    # sftp
    host: str | None = None
    port: int = 22
    user: str | None = None
    private_key: str | None = None  # pasted OpenSSH/PEM private key
    password: str | None = None     # alternative to a key
    path: str = ""                  # optional remote subpath
    # s3
    endpoint: str | None = None
    region: str = ""
    bucket: str | None = None
    access_key_id: str | None = None
    secret_access_key: str | None = None


@router.get("/mounts")
async def list_mounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    return await mount_svc.list_configs(db, user.id)


@router.post("/mounts")
async def create_mount(
    body: MountIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    if body.provider not in mount_svc.PROVIDERS:
        raise HTTPException(422, "Unsupported provider")
    if not mount_svc.valid_name(body.name):
        raise HTTPException(422, "Name must be 1–32 chars: letters, digits, _ or -")

    if body.provider == "sftp":
        if not (body.host and body.user and (body.private_key or body.password)):
            raise HTTPException(422, "SFTP needs host, user and a private key or password")
        params = {
            "host": body.host, "port": body.port, "user": body.user,
            "path": body.path.strip("/"),
        }
        # Key wins when both are supplied.
        if body.private_key:
            params["private_key"] = body.private_key
        else:
            params["password"] = body.password
    else:  # s3
        if not (body.bucket and body.access_key_id and body.secret_access_key):
            raise HTTPException(422, "S3 needs a bucket and access key / secret")
        params = {
            "endpoint": body.endpoint or "", "region": body.region,
            "bucket": body.bucket, "access_key_id": body.access_key_id,
            "secret_access_key": body.secret_access_key,
        }

    # Unique per (user, name)
    dup = await db.scalar(select(StorageConfig).where(
        StorageConfig.user_id == user.id, StorageConfig.name == body.name))
    if dup:
        raise HTTPException(409, f"A mount named '{body.name}' already exists")

    cfg = StorageConfig(
        user_id=user.id,
        name=body.name,
        provider=body.provider,
        config_encrypted=mount_svc.encrypt_config(params),
        mount_path=f"/home/lwp/Mount/{body.name}",
    )
    db.add(cfg)
    await db.commit()
    return {"ok": True}


@router.delete("/mounts/{mount_id}")
async def delete_mount(
    mount_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    cfg = await db.scalar(select(StorageConfig).where(
        StorageConfig.id == mount_id, StorageConfig.user_id == user.id))
    if not cfg:
        raise HTTPException(404, "Mount not found")
    await db.delete(cfg)
    await db.commit()
    return {"ok": True}


# ── WebDAV helpers ────────────────────────────────────────────────────────────

async def _nc_creds(user: User, db: AsyncSession) -> tuple[str, str, str]:
    """Return (webdav_base_url, nc_username, password) for the current user."""
    sys_cfg = await nc_svc.get_system_config(db)
    nc_url = (user.nc_url or sys_cfg["url"] or "").rstrip("/")
    if not nc_url:
        raise HTTPException(422, "Nextcloud not configured")
    nc_user = user.nc_username or user.username
    if user.nc_password_enc:
        pw = nc_svc.decrypt(user.nc_password_enc)
    elif sys_cfg.get("admin_password"):
        pw = nc_svc._derive_user_password(user.username)
    else:
        raise HTTPException(422, "No Nextcloud credentials available")
    dav_base = f"{nc_url}/remote.php/dav/files/{urllib.parse.quote(nc_user, safe='')}"
    return dav_base, nc_user, pw


def _parse_propfind(xml_bytes: bytes, dav_base: str) -> list[dict]:
    """Parse WebDAV PROPFIND response into a list of file dicts."""
    NS = {
        "d": "DAV:",
        "oc": "http://owncloud.org/ns",
        "nc": "http://nextcloud.org/ns",
    }
    root = ET.fromstring(xml_bytes)
    items = []
    # Strip the DAV path prefix so we return paths relative to the user's root
    dav_path_prefix = urllib.parse.urlparse(dav_base).path  # /remote.php/dav/files/user
    first = True
    for resp in root.findall("d:response", NS):
        href = (resp.findtext("d:href", "", NS) or "").rstrip("/")
        if first:          # first entry is always the requested directory itself
            first = False
            continue
        prop = resp.find("./d:propstat/d:prop", NS)
        if prop is None:
            continue
        resource_type = prop.find("d:resourcetype", NS)
        is_dir = resource_type is not None and resource_type.find("d:collection", NS) is not None
        name = urllib.parse.unquote(href.rsplit("/", 1)[-1])
        rel_path = urllib.parse.unquote(href)
        if rel_path.startswith(dav_path_prefix):
            rel_path = rel_path[len(dav_path_prefix):]
        items.append({
            "name": name,
            "path": rel_path.rstrip("/") + ("/" if is_dir else ""),
            "type": "dir" if is_dir else "file",
            "size": int(prop.findtext("d:getcontentlength", "0", NS) or 0),
            "modified": prop.findtext("d:getlastmodified", "", NS),
            "mime": prop.findtext("d:getcontenttype", "", NS) if not is_dir else "",
        })
    items.sort(key=lambda x: (x["type"] == "file", x["name"].lower()))
    return items


def _dav_url(dav_base: str, path: str) -> str:
    """Build a properly percent-encoded WebDAV URL from a human-readable path."""
    segs = [urllib.parse.quote(s, safe="") for s in path.split("/") if s]
    suffix = "/" if path.endswith("/") else ""
    return dav_base + "/" + "/".join(segs) + suffix


@router.get("/nextcloud")
async def get_my_nextcloud(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Effective NC config for the current user (personal override or system default)."""
    sys_cfg = await nc_svc.get_system_config(db)
    return {
        "system_url": sys_cfg["url"],
        "system_configured": bool(sys_cfg["url"]),
        "personal_url": user.nc_url or "",
        "personal_username": user.nc_username or "",
        "has_personal_password": bool(user.nc_password_enc),
        "effective_url": user.nc_url or sys_cfg["url"],
        "effective_username": user.nc_username or user.username,
        "mount_path": sys_cfg["mount_path"],
    }


@router.put("/nextcloud")
async def update_my_nextcloud(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Personal Nextcloud override. Pass url='' to revert to system default."""
    user.nc_url = body.get("url", "").strip() or None
    user.nc_username = body.get("username", "").strip() or None
    if body.get("password"):
        user.nc_password_enc = nc_svc.encrypt(body["password"])
    elif body.get("clear_password"):
        user.nc_password_enc = None
    await db.commit()
    return {"ok": True}


@router.post("/nextcloud/test")
async def test_my_nextcloud(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    sys_cfg = await nc_svc.get_system_config(db)
    url = user.nc_url or sys_cfg["url"]
    nc_user = user.nc_username or user.username

    if user.nc_password_enc:
        pw = nc_svc.decrypt(user.nc_password_enc)
    elif sys_cfg["admin_password"]:
        pw = nc_svc._derive_user_password(user.username)
    else:
        raise HTTPException(422, "No Nextcloud credentials configured")

    return await nc_svc.test_connection(url, nc_user, pw)


@router.delete("/nextcloud")
async def clear_my_nextcloud(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    user.nc_url = None
    user.nc_username = None
    user.nc_password_enc = None
    await db.commit()
    return {"ok": True}


# ── Nextcloud Login Flow v2 ───────────────────────────────────────────────────
# Mirrors how the official NC mobile app authenticates — user logs in on their
# own NC instance; we receive an app-password, never the real password.

@router.post("/nextcloud/connect")
async def nc_login_flow_start(
    body: dict,
    user: User = Depends(get_current_user),
):
    """Initiate NC Login Flow v2. Returns loginUrl (open in popup) + poll data."""
    nc_url = body.get("url", "").rstrip("/")
    if not nc_url:
        raise HTTPException(422, "url required")
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{nc_url}/index.php/login/v2",
            headers={"User-Agent": "LWP/1.0"},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Nextcloud login flow failed: {r.status_code}")
    data = r.json()
    return {
        "login_url":      data["login"],
        "poll_endpoint":  data["poll"]["endpoint"],
        "poll_token":     data["poll"]["token"],
        "nc_url":         nc_url,
    }


@router.post("/nextcloud/connect/poll")
async def nc_login_flow_poll(
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Poll NC for credentials. Returns {done: false} until user completes login."""
    poll_endpoint = body.get("poll_endpoint", "")
    poll_token    = body.get("poll_token", "")
    nc_url        = body.get("nc_url", "")
    if not poll_endpoint or not poll_token:
        raise HTTPException(422, "poll_endpoint and poll_token required")
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(poll_endpoint, data={"token": poll_token})
    if r.status_code == 404:
        return {"done": False}
    if r.status_code != 200:
        raise HTTPException(502, f"Poll failed: {r.status_code}")
    creds = r.json()
    user.nc_url          = creds.get("server", nc_url)
    user.nc_username     = creds.get("loginName")
    user.nc_password_enc = nc_svc.encrypt(creds["appPassword"])
    # Connecting NC means the user is set up — suppress first-run onboarding.
    user.preferences = {**(user.preferences or {}), "onboarded": True}
    await db.commit()
    return {"done": True, "username": creds.get("loginName")}


# ── Storage quota ─────────────────────────────────────────────────────────────

@router.get("/quota")
async def storage_quota(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Nextcloud usage for the current user (bytes). available = -3 means unlimited."""
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, "/")
    body = ('<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop>'
            '<d:quota-used-bytes/><d:quota-available-bytes/></d:prop></d:propfind>')
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.request("PROPFIND", url, headers={"Depth": "0"}, auth=(nc_user, pw), content=body)
    if r.status_code not in (207, 200):
        raise HTTPException(502, f"Nextcloud error: {r.status_code}")
    used = re.search(r"quota-used-bytes>(-?\d+)", r.text)
    avail = re.search(r"quota-available-bytes>(-?\d+)", r.text)
    used_b = int(used.group(1)) if used else 0
    avail_b = int(avail.group(1)) if avail else -3
    total = used_b + avail_b if avail_b >= 0 else None
    return {"used": used_b, "available": avail_b, "total": total}


# ── File browser proxy ────────────────────────────────────────────────────────

@router.get("/files")
async def list_files(
    path: str = Query("/"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, path)
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.request(
            "PROPFIND", url,
            headers={"Depth": "1"},
            auth=(nc_user, pw),
        )
    if r.status_code == 404:
        raise HTTPException(404, "Path not found")
    if r.status_code not in (207, 200):
        raise HTTPException(502, f"Nextcloud error: {r.status_code}")
    return _parse_propfind(r.content, dav_base)


@router.get("/files/download")
async def download_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    pol = await policy_svc.effective_policy(db, user.id)
    if pol["disable_download"]:
        raise HTTPException(status_code=403, detail="Downloads are disabled by policy")
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, path)
    filename = path.rsplit("/", 1)[-1]
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    async def stream() -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=None) as c:
            async with c.stream("GET", url, auth=(nc_user, pw)) as r:
                if r.status_code != 200:
                    raise HTTPException(r.status_code, "Download failed")
                async for chunk in r.aiter_bytes(65536):
                    yield chunk

    return StreamingResponse(
        stream(),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/files/upload")
async def upload_file(
    path: str = Query(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    pol = await policy_svc.effective_policy(db, user.id)
    if pol["disable_upload"]:
        raise HTTPException(status_code=403, detail="Uploads are disabled by policy")
    dav_base, nc_user, pw = await _nc_creds(user, db)
    dest = path.rstrip("/") + "/" + (file.filename or "upload")
    url = _dav_url(dav_base, dest)
    content = await file.read()
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.put(url, content=content, auth=(nc_user, pw))
    if r.status_code not in (200, 201, 204):
        raise HTTPException(502, f"Upload failed: {r.status_code}")
    return {"ok": True, "path": dest}


@router.delete("/files")
async def delete_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, path)
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.delete(url, auth=(nc_user, pw))
    if r.status_code not in (200, 204):
        raise HTTPException(502, f"Delete failed: {r.status_code}")
    return {"ok": True}


@router.post("/files/mkdir")
async def make_dir(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, path)
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.request("MKCOL", url, auth=(nc_user, pw))
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"mkdir failed: {r.status_code}")
    return {"ok": True}


@router.get("/files/thumbnail")
async def file_thumbnail(
    path: str = Query(...),
    size: int = Query(256),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Proxy Nextcloud preview thumbnail for images."""
    sys_cfg = await nc_svc.get_system_config(db)
    nc_url = (user.nc_url or sys_cfg["url"] or "").rstrip("/")
    if not nc_url:
        raise HTTPException(422, "Nextcloud not configured")
    nc_user = user.nc_username or user.username
    if user.nc_password_enc:
        pw = nc_svc.decrypt(user.nc_password_enc)
    elif sys_cfg.get("admin_password"):
        pw = nc_svc._derive_user_password(user.username)
    else:
        raise HTTPException(422, "No Nextcloud credentials available")

    preview_url = (
        f"{nc_url}/index.php/core/preview.png"
        f"?file={urllib.parse.quote(path)}&x={size}&y={size}&forceIcon=0"
    )

    async def _stream() -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=15) as c:
            async with c.stream("GET", preview_url, auth=(nc_user, pw)) as r:
                if r.status_code != 200:
                    return
                async for chunk in r.aiter_bytes(32768):
                    yield chunk

    return StreamingResponse(_stream(), media_type="image/png",
                             headers={"Cache-Control": "private, max-age=300"})


@router.get("/files/preview")
async def preview_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Stream file with inline Content-Disposition so the browser renders it directly."""
    dav_base, nc_user, pw = await _nc_creds(user, db)
    url = _dav_url(dav_base, path)
    filename = path.rsplit("/", 1)[-1]
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    async def _stream() -> AsyncIterator[bytes]:
        async with httpx.AsyncClient(timeout=None) as c:
            async with c.stream("GET", url, auth=(nc_user, pw)) as r:
                if r.status_code != 200:
                    raise HTTPException(r.status_code, "Preview failed")
                async for chunk in r.aiter_bytes(65536):
                    yield chunk

    return StreamingResponse(
        _stream(),
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ── Local filesystem proxy (container mounts) ─────────────────────────────────

@router.get("/local/files")
async def list_local_files(
    path: str = Query("/"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """List files in the user's container filesystem (mounts, home, etc.)."""
    host = await _local_fs_host(user, db)
    container_url = f"http://{host}/api/files?path={urllib.parse.quote(path)}"
    
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(container_url)
            if r.status_code != 200:
                raise HTTPException(r.status_code, f"Container fileserver error: {r.text}")
            return r.json()
    except Exception as e:
        raise HTTPException(502, f"Failed to access container filesystem: {str(e)}")


@router.delete("/local/files")
async def delete_local_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Delete a file or directory in the user's container filesystem."""
    host = await _local_fs_host(user, db)
    container_url = f"http://{host}/api/files/delete?path={urllib.parse.quote(path)}"
    
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.delete(container_url)
            if r.status_code not in (200, 204):
                raise HTTPException(r.status_code, f"Delete failed: {r.text}")
            return {"ok": True}
    except Exception as e:
        raise HTTPException(502, f"Failed to delete file: {str(e)}")


@router.post("/local/files/mkdir")
async def make_local_dir(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Create a directory in the user's container filesystem."""
    host = await _local_fs_host(user, db)
    container_url = f"http://{host}/api/files/mkdir?path={urllib.parse.quote(path)}"
    
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(container_url)
            if r.status_code not in (200, 201):
                raise HTTPException(r.status_code, f"mkdir failed: {r.text}")
            return {"ok": True}
    except Exception as e:
        raise HTTPException(502, f"Failed to create directory: {str(e)}")


@router.get("/local/files/download")
async def download_local_file(
    path: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Download a file from the user's container filesystem."""
    host = await _local_fs_host(user, db)
    container_url = f"http://{host}/api/files/download?path={urllib.parse.quote(path)}"
    
    try:
        async with httpx.AsyncClient(timeout=None) as c:
            r = await c.get(container_url)
            if r.status_code != 200:
                raise HTTPException(r.status_code, f"Download failed: {r.text}")
            
            filename = path.rsplit("/", 1)[-1]
            mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            
            return StreamingResponse(
                r.aiter_bytes(65536),
                media_type=mime,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
    except Exception as e:
        raise HTTPException(502, f"Failed to download file: {str(e)}")


@router.get("/local/files/thumbnail")
async def local_file_thumbnail(
    path: str = Query(...),
    size: int = Query(256),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Get thumbnail for a file in the user's container filesystem."""
    host = await _local_fs_host(user, db)
    container_url = f"http://{host}/api/files/thumbnail?path={urllib.parse.quote(path)}&size={size}"
    
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(container_url)
            if r.status_code != 200:
                return StreamingResponse(b'', media_type="image/png")
            
            return StreamingResponse(
                r.aiter_bytes(32768),
                media_type="image/png",
                headers={"Cache-Control": "private, max-age=300"},
            )
    except Exception:
        return StreamingResponse(b'', media_type="image/png")


@router.post("/local/files/upload")
async def upload_local_file(
    path: str = Query(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Upload a file to the user's container filesystem."""
    host = await _local_fs_host(user, db)
    content = await file.read()
    container_url = f"http://{host}/api/files/upload?path={urllib.parse.quote(path)}"
    
    try:
        async with httpx.AsyncClient(timeout=120) as c:
            r = await c.post(container_url, content=content, headers={
                "Content-Type": file.content_type or "application/octet-stream"
            })
            if r.status_code not in (200, 201):
                raise HTTPException(r.status_code, f"Upload failed: {r.text}")
            return {"ok": True, "path": path}
    except Exception as e:
        raise HTTPException(502, f"Failed to upload file: {str(e)}")
