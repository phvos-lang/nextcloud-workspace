"""Login lockout + IP allow/deny gating. In-memory (per-pod, like rate_limit).

Config from `security.*` settings, cached briefly. Lockout is keyed by
username+IP so one victim can't be locked out globally by a distributed attack,
and an attacker can't trivially DoS a specific account from every source."""
import ipaddress
import re
import time
from collections import defaultdict

from sqlalchemy import select

from app.models.settings import Setting

_fails: dict[str, list[float]] = defaultdict(list)
_cache: dict = {"at": 0.0, "cfg": None}
_TTL = 15.0


def invalidate_cache() -> None:
    _cache["cfg"] = None


def _nets(s: str) -> list:
    out = []
    for tok in re.split(r"[,\s]+", s or ""):
        tok = tok.strip()
        if not tok:
            continue
        try:
            out.append(ipaddress.ip_network(tok, strict=False))
        except ValueError:
            pass
    return out


async def get_cfg(db) -> dict:
    now = time.monotonic()
    if _cache["cfg"] is not None and now - _cache["at"] < _TTL:
        return _cache["cfg"]
    rows = {s.key: s.value for s in
            (await db.execute(select(Setting).where(Setting.key.like("security.%")))).scalars()}
    cfg = {
        "enabled": rows.get("security.lockout_enabled", "true") == "true",
        "max":     int(rows.get("security.lockout_max") or 5),
        "window":  int(rows.get("security.lockout_window") or 900),
        "ip_allow": _nets(rows.get("security.ip_allow", "")),
        "ip_deny":  _nets(rows.get("security.ip_deny", "")),
    }
    _cache.update(at=now, cfg=cfg)
    return cfg


def ip_allowed(ip_str: str, allow: list, deny: list) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparseable (e.g. missing) — don't block
    if any(ip in n for n in deny):
        return False
    if allow:
        return any(ip in n for n in allow)
    return True


def failure_count(key: str, window: int) -> int:
    now = time.time()
    _fails[key] = [t for t in _fails[key] if t > now - window]
    return len(_fails[key])


def record_failure(key: str, window: int) -> None:
    _fails[key].append(time.time())


def clear(key: str) -> None:
    _fails.pop(key, None)
