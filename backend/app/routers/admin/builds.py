"""
Admin: Docker image build pipeline.
Builds are triggered async; logs are streamed via SSE.
"""
import asyncio
import base64
import hashlib
import json
import os
import tempfile
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import SessionLocal, get_session
from app.dependencies import require_role
from app.models.app_catalog import App
from app.models.build import BuildJob

router = APIRouter(prefix="/api/admin/builds", tags=["admin-builds"])
_admin = [Depends(require_role(["admin"]))]

# In-memory build state (single-process; swap for Redis in multi-replica prod)
_progress: dict[str, dict] = {}


# ── Fernet helpers ────────────────────────────────────────────────────────────

def _fernet():
    from cryptography.fernet import Fernet
    key = base64.urlsafe_b64encode(
        hashlib.sha256(settings.secret_key.encode()).digest()
    )
    return Fernet(key)


def _encrypt(text: str) -> str:
    return _fernet().encrypt(text.encode()).decode()


def _decrypt(text: str) -> str:
    return _fernet().decrypt(text.encode()).decode()


# ── Background build ──────────────────────────────────────────────────────────

def _sync_build(build_id: str, dockerfile: str, entrypoint: str | None, tag: str) -> None:
    import docker

    _progress[build_id]["status"] = "building"

    client = docker.from_env()
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, "Dockerfile"), "w") as f:
            f.write(dockerfile)
        if entrypoint:
            ep = os.path.join(tmp, "entrypoint.sh")
            with open(ep, "w") as f:
                f.write(entrypoint)
            os.chmod(ep, 0o755)

        try:
            for chunk in client.api.build(path=tmp, tag=tag, rm=True, decode=True):
                if "stream" in chunk:
                    _progress[build_id]["log"] += chunk["stream"]
                elif "error" in chunk:
                    _progress[build_id]["log"] += f"\n✘ {chunk['error']}\n"
            _progress[build_id]["status"] = "success"
        except Exception as exc:
            _progress[build_id]["log"] += f"\n✘ Build error: {exc}\n"
            _progress[build_id]["status"] = "failed"


async def _build_task(build_id: str, dockerfile: str, entrypoint: str | None, tag: str) -> None:
    _progress[build_id] = {"log": "", "status": "pending"}
    await asyncio.to_thread(_sync_build, build_id, dockerfile, entrypoint, tag)

    async with SessionLocal() as db:
        job = await db.get(BuildJob, uuid.UUID(build_id))
        if job:
            job.status = _progress[build_id]["status"]
            job.build_log = _progress[build_id]["log"]
            job.updated_at = datetime.now(UTC)
            await db.commit()


def _sync_push(build_id: str, tag: str, registry_url: str | None,
               username: str | None, password: str | None) -> None:
    import docker

    _progress.setdefault(build_id, {})
    _progress[build_id]["status"] = "pushing"
    push_log = "\n\n─── Push ───\n"

    client = docker.from_env()
    try:
        if username and password:
            reg = registry_url or tag.split("/")[0]
            client.login(username=username, password=password, registry=reg)

        for chunk in client.api.push(tag, stream=True, decode=True):
            line = chunk.get("status", "")
            if chunk.get("progress"):
                line += f" {chunk['progress']}"
            push_log += line + "\n"

        _progress[build_id]["status"] = "pushed"
    except Exception as exc:
        push_log += f"\n✘ Push failed: {exc}\n"
        _progress[build_id]["status"] = "push_failed"

    _progress[build_id]["push_log"] = push_log


async def _push_task(build_id: str, tag: str, registry_url: str | None,
                     username: str | None, password: str | None) -> None:
    await asyncio.to_thread(_sync_push, build_id, tag, registry_url, username, password)

    async with SessionLocal() as db:
        job = await db.get(BuildJob, uuid.UUID(build_id))
        if job:
            job.status = _progress[build_id]["status"]
            job.build_log = (job.build_log or "") + _progress[build_id].get("push_log", "")
            job.updated_at = datetime.now(UTC)
            await db.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", dependencies=_admin)
async def list_builds(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(BuildJob).order_by(BuildJob.created_at.desc()))
    jobs = result.scalars().all()
    return [_job_out(j) for j in jobs]


