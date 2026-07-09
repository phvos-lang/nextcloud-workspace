#!/bin/bash
# Start the nginx TLS front (HTTPS :8080 -> http://127.0.0.1:$LWP_APP_PORT),
# then hand off to the child CMD (the actual web app).
#
# LWP proxies each session under /session/<token>/ and STRIPS that prefix before
# it reaches us. Apps that emit absolute paths (Jupyter, pgweb) then break. If a
# child sets LWP_BASE_PREFIX=1, we re-add /session/$LWP_SESSION_TOKEN/ here so the
# app can run with base_url=/session/<token>/ and every path stays consistent.
set -e

APP_PORT="${LWP_APP_PORT:-8081}"
REWRITE=""
if [ "${LWP_BASE_PREFIX:-0}" = "1" ] && [ -n "${LWP_SESSION_TOKEN:-}" ]; then
  REWRITE="rewrite ^/(.*)\$ /session/${LWP_SESSION_TOKEN}/\$1 break;"
fi

sed -e "s|__APP_PORT__|${APP_PORT}|g" -e "s|__REWRITE__|${REWRITE}|g" \
    /etc/lwp-tls/nginx.conf.template > /tmp/nginx.conf

nginx -c /tmp/nginx.conf -g 'daemon off;' &

# VPN relay (exits 0 immediately when LWP_VPN_UPSTREAM is unset — no gateway)
/usr/local/bin/lwp-vpn-relay.py &

exec "$@"
