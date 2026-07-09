#!/bin/bash
# Start the Nextcloud rclone mount in the background (no-op if LWP_NC_URL is
# unset), then hand off to ttyd. Runs as user lwp.
/usr/local/bin/lwp-nc-mount.sh &

# Extra SFTP/S3 mounts under ~/Mount/<name> (no-op if LWP_MOUNTS is unset)
/usr/local/bin/lwp-mounts.sh &

# VPN relay (exits 0 immediately when LWP_VPN_UPSTREAM is unset — no gateway)
/usr/local/bin/lwp-vpn-relay.py &

# Truecolor-aware apps (opencode) commonly check COLORTERM directly rather
# than querying terminfo — screen's own 'truecolor on' (screenrc) handles the
# terminal escape sequences, this handles the env-var check.
export COLORTERM=truecolor

# User-chosen terminal font (Profile → Terminal appearance), applied by the
# backend as LWP_TERM_FONT_FAMILY/SIZE at launch — xterm.js runs client-side,
# so the font just needs to exist on the user's own machine.
FONT_ARGS=()
[ -n "${LWP_TERM_FONT_FAMILY:-}" ] && FONT_ARGS+=(-t "fontFamily=${LWP_TERM_FONT_FAMILY}")
[ -n "${LWP_TERM_FONT_SIZE:-}" ]   && FONT_ARGS+=(-t "fontSize=${LWP_TERM_FONT_SIZE}")

# Every ttyd client attaches the same persistent GNU screen session (-xRR:
# multi-attach, reattach or create). Closing/reloading the tab keeps whatever
# is running; reopening reattaches. screen over tmux: it leaves the mouse
# alone, so browser-native text selection and copy/paste just work.
# DOM renderer: xterm.js WebGL canvas can go black on iframe resizes
# (lost GL context); DOM is plenty fast for a terminal and never blanks.
exec ttyd --port 7681 --writable --base-path / \
     --ssl --ssl-cert /etc/ttyd/cert.pem --ssl-key /etc/ttyd/key.pem \
     -t rendererType=dom "${FONT_ARGS[@]}" \
     screen -xRR -S lwp
