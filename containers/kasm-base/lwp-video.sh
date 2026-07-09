#!/bin/bash
# WebCodecs beta stream: raw H.264 of the desktop on :8082, served by a Python
# per-connection HTTP server (a fresh ffmpeg per client). Idle cost is ~zero —
# no ffmpeg runs until a viewer connects.
export DISPLAY="${DISPLAY:-:1}"

# Wait for the X display (started by lwp-start-kasm.sh)
for _i in $(seq 1 200); do
    xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && break
    sleep 0.1
done

exec python3 /usr/local/bin/lwp-video-server.py
