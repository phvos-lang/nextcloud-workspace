# Apps — catalog & adding your own

LWP apps are containers proxied per-session under `/session/<token>/`. There are
two kinds:

- **Desktop apps (VNC)** — a GUI app on a virtual X display, streamed by KasmVNC.
  Base: `lwp-kasm-base`. Heavy (full desktop) but runs any Linux GUI app.
- **Web-native apps** — the app serves its own web UI; LWP proxies it directly,
  no VNC. Much lighter and crisper. The app must serve **HTTPS** (nginx proxies
  the session upstream as `https://`) and cope with the stripped path prefix.

The start menu badges apps **Web** vs **Desktop** (from the `web_native` flag)
and admins can toggle it per app in Admin → Apps.

## Built-in catalog

| App | Kind | Notes |
|---|---|---|
| Firefox, Vivaldi | VNC | browsers (Chromium-based needs `--no-sandbox`) |
| Thunderbird | VNC | Mozilla tarball (24.04 ships a snap) |
| LibreOffice | VNC | office suite |
| Terminator | VNC | GUI terminal + k8s CLI tooling, node via nvm, opencode (AI agent TUI — real X11 terminal, renders correctly unlike the ttyd web Terminal) |
| OpenCode | VNC | AI coding agent desktop app (Electron) |
| SSHPilot | VNC | GTK4 SSH client |
| VSCodium | VNC | VS Code (OSS) desktop build |
| Headlamp | VNC | Kubernetes desktop UI |
| FileZilla, Remmina | VNC | FTP/SFTP, RDP/VNC client |
| Ferdium | VNC | messaging aggregator |
| **Terminal** | web | ttyd → persistent GNU screen session (survives tab close/reload; Profile → "Keep Terminal running in the background" exempts it from idle suspend/reap, capped 48 h) + ssh/nc, kubectl/k9s/kubens/stern, bao (OpenBao), yq/jq/git/vim, node via nvm, ruff/yamllint/jsonlint |
| **JupyterLab** | web | notebooks |
| **pgweb** | web | Postgres web client |
| **htop** | web | ttyd-wrapped TUI |
| **VPN** | web | per-user OpenConnect gateway → SOCKS5 `vpn:1080`; per-window shield toggle routes each app direct or through the tunnel — see [vpn.md](vpn.md) |

Apps are seeded from `backend/app/services/seed.py` at backend startup
(idempotent by name — new presets are topped up on existing deployments
without touching admin-customised apps).

## Add a VNC (desktop) app

```dockerfile
# containers/myapp/Dockerfile
FROM lwp-kasm-base
RUN apt-get update && apt-get install -y --no-install-recommends myapp \
    && rm -rf /var/lib/apt/lists/*
ENV LWP_START_APP="myapp"
```
- KasmVNC serves on `8080` (already HTTPS). `LWP_START_APP` is run in the X session.
- Electron apps: run the real binary with `--no-sandbox` (not the CLI wrapper,
  which forks and would exit the session — that killed early VSCodium builds).

## Add a web-native app

If the app **serves its own TLS** (e.g. code-server `--cert`, ttyd `--ssl`),
just base it on anything and expose HTTPS on its port.

Otherwise use **`lwp-web-base`** — a non-root nginx that terminates HTTPS on
`:8080` and proxies to your HTTP app:

```dockerfile
FROM lwp-web-base
RUN <install your web app>
ENV LWP_APP_PORT=8081
CMD ["your-app", "--host", "127.0.0.1", "--port", "8081"]
```

### The path-prefix gotcha
LWP strips the dynamic `/session/<token>/` prefix before it reaches the app.
Apps that emit **absolute** paths (Jupyter, pgweb) then break. `lwp-web-base`
solves it: set `LWP_BASE_PREFIX=1` and the wrapper **re-adds** `/session/$LWP_SESSION_TOKEN/`
before proxying, so you can run the app with that as its base path
(`LWP_SESSION_TOKEN` is injected into every container):

```dockerfile
FROM lwp-web-base
ENV LWP_APP_PORT=8081 LWP_BASE_PREFIX=1
CMD ["bash","-lc","exec myapp --base-url /session/${LWP_SESSION_TOKEN}/ --port 8081"]
```
Apps that use **relative** asset paths (ttyd, code-server, pgweb) don't need this.

## Register the app

1. `containers/Makefile` — add a build target.
2. `backend/app/services/seed.py` — add a preset (set `web_native: True` for web apps).
3. A new Alembic migration inserting the app row `WHERE NOT EXISTS (… name …)`.
4. An icon in `frontend/public/icons/`.

Build: `cd containers && make base web-base <yourapp>`.
