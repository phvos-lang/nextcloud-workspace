#!/bin/bash
# Interactive VPN login shown in the ttyd terminal, driven by whiptail (newt)
# dialogs. Collects server/username/password/OTP in ncurses boxes, then feeds
# the credentials to openconnect over stdin; on connect ocproxy serves SOCKS5
# on 0.0.0.0:1080 for the user's other sessions.
#
# Defaults come from the app's env_json (admin-configurable):
#   LWP_VPN_SERVER    portal/gateway hostname
#   LWP_VPN_USER      username preset
#   LWP_VPN_PROTOCOL  openconnect protocol (default: gp)
set -u

SERVER="${LWP_VPN_SERVER:-}"
VPN_USER="${LWP_VPN_USER:-}"
PROTO="${LWP_VPN_PROTOCOL:-gp}"
TITLE="LWP VPN gateway"

# newt theme — blue window, yellow title
export NEWT_COLORS='
root=,black
window=,blue
border=white,blue
title=yellow,blue
textbox=white,blue
button=black,white
'

post_state() {
    curl -s -m 5 -X POST "${LWP_BACKEND_URL:-http://backend:8000}/api/sessions/vpn/state" \
         -H "Content-Type: application/json" \
         -H "X-Session-Token: ${LWP_SESSION_TOKEN:-}" \
         -d "{\"connected\": $1}" >/dev/null 2>&1 || true
}

# Box geometry — aim for a roomy ~100x30 start screen, clamped to the actual
# terminal so whiptail never errors on a smaller window.
COLS=$(tput cols 2>/dev/null || echo 80)
LINES_=$(tput lines 2>/dev/null || echo 24)
BOXW=$(( COLS - 6 ));   [ "$BOXW" -gt 100 ] && BOXW=100; [ "$BOXW" -lt 50 ] && BOXW=50
BIGH=$(( LINES_ - 4 )); [ "$BIGH" -gt 30 ]  && BIGH=30;  [ "$BIGH" -lt 16 ] && BIGH=16
INH=11

# whiptail returns the entered value on fd 3; non-zero exit = Cancel/Esc
ask() { whiptail --title "$TITLE" "$@" 3>&1 1>&2 2>&3; }

# Fresh gateway (or reconnect after a page reload) starts disconnected
post_state false

ask --msgbox "OpenConnect VPN gateway (userspace — no root).

While connected, your OTHER sessions reach the tunnel at:

    socks5h://vpn:1080

• Browsers: SOCKS5 host \"vpn\" port 1080 (enable proxy DNS).
• Terminals/ssh: preset automatically for sessions opened
  while the VPN is up.

TCP only. The tunnel runs in tmux — minimising or closing
this window does NOT disconnect it; the taskbar shield
reopens it. Ctrl+C here disconnects." "$BIGH" "$BOXW"

while true; do
    SERVER=$(ask --inputbox "VPN portal / gateway host:" "$INH" "$BOXW" "$SERVER") || { clear; exit 0; }
    if [ -z "$SERVER" ]; then
        ask --msgbox "A portal host is required." 8 46; continue
    fi
    VPN_USER=$(ask --inputbox "Username:" "$INH" "$BOXW" "$VPN_USER") || { clear; exit 0; }
    if [ -z "$VPN_USER" ]; then
        ask --msgbox "A username is required." 8 46; continue
    fi
    PASS=$(ask --passwordbox "Password for $VPN_USER:" "$INH" "$BOXW") || continue
    OTP=$(ask --passwordbox "OTP / MFA token (leave blank if not required):" "$INH" "$BOXW") || continue

    clear
    echo "Connecting to $SERVER as $VPN_USER (protocol: $PROTO)…"
    echo "(on success this window minimises — the green taskbar shield reopens it)"
    echo

    # Feed password (and OTP) as successive stdin lines. openconnect reads its
    # auth-form answers from stdin when stdin is not a TTY. Bash's builtin
    # printf keeps the secrets out of the process table.
    if [ -n "$OTP" ]; then
        printf '%s\n%s\n' "$PASS" "$OTP"
    else
        printf '%s\n' "$PASS"
    fi | openconnect --protocol="$PROTO" --user="$VPN_USER" "$SERVER" \
             --script-tun --script /usr/local/bin/lwp-vpn-up.sh
    unset PASS OTP

    post_state false
    if ! ask --yesno "VPN disconnected.\n\nLog in again?" 9 50; then
        clear; exit 0
    fi
done
