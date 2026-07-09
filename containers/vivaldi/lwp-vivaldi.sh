#!/bin/bash
# Vivaldi (Chromium) leaves Singleton{Lock,Socket,Cookie} in the profile when the
# container is killed uncleanly. They live in the persistent home and, since the
# container hostname changes each launch, the stale lock blocks the next start.
# Remove them before launching so Vivaldi always comes up.
rm -f "$HOME/.config/vivaldi/Singleton"* 2>/dev/null || true

exec vivaldi \
    --no-sandbox --disable-dev-shm-usage --disable-gpu --no-zygote \
    --start-maximized --no-first-run "$@"
