import logging

from prometheus_client import Counter, Gauge

log = logging.getLogger(__name__)

lwp_active_sessions = Gauge(
    "lwp_active_sessions",
    "Currently active LWP sessions (starting + running)",
)

lwp_sessions_created_total = Counter(
    "lwp_sessions_created_total",
    "Total number of LWP sessions created",
    ["user_type"],
)

lwp_sessions_stopped_total = Counter(
    "lwp_sessions_stopped_total",
    "Total number of LWP sessions stopped",
    ["reason"],
)

lwp_auth_total = Counter(
    "lwp_auth_total",
    "Total number of successful LWP authentications",
    ["method"],
)

lwp_auth_failed_total = Counter(
    "lwp_auth_failed_total",
    "Total number of failed LWP authentications",
    ["method"],
)


def init_metrics(app) -> None:
    """Mount /metrics (auto HTTP metrics + the custom counters). Best-effort —
    a metrics problem must never stop the app from serving."""
    try:
        from prometheus_fastapi_instrumentator import Instrumentator
        Instrumentator().instrument(app).expose(app, endpoint="/metrics")
    except Exception as exc:  # pragma: no cover
        log.warning("Metrics init failed, /metrics disabled: %s", exc)
