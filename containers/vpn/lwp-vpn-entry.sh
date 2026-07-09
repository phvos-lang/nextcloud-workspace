#!/bin/bash
# Each ttyd client attaches to the same persistent tmux session (-A: create on
# first attach). The desktop unmounts minimized windows, which closes ttyd's
# websocket and kills its child — tmux keeps openconnect/ocproxy alive through
# minimize, page reloads, and tab closes; reopening reattaches.

# User-chosen terminal font (Profile → Terminal appearance) — see
# containers/terminal/lwp-terminal-entry.sh for the same pattern.
FONT_ARGS=()
[ -n "${LWP_TERM_FONT_FAMILY:-}" ] && FONT_ARGS+=(-t "fontFamily=${LWP_TERM_FONT_FAMILY}")
[ -n "${LWP_TERM_FONT_SIZE:-}" ]   && FONT_ARGS+=(-t "fontSize=${LWP_TERM_FONT_SIZE}")

exec ttyd --port 7681 --writable --base-path / \
     --ssl --ssl-cert /etc/ttyd/cert.pem --ssl-key /etc/ttyd/key.pem \
     "${FONT_ARGS[@]}" \
     tmux new-session -A -s vpn /usr/local/bin/lwp-vpn-connect.sh
