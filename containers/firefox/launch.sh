#!/bin/bash
exec firefox \
    --no-remote \
    --new-instance \
    --maximized \
    "${START_URL:-about:newtab}"