@router.post("", dependencies=_admin, status_code=201)
async def create_build(
    body: dict,
    db: AsyncSession = Depends(get_session),
):
    name = body.get("name", "").strip()
    tag = body.get("image_tag", "").strip()
    dockerfile = body.get("dockerfile", "").strip()

    if not name or not tag or not dockerfile:
        raise HTTPException(422, "name, image_tag and dockerfile are required")

    pw = body.get("registry_password", "")
    job = BuildJob(
        name=name,
        image_tag=tag,
        registry_url=body.get("registry_url") or None,
        registry_username=body.get("registry_username") or None,
        registry_password_enc=_encrypt(pw) if pw else None,
        dockerfile=dockerfile,
        entrypoint=body.get("entrypoint") or None,
        status="pending",
        build_log="",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    asyncio.create_task(_build_task(str(job.id), dockerfile, job.entrypoint, tag))
    return _job_out(job)


@router.get("/{build_id}", dependencies=_admin)
async def get_build(build_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    job = await db.get(BuildJob, build_id)
    if not job:
        raise HTTPException(404)
    # Merge in-progress log if build is still live
    out = _job_out(job)
    live = _progress.get(str(build_id))
    if live:
        out["build_log"] = live.get("log", out["build_log"])
        out["status"] = live.get("status", out["status"])
    return out


@router.get("/{build_id}/stream", dependencies=_admin)
async def stream_build(build_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    """SSE endpoint — streams build log lines as they arrive."""
    bid = str(build_id)

    async def generate():
        last_len = 0
        for _ in range(600):  # max ~2 min polling
            prog = _progress.get(bid) or {}
            log = prog.get("log") or ""
            status = prog.get("status", "pending")

            if len(log) > last_len:
                chunk = log[last_len:]
                last_len = len(log)
                yield f"data: {json.dumps({'line': chunk, 'status': status})}\n\n"

            if status in ("success", "failed", "pushed", "push_failed"):
                yield f"data: {json.dumps({'done': True, 'status': status})}\n\n"
                return

            await asyncio.sleep(0.2)

        yield f"data: {json.dumps({'done': True, 'status': 'timeout'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/{build_id}/push", dependencies=_admin, status_code=202)
async def push_build(build_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    job = await db.get(BuildJob, build_id)
    if not job:
        raise HTTPException(404)
    if job.status != "success":
        raise HTTPException(400, "Build must succeed before pushing")

    pw = _decrypt(job.registry_password_enc) if job.registry_password_enc else None
    asyncio.create_task(_push_task(
        str(job.id), job.image_tag, job.registry_url, job.registry_username, pw
    ))
    return {"queued": True}


@router.post("/{build_id}/publish", dependencies=_admin)
async def publish_to_catalog(
    build_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_session),
):
    """Create (or update) an App catalog entry for this image."""
    job = await db.get(BuildJob, build_id)
    if not job:
        raise HTTPException(404)
    if job.status not in ("success", "pushed"):
        raise HTTPException(400, "Build must succeed before publishing")

    if job.app_id:
        app = await db.get(App, job.app_id)
        if app:
            app.container_image = job.image_tag
            app.name = body.get("name", app.name)
            app.description = body.get("description", app.description)
            app.category = body.get("category", app.category)
            app.is_enabled = True
            await db.commit()
            return {"app_id": str(app.id), "created": False}

    app = App(
        name=body.get("name", job.name),
        description=body.get("description", ""),
        category=body.get("category", "General"),
        icon_url=body.get("icon_url", ""),
        app_type="stream",
        container_image=job.image_tag,
        proxy_port=8080,
        cpu_limit="2000m",
        mem_limit="2Gi",
        shm_size="1Gi",
        env_json={},
        mount_home=True,
        is_enabled=True,
    )
    db.add(app)
    await db.flush()
    job.app_id = app.id
    await db.commit()
    return {"app_id": str(app.id), "created": True}


@router.delete("/{build_id}", dependencies=_admin, status_code=204)
async def delete_build(build_id: uuid.UUID, db: AsyncSession = Depends(get_session)):
    job = await db.get(BuildJob, build_id)
    if not job:
        raise HTTPException(404)
    await db.delete(job)
    await db.commit()


def _job_out(j: BuildJob) -> dict:
    return {
        "id": str(j.id),
        "name": j.name,
        "image_tag": j.image_tag,
        "registry_url": j.registry_url,
        "registry_username": j.registry_username,
        "has_registry_password": bool(j.registry_password_enc),
        "dockerfile": j.dockerfile,
        "entrypoint": j.entrypoint,
        "status": j.status,
        "build_log": j.build_log,
        "app_id": str(j.app_id) if j.app_id else None,
        "created_at": j.created_at.isoformat(),
    }
