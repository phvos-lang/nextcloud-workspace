"""LDAP authentication service (uses ldap3, runs in thread pool)."""
import asyncio
import logging
import re
import ssl

logger = logging.getLogger(__name__)


def _cn_from_dn(dn: str) -> str:
    """Extract CN value from an LDAP distinguished name."""
    m = re.match(r"[Cc][Nn]=([^,]+)", dn)
    return m.group(1) if m else dn


def _ldap_auth_sync(username: str, password: str) -> dict | None:
    from app.config import settings

    try:
        from ldap3 import (
            AUTO_BIND_NO_TLS,
            AUTO_BIND_TLS_BEFORE_BIND,
            SUBTREE,
            Connection,
            Server,
            Tls,
        )
    except ImportError:
        logger.error("ldap3 not installed — cannot authenticate via LDAP")
        return None

    tls_obj = None
    use_ssl = False

    if settings.ldap_tls == "ldaps":
        tls_obj = Tls(validate=ssl.CERT_REQUIRED)
        use_ssl = True
    elif settings.ldap_tls == "starttls":
        tls_obj = Tls(validate=ssl.CERT_REQUIRED)

    server = Server(settings.ldap_host, port=settings.ldap_port, use_ssl=use_ssl, tls=tls_obj)

    attrs = [settings.ldap_user_attr_email, settings.ldap_user_attr_display_name, settings.ldap_groups_attr]

    # Step 1: service bind → search for user DN
    try:
        svc_conn = Connection(server, user=settings.ldap_bind_dn, password=settings.ldap_bind_password)
        if not svc_conn.bind():
            logger.error("LDAP service bind failed: %s", svc_conn.result)
            return None

        if settings.ldap_tls == "starttls":
            svc_conn.start_tls()

        search_filter = settings.ldap_user_filter.format(username=username)
        svc_conn.search(settings.ldap_base_dn, search_filter, SUBTREE, attributes=attrs)

        if not svc_conn.entries:
            logger.debug("LDAP: no entry for username=%s", username)
            return None

        entry = svc_conn.entries[0]
        user_dn = entry.entry_dn
        svc_conn.unbind()
    except Exception as exc:
        logger.error("LDAP search error: %s", exc)
        return None

    # Step 2: bind as user to verify password
    try:
        user_conn = Connection(server, user=user_dn, password=password)
        if not user_conn.bind():
            logger.debug("LDAP: password incorrect for dn=%s", user_dn)
            return None
        user_conn.unbind()
    except Exception as exc:
        logger.debug("LDAP user bind error: %s", exc)
        return None

    # Extract attributes
    def _attr(name: str) -> str:
        try:
            val = entry[name]
            return str(val) if val else ""
        except Exception:
            return ""

    email = _attr(settings.ldap_user_attr_email) or f"{username}@ldap.local"
    display_name = _attr(settings.ldap_user_attr_display_name) or username

    raw_groups = []
    try:
        raw_groups = list(entry[settings.ldap_groups_attr])
    except Exception:
        pass
    groups = [_cn_from_dn(str(g)) for g in raw_groups]

    return {
        "dn": user_dn,
        "username": username.lower(),
        "email": email.lower(),
        "display_name": display_name,
        "groups": groups,
    }


async def authenticate_ldap(username: str, password: str) -> dict | None:
    return await asyncio.to_thread(_ldap_auth_sync, username, password)
