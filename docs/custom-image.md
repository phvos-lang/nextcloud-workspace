# Building a Custom App Image

LWP runs any container that:
- Extends `lwp-vnc-base` (or provides its own KasmVNC setup)
- Sets `ENV LWP_START_APP="<command>"` — the command xstartup will exec after openbox starts
- Exposes port `8080` (KasmVNC HTML5 client)

---

## How lwp-vnc-base works

| Detail | Value |
|---|---|
| Base | Ubuntu 22.04 |
| VNC server | KasmVNC (`vncserver :1`, websocket port **8080**) |
| Audio | PulseAudio null sink, socket at `/run/user/1000/pulse/native` |
| Init | supervisord (root) → `lwp-start-kasm.sh` (lwp user) |
| App user | `lwp` (uid 1000) |
| App start | `xstartup` → openbox (kiosk mode) → `$LWP_START_APP` |
| Storage | Optional rclone WebDAV mount at `$LWP_NC_MOUNT` (supervisord `lwp-rclone` service) |

### supervisord services

| Service | Role |
|---|---|
| `lwp-kasm` | Runs `lwp-start-kasm.sh`: starts PulseAudio, waits for PA socket, then starts KasmVNC |
| `lwp-rclone` | Mounts Nextcloud WebDAV at `$LWP_NC_MOUNT` (skipped if `$LWP_NC_URL` is unset) |
| `lwp-mounts` | Mounts the user's extra SFTP/S3 remotes under `~/Mount/<name>` from `$LWP_MOUNTS` (skipped if unset) |
| `lwp-vpn-relay` | Per-session SOCKS5 switchboard on `127.0.0.1:1081` — direct or via the user's VPN gateway, driven by the window's shield toggle (exits if `$LWP_VPN_UPSTREAM` is unset) |

### Session lifecycle (self-stop)

When the app exits inside the VNC session:
1. `xstartup` detects `$LWP_START_APP` process exited
2. Calls `POST $LWP_BACKEND_URL/api/sessions/self-stop` with `X-Session-Token: $LWP_SESSION_TOKEN`
3. Creates `/tmp/.lwp-app-exited` flag, kills vncserver
4. `lwp-start-kasm.sh` sees the flag, exits with code 0
5. supervisord (`autorestart=unexpected, exitcodes=0`) does **not** restart → container exits
6. LWP frontend auto-closes the window (next 30 s session poll)

---

## Minimal example

```dockerfile
FROM lwp-vnc-base:latest

# Install the application
RUN apt-get update && apt-get install -y --no-install-recommends \
        gedit \
    && rm -rf /var/lib/apt/lists/*

# Tell xstartup what to launch
ENV LWP_START_APP="gedit"
```

Build and test:

```bash
docker build -t lwp-gedit:latest .

# Quick test (no LWP stack needed):
docker run --rm \
  -e PUID=1000 -e PGID=1000 \
  -e LWP_START_APP="gedit" \
  --shm-size=512m \
  -p 8080:8080 \
  lwp-gedit:latest

# Open http://localhost:8080 — gedit should appear, audio works
```

---

## Full example: Developer Desktop

Adds VS Code, Python 3, Node.js LTS, and Git on top of `lwp-vnc-base`.

```dockerfile
FROM lwp-vnc-base:latest

# System packages
RUN apt-get update && apt-get install -y --no-install-recommends \
        git curl wget jq \
        python3 python3-pip python3-venv \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Node.js LTS
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# VS Code
RUN curl -fsSL "https://code.visualstudio.com/sha/download?build=stable&os=linux-deb-x64" \
        -o /tmp/vscode.deb \
    && apt-get install -y /tmp/vscode.deb \
    && rm /tmp/vscode.deb \
    && rm -rf /var/lib/apt/lists/*

ENV LWP_START_APP="code --no-sandbox --user-data-dir=/home/lwp/.vscode-data"
```

---

## Environment variables injected by LWP

LWP injects these into every session container at launch:

