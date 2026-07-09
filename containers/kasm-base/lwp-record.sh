#!/bin/bash
# Session recorder — active only when LWP_RECORD=1 (record_sessions group policy).
# Records DISPLAY in 60s mp4 segments; a background loop uploads finished
# segments to the backend and deletes them locally. Survives display resizes:
# ffmpeg dies on geometry change, the outer loop restarts it at the new size.
set -u

[ "${LWP_RECORD:-0}" = "1" ] || exit 0

REC_DIR=/tmp/lwp-rec
SEG_SECS=60
mkdir -p "$REC_DIR"

# Wait for the X display
for _ in $(seq 1 60); do
    xdpyinfo -display "${DISPLAY:-:1}" >/dev/null 2>&1 && break
    sleep 1
done

# Uploader: everything except the newest file is a finished segment
upload_loop() {
    while true; do
        sleep 10
        files=$(ls -1 "$REC_DIR"/*.mp4 2>/dev/null | sort)
        n=$(echo "$files" | grep -c . || true)
        [ "$n" -le 1 ] && continue
        echo "$files" | head -n -1 | while read -r f; do
            seq_name=$(basename "$f" .mp4)
            if curl -fsS -X POST \
                 -H "X-Session-Token: ${LWP_SESSION_TOKEN:-}" \
                 -H "Content-Type: video/mp4" \
                 --data-binary "@$f" \
                 "${LWP_BACKEND_URL:-http://backend:8000}/api/sessions/recording?seq=${seq_name}" \
                 >/dev/null; then
                rm -f "$f"
            fi
        done
    done
}
upload_loop &
UPLOAD_PID=$!

# Flush remaining segments on shutdown
flush() {
    kill "$UPLOAD_PID" 2>/dev/null
    for f in "$REC_DIR"/*.mp4; do
        [ -f "$f" ] || continue
        seq_name=$(basename "$f" .mp4)
        curl -fsS -m 20 -X POST \
             -H "X-Session-Token: ${LWP_SESSION_TOKEN:-}" \
             -H "Content-Type: video/mp4" \
             --data-binary "@$f" \
             "${LWP_BACKEND_URL:-http://backend:8000}/api/sessions/recording?seq=${seq_name}" \
             >/dev/null && rm -f "$f"
    done
    exit 0
}
trap flush TERM INT

# Capture loop — restart on resize/error with the current geometry
START_EPOCH=$(date +%s)
while true; do
    GEOM=$(xdpyinfo -display "${DISPLAY:-:1}" | awk '/dimensions:/{print $2}')
    [ -n "$GEOM" ] || { sleep 2; continue; }
    # Segment numbers keyed to elapsed seconds so restarts never collide
    OFFSET=$(( $(date +%s) - START_EPOCH ))
    ffmpeg -nostdin -loglevel error \
        -f x11grab -framerate 5 -video_size "$GEOM" -i "${DISPLAY:-:1}" \
        -codec:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p -g 50 \
        -f segment -segment_time "$SEG_SECS" -reset_timestamps 1 \
        -segment_start_number "$OFFSET" \
        "$REC_DIR/%010d.mp4" &
    FFMPEG_PID=$!
    wait "$FFMPEG_PID"
    sleep 2
done
