#!/bin/bash
# Start gnome-keyring-daemon so libsecret has a backend for storing credentials.
# eval exports GNOME_KEYRING_CONTROL and SSH_AUTH_SOCK into this shell.
eval $(gnome-keyring-daemon --start --components=secrets,ssh 2>/dev/null) || true
export GNOME_KEYRING_CONTROL SSH_AUTH_SOCK

exec sshpilot
