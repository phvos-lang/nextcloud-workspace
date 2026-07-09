#!/bin/bash
# When the session was launched with a live VPN gateway, the orchestrator sets
# LWP_VPN_PROXY (socks5h://127.0.0.1:1081 — the in-container relay, which goes
# direct or through the tunnel per the window's VPN toggle). Point Firefox at
# it via enterprise policies — including SOCKS DNS, so names resolve wherever
# the relay dials. Users can still override it in Settings (not Locked).
if [ -n "${LWP_VPN_PROXY:-}" ]; then
    hostport="${LWP_VPN_PROXY#*://}"
    cat > /opt/firefox/distribution/policies.json <<EOF
{
  "policies": {
    "Proxy": {
      "Mode": "manual",
      "SOCKSProxy": "${hostport}",
      "SOCKSVersion": 5,
      "UseProxyForDNS": true,
      "Locked": false
    }
  }
}
EOF
fi

# No --no-remote: keeps the instance reachable so "Open with…" (re-invoking
# `firefox <file>`) opens a tab in this running window instead of a 2nd copy.
exec firefox --maximized "${START_URL:+$START_URL}"
