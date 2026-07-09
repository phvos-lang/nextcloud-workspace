#!/bin/bash
# Runs as root (supervisord user=root).

mkdir -p /run/user/1000
chown lwp:lwp /run/user/1000
chmod 700 /run/user/1000

# X.Org requires /tmp/.X11-unix owned by root
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# K8s PVCs start empty; Docker named volumes pre-populate from the image.
# Seed /home/lwp from the baked-in skeleton on first boot either way.
if [ ! -f /home/lwp/.lwp-initialized ]; then
    cp -rn /etc/lwp/skel/. /home/lwp/ 2>/dev/null || true
    chown -R lwp:lwp /home/lwp
    touch /home/lwp/.lwp-initialized
fi

# Clean stale X files as root (can delete root-owned files too)
rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 2>/dev/null

exec su -s /bin/bash lwp -c '
  export XDG_RUNTIME_DIR=/run/user/1000
  export PULSE_RUNTIME_PATH=/run/user/1000/pulse
  export HOME=/home/lwp
  export DISPLAY=:1

  pkill -9 -x openbox    2>/dev/null || true
  pkill -9 -x pulseaudio 2>/dev/null || true
  vncserver -kill :1     2>/dev/null || true
  rm -f /tmp/.X1-lock /tmp/.X11-unix/X1 2>/dev/null

  # kasmpasswd must exist with ≥1 user or vncserver exits.
  # -disablebasicauth below means Xvnc never checks it for HTTP auth.
  if [ ! -s "$HOME/.kasmpasswd" ]; then
    printf "lwpvnc\nlwpvnc\n" | kasmvncpasswd -u lwp -wo
  fi

  # PulseAudio null sink — KasmVNC streams audio to the browser
  mkdir -p /run/user/1000/pulse
  pulseaudio --start \
    --file=/home/lwp/.config/pulse/default.pa \
    --exit-idle-time=-1 \
    --daemon 2>/dev/null || true
  # Wait for unix socket before starting KasmVNC so it can attach to PA at launch.
  # Fine granularity (0.05s) so we proceed the instant PA is ready (~10s cap).
  for _i in $(seq 1 200); do
    [ -S /run/user/1000/pulse/native ] && break
    sleep 0.05
  done

  # vncserver wrapper reads kasmvnc.yaml and passes the right flags to Xvnc
  # (websocket_port 8080, use_ipv6 false, no ICE — unlike calling Xvnc directly).
  # -select-de manual: skip the interactive DE chooser, use ~/.vnc/xstartup directly.
  # -disablebasicauth: vncserver passes unknown flags through to Xvnc;
  # nginx auth_request handles session auth, so per-container HTTP auth is unnecessary.
  # Perf tuning (verified against KasmVNC 1.4 Xvnc -help; vncserver passes
  # unknown flags through to Xvnc):
  #   FrameRate 60          — default, explicit for clarity
  #   DynamicQualityMin 5   — allow harder compression under motion (default 7 = too heavy)
  #   DynamicQualityMax 9   — crisp when bandwidth allows (default 8)
  #   TreatLossless 9       — idle/static screens refine to lossless (default 10 = off)
  #   VideoTime 2           — switch to efficient video mode after 2s of motion (default 5)
  #   VideoOutTime 2        — leave video mode 2s after motion stops (default 3)
  #   webpEncodingTime 70   — allot more of each frame encode budget to WebP.
  #   RectThreads 0         — auto: compress rects across all available cores.
  vncserver :1 \
    -select-de manual \
    -depth 24 \
    -geometry 1920x1080 \
    -disablebasicauth \
    -FrameRate 60 \
    -DynamicQualityMin 5 \
    -DynamicQualityMax 9 \
    -TreatLossless 9 \
    -VideoTime 2 \
    -VideoOutTime 2 \
    -webpEncodingTime 70 \
    -RectThreads 0

  # Xvnc PID is in the lock file after daemonisation
  XVNC_PID=""
  for i in $(seq 1 15); do
    XVNC_PID=$(cat /tmp/.X1-lock 2>/dev/null | tr -d " \n")
    [ -n "$XVNC_PID" ] && kill -0 "$XVNC_PID" 2>/dev/null && break
    sleep 0.5
  done

  if [ -z "$XVNC_PID" ]; then
    echo "ERROR: Xvnc failed to start (no lock file)" >&2
    echo "=== Xvnc log ===" >&2
    # KasmVNC names the log $HOME/.vnc/$(hostname):1.log
    cat "$HOME/.vnc/$(hostname):1.log" 2>/dev/null >&2 || echo "(no log)" >&2
    exit 1
  fi

  echo "Xvnc running as PID $XVNC_PID, web interface on port 8080"

  # Keep this process alive so supervisord tracks it.
  # "wait" only works for child PIDs; Xvnc was daemonised so use a poll loop.
  while kill -0 "$XVNC_PID" 2>/dev/null; do
    sleep 2
  done

  # Exit 0 when app closed cleanly (xstartup sets flag), 1 on VNC crash so
  # supervisord (autorestart=unexpected exitcodes=0) knows whether to restart.
  if [ -f /tmp/.lwp-app-exited ]; then
    echo "App exited — container done"
    exit 0
  fi
  echo "Xvnc crashed — supervisord will restart"
  exit 1
'
