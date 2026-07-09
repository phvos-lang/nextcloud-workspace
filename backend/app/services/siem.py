"""Forward audit events to an external syslog server or SIEM (HTTP/CEF/JSON).

Best-effort: a forwarding failure must never break the audited action. Config
lives in the `siem.*` settings and is cached for a few seconds so we don't hit
the DB on every audit."""
import asyncio
import json
import logging
import socket
import time
from datetime import UTC, datetime

import httpx
from sqlalchemy import select

from app.models.settings import Setting

log = logging.getLogger(__name__)

_cache: dict = {"at": 0.0, "cfg": None}
_TTL = 15.0


def invalidate_cache() -> None:
    _cache["cfg"] = None


async def _get_cfg(db) -> dict:
    now = time.monotonic()
    if _cache["cfg"] is not None and now - _cache["at"] < _TTL:
        return _cache["cfg"]
    rows = {s.key: s.value for s in
            (await db.execute(select(Setting).where(Setting.key.like("siem.%")))).scalars()}
    cfg = {
        "enabled":  rows.get("siem.enabled") == "true",
        "protocol": rows.get("siem.protocol", "syslog_udp"),   # syslog_udp|syslog_tcp|http
        "host":     rows.get("siem.host", ""),
        "port":     int(rows.get("siem.port") or 514),
        "format":   rows.get("siem.format", "rfc5424"),        # rfc5424|cef|json
        "http_url": rows.get("siem.http_url", ""),
        "token":    rows.get("siem.token", ""),
    }
    _cache.update(at=now, cfg=cfg)
    return cfg


def _format(fmt: str, e: dict) -> str:
    if fmt == "json":
        return json.dumps(e)
    if fmt == "cef":
        a = e["action"]
        return (f"CEF:0|LWP|NextcloudLinuxWorkspace|1.0|{a}|{a}|3|"
                f"rt={e['ts']} suser={e['user']} act={a} msg={e['resource']} cs1={e['detail']} cs1Label=detail")
    # RFC 5424 (local0.info)
    msg = f'action={e["action"]} user={e["user"]} resource={e["resource"]} detail="{e["detail"]}"'
    return f'<134>1 {e["ts"]} lwp lwp-audit - {e["action"]} - {msg}'


def _send_udp(host: str, port: int, msg: str) -> None:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.sendto(msg.encode()[:8000], (host, port))
    finally:
        s.close()


def _send_tcp(host: str, port: int, msg: str) -> None:
    s = socket.create_connection((host, port), timeout=3)
    try:
        s.sendall((msg + "\n").encode())
    finally:
        s.close()


async def forward(db, *, action: str, resource: str, username: str | None, detail: str) -> None:
    try:
        cfg = await _get_cfg(db)
    except Exception:
        return
    if not cfg["enabled"]:
        return
    event = {
        "ts": datetime.now(UTC).isoformat(),
        "action": action, "user": username or "-",
        "resource": resource, "detail": detail,
    }
    try:
        await asyncio.wait_for(_deliver(cfg, event), timeout=4)
    except Exception as exc:  # never propagate
        log.warning("SIEM forward failed: %s", exc)


async def _deliver(cfg: dict, event: dict) -> None:
    msg = _format(cfg["format"], event)
    if cfg["protocol"] == "http" or cfg["http_url"]:
        headers = {}
        if cfg["token"]:
            headers["Authorization"] = f"Bearer {cfg['token']}"
        async with httpx.AsyncClient(timeout=3) as c:
            if cfg["format"] == "json":
                await c.post(cfg["http_url"], json=event, headers=headers)
            else:
                headers["Content-Type"] = "text/plain"
                await c.post(cfg["http_url"], content=msg, headers=headers)
    elif cfg["protocol"] == "syslog_tcp":
        await asyncio.to_thread(_send_tcp, cfg["host"], cfg["port"], msg)
    else:
        await asyncio.to_thread(_send_udp, cfg["host"], cfg["port"], msg)