| Variable | Value | Notes |
|---|---|---|
| `PUID` | `1000` | Run as uid 1000 (`lwp`) |
| `PGID` | `1000` | |
| `TZ` | `UTC` | Override per app in admin panel |
| `LWP_SESSION_TOKEN` | random 32-byte token | Used for `self-stop` callback only |
| `LWP_BACKEND_URL` | `http://backend:8000` | Internal network URL |
| `LWP_NC_URL` | Nextcloud WebDAV URL | Only if user has NC configured |
| `LWP_NC_USER` | NC username | Only if user has NC configured |
| `LWP_NC_PASS` | NC password (plaintext in env) | Fernet-decrypted at launch |
| `LWP_NC_MOUNT` | `/home/lwp/Files` | Mount point inside container |

You can also define **extra env vars per app definition** in the admin panel (`env_json` field). These merge with the above (app env takes precedence).

---

## xstartup customisation

`/etc/lwp/xstartup` runs inside the Xvnc session. It sets up GTK theming, D-Bus, openbox, then executes `$LWP_START_APP`. To override, add a custom file in your image:

```dockerfile
COPY my-xstartup /etc/lwp/xstartup
RUN chmod +x /etc/lwp/xstartup
```

Minimal working xstartup:
```bash
#!/bin/bash
export DISPLAY=:1
export PULSE_RUNTIME_PATH=/run/user/1000/pulse
openbox --config-file /etc/lwp/openbox.xml &
sleep 0.5
${LWP_START_APP}
# Self-stop on exit (copy these lines from the base image xstartup)
curl -sf -X POST "${LWP_BACKEND_URL:-http://backend:8000}/api/sessions/self-stop" \
  -H "X-Session-Token: ${LWP_SESSION_TOKEN:-}" 2>/dev/null || true
touch /tmp/.lwp-app-exited
vncserver -kill :1 2>/dev/null || true
```

---

## Register the app in LWP

1. Log in as admin → **Apps** → **Add App**
2. Fill in:

| Field | Example |
|---|---|
| Name | Developer Desktop |
| Container image | `registry.example.com/lwp/dev-desktop:latest` |
| Category | Development |
| Icon URL | any PNG URL |
| App type | `stream` (VNC) |
| Proxy port | `8080` |
| CPU limit | `2000m` |
| Memory limit | `4Gi` |
| SHM size | `1Gi` (needed for Chromium/Electron apps) |
| Mount home | ✓ (creates persistent Docker volume per user) |

3. **Permissions** tab → assign to groups that should see this app.

---

## Tips

**Audio** — works automatically. PulseAudio creates a null sink; KasmVNC streams it to the browser via Web Audio API. No extra config needed in your Dockerfile.

**Persistent home** — enabling `mount_home` creates a Docker named volume `lwp-home-{user_id}` mounted at `/home/lwp`. Data survives container restarts.

**Nextcloud files** — if the user has Nextcloud configured, rclone mounts it at `/home/lwp/Files` using `--vfs-cache-mode full`. Files are cached locally on first access; SQLite databases (browser profiles etc.) work normally.

**Large SHM** — Chromium-based apps need `/dev/shm` ≥ 512 MB to avoid silent renderer crashes. Set `shm_size = "1Gi"` in the app definition.

**Browser profile location** — use `/home/lwp/.config/chromium` or `~/.mozilla` (on the persistent home volume, if enabled). Do not store browser profiles on the Nextcloud mount — use the home volume for live profile data, and Nextcloud for documents/downloads.

**XDG directories on Nextcloud** — when Nextcloud is configured, `~/Documents`, `~/Downloads`, `~/Music`, `~/Pictures`, `~/Templates`, and `~/Videos` are automatically symlinked into the Nextcloud mount (`~/Files/{dir}`). No app configuration needed; save dialogs and file managers just work.

**Self-stop** — make sure your image runs the curl self-stop call in xstartup (or equivalent). Without it, the container will eventually be cleaned up by the 8-hour session watchdog, but the window will stay open in the browser until then.
