#!/bin/bash
# Desktop audio: an HTTP server on :8081 that streams the PulseAudio sink monitor
# as Opus/Ogg (a fresh ffmpeg per connection). The backend relays it to the
# browser's <audio> — this bypasses KasmVNC's proprietary in-client audio.
export XDG_RUNTIME_DIR=/run/user/1000
export PULSE_RUNTIME_PATH=/run/user/1000/pulse
export HOME=/home/lwp

# Wait for the PulseAudio socket (started by lwp-start-kasm.sh).
for _i in $(seq 1 200); do
    [ -S /run/user/1000/pulse/native ] && break
    sleep 0.1
done

exec python3 /usr/local/bin/lwp-audio-server.py
