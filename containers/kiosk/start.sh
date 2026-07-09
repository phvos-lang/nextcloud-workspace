#!/bin/bash
# Kiosk launcher: Firefox --kiosk opens the URL full-screen with no toolbar,
# no address bar and no tabs. START_URL is injected by the backend.
URL="${START_URL:-about:blank}"

exec firefox \
    --no-remote \
    --new-instance \
    --kiosk \
    "$URL"
