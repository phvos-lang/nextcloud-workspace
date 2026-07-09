# Architecture

## Component diagram

```
  Browser (HTTPS/WSS)
      │
      ▼
  ┌─────────────────────────────────────────────────────┐
  │  Nginx                                               │
  │   /                   → Frontend (React SPA)         │
  │   /api/               → Backend (FastAPI)            │
  │   /session/{token}/   → auth_request → VNC container │
  └─────────────────────────────────────────────────────┘
           │                        │
           ▼                        ▼
      Backend (FastAPI)         VNC Container
      PostgreSQL                (lwp-vnc-base)
      Redis                     port 8080 — KasmVNC HTML5
                                PulseAudio — audio
                                rclone — WebDAV mount
```

Auth: external OIDC provider (Azure AD / Okta / Auth0 / Authentik / Google)
      + local bcrypt + LDAP — all produce the same JWT cookie session

## Container image stack

```
lwp-kasm-base  (Ubuntu 24.04 + KasmVNC + PulseAudio + ffmpeg audio + supervisord + rclone + lwp-xdg-open)
     │  VNC desktop apps — KasmVNC serves HTML5 client on 8080 (HTTPS)
     ├── lwp-chromium / lwp-firefox / lwp-thunderbird / lwp-libreoffice
     └── lwp-terminator / sshpilot / vscodium / headlamp / filezilla / remmina / ferdium

lwp-terminal   (Ubuntu 24.04 + ttyd, own TLS, port 7681 — no X11)
     └── lwp-k9s / lwp-htop   (FROM lwp-terminal, CMD = ttyd <tool>)

lwp-web-base   (Ubuntu 24.04 + non-root nginx TLS wrapper, port 8080)
     └── lwp-jupyterlab / lwp-pgweb   (HTTP app behind the wrapper)

lwp-code-server (Ubuntu 24.04 + code-server, own TLS --cert, port 8080)
```

**Web-native routing.** LWP strips `/session/<token>/` before proxying. VNC/ttyd/
code-server use relative paths so they work at any base. Absolute-path apps
(Jupyter, pgweb) run behind `lwp-web-base` with `LWP_BASE_PREFIX=1`, which re-adds
`/session/$LWP_SESSION_TOKEN/` inside the container so the app's base path matches.
See [apps.md](apps.md).

**Inside every kasm-base container:**

| Process | Manager | Role |
|---|---|---|
| `lwp-start-kasm.sh` | supervisord | Starts PulseAudio, waits for PA socket, then starts KasmVNC (`vncserver :1`) |
| KasmVNC / Xvnc | via vncserver | X server + VNC; HTML5 client served at `/` on port 8080 |
| xstartup | KasmVNC | Starts openbox (kiosk mode) then runs `$LWP_START_APP` |
| `lwp-rclone` | supervisord | rclone FUSE mount of Nextcloud WebDAV at `$LWP_NC_MOUNT` (optional) |
| `lwp-audio` | supervisord | `ffmpeg` streams the PulseAudio sink monitor as Opus/Ogg on `:8081`; the backend relays it to the browser's `<audio>` (KasmVNC 1.4's client has no standalone audio) |
| `lwp-xdg-open` | `/usr/bin/xdg-open` | xdg-open replacement — calls backend `POST /api/sessions/open-file` so the LWP frontend handles the file natively |

**Inside lwp-terminal:**

| Process | Role |
|---|---|
| `ttyd` | Web terminal (bash) via WebSocket; HTML5 client served at `/` on port 7681 |

## Request flows

### Login (OIDC)

```
User → GET /api/auth/oidc/login
     → redirect to IdP
IdP  → GET /api/auth/oidc/callback?code=…
     → backend exchanges code, upserts user + groups in DB
     → sets HttpOnly JWT cookies (access 60 min, refresh 7 days)
     → redirect to /
Frontend → GET /api/auth/me → load user + preferences into Zustand
         → GET /api/sessions → restore running sessions as windows
```

### Login (local / LDAP)

```
User → POST /api/auth/login {username, password}
     → if TOTP enabled: returns {requires_totp: true, totp_token: "…"}
       → POST /api/auth/2fa/verify {totp_token, code}
     → on success: same JWT cookies as OIDC
```

### Launch session

```
User clicks app → POST /api/sessions {app_id}
Backend:
  1. Check max_sessions_per_user limit
  2. Generate session_token (32-byte random)
  3. Start Docker container (dev) / K8s Pod + Service (prod):
       - Image: app.container_image
       - Env: PUID=1000, LWP_START_APP, LWP_SESSION_TOKEN,
              LWP_BACKEND_URL, Nextcloud credentials (if configured)
  4. Store session record (status=starting)
  5. Return {connect_url: "/session/{token}/", …}
Frontend:
  - Opens Window component
  - Polls connect_url until HTTP 200 (KasmVNC ready, ~3–10s)
  - Renders iframe to connect_url?resize=remote&autoconnect=1
```

### Session proxy (Nginx auth_request)

```
Browser  →  GET /session/{token}/…
Nginx    →  auth_request /api/sessions/validate
             Header: X-Session-Token: {token}
Backend  →  validates token, returns 200
             Header: X-Session-Upstream: {container-ip}:8080
Nginx    →  proxy_pass https://$session_upstream
             WebSocket upgrade → persistent tunnel → KasmVNC desktop
```

### Session end — user closes window

```
User clicks X → DELETE /api/sessions/{id}
Backend:
  1. Calls container_svc.stop() → docker stop+rm (dev) / delete Pod+Service (k8s)
  2. Sets session.status = "stopped", ended_at = now
Frontend:
  - closeWindow(windowId)
  - Invalidates sessions query
```

### Session end — app exits inside VNC

```
App exits (e.g. user closes Firefox from within VNC)
xstartup:
  1. POST http://backend:8000/api/sessions/self-stop
       Header: X-Session-Token: {LWP_SESSION_TOKEN}
     → Backend sets session.status = "stopped"
  2. Touches /tmp/.lwp-app-exited
  3. Kills vncserver

lwp-start-kasm.sh:
  - Poll loop detects Xvnc is gone
  - Finds /tmp/.lwp-app-exited flag → exit 0

supervisord (autorestart=unexpected, exitcodes=0):
  - Exit 0 = clean close → does NOT restart → container exits

Frontend (30s sessions poll):
  - sessionId no longer in list → auto-closes window
```

### Idle suspend

```
useIdleTimer (15 min, browser events: mouse/key/touch/scroll)
  → onIdle: POST /api/sessions/{id}/pause (for each running window)
    Backend: docker pause / k8s scale to 0; status = "suspended"
    Frontend: shows suspended overlay on window

  → onActive (first event after idle):
    POST /api/sessions/{id}/resume
    Backend: docker unpause / k8s scale to 1; status = "running"
    Frontend: removes overlay
```

## Data model (PostgreSQL)

```
users
  id, email, username, display_name
  auth_source (oidc|local|ldap)
  is_admin, is_active
  preferences JSONB          ← wallpaper, theme, layout, pinned, quickLaunch, logout_sessions
  totp_secret_enc            ← Fernet-encrypted TOTP secret (local/ldap only)
  totp_pending_enc           ← Fernet-encrypted pending setup secret

user_groups ──< groups

apps (formerly "images")
  id, name, description, category
  app_type (stream|web|kasm)
  container_image, proxy_port
  cpu_limit, mem_limit, shm_size
  env_json, mount_home, is_enabled

app_permissions ── groups → apps

sessions
  id, user_id, app_id
  pod_name, service_name, session_token
  upstream_host, proxy_port
  status (starting|running|suspended|stopped|error)
  app_type, window_state JSONB
  started_at, ended_at

audit_log
  id, user_id, action, resource, detail, ip, created_at

settings (key/value)
```

### User preferences (JSONB)

Stored in `users.preferences` and synced to the frontend on login. Patched via `PATCH /api/auth/me/preferences` (shallow merge, debounced 600 ms from frontend).

| Key | Type | Description |
|---|---|---|
| `wallpaper` | string | CSS gradient or image URL |
| `theme` | `"dark"\|"light"\|"system"` | UI theme |
| `desktopLayout` | `"icons"\|"tiles"\|"clean"` | Desktop icon layout |
| `pinned` | `PinnedItem[]` | Desktop icon list |
| `quickLaunch` | `string[]` | App IDs pinned to taskbar |
| `logout_sessions` | `"keep"\|"stop"\|"ask"` | Remembered logout choice |

## Security

- JWT access tokens in **HttpOnly, SameSite=Lax** cookies — inaccessible to JavaScript
- Session tokens are **32-byte URL-safe random** strings stored in PostgreSQL
- TOTP secrets and Nextcloud passwords are **Fernet-encrypted** at rest (key derived from `SECRET_KEY`)
- Container env injects `LWP_SESSION_TOKEN` so containers can self-authenticate to the backend (self-stop only); token is write-once, never returned in any API response after session creation
- NetworkPolicy: session containers cannot reach other pods — only Nginx and internet egress
- Nginx rate-limits `/api/auth/` to 10 req/min per IP
- TLS termination at Nginx — operator provides certificate (no ACME / Let's Encrypt)
- `auth_request` on every byte of the session proxy path — no bypass possible

### xdg-open bridge (file manager integration)

```
User double-clicks file in KasmVNC session (e.g. Thunar)
  → xdg-open /home/lwp/Files/Documents/report.pdf

lwp-xdg-open.sh (replaces /usr/bin/xdg-open):
  1. Resolves absolute path, detects MIME type via `file --mime-type`
  2. POST http://backend:8000/api/sessions/open-file
       Header: X-Session-Token: $LWP_SESSION_TOKEN
       Body: {path, mime}
  → Backend validates token, appends event to in-memory queue for user

Frontend (Desktop.tsx, useOpenFilePoll hook, polls every 3 s):
  GET /api/sessions/open-file/poll
  → receives [{path: "/home/lwp/Files/Documents/report.pdf", mime: "application/pdf"}]
  → maps /home/lwp/Files/ → NC root path
  → opens FileManagerWindow at that path (PDF/image shows inline viewer)
```

## Native desktop windows

In addition to VNC session windows (iframes), LWP renders native React windows:

| Window | Trigger | Component |
|---|---|---|
| **File Manager** | 🗂️ desktop icon / xdg-open bridge | `FileManagerWindow.tsx` |
| **PDF Viewer** | double-click `.pdf` in file manager | inline iframe inside FileManagerWindow |
| **Image Lightbox** | double-click image in file manager | overlay inside FileManagerWindow |
| **Admin** | 🛡️ desktop icon | `AdminWindow.tsx` |
| **Storage** | taskbar / profile | `StorageWindow.tsx` |
| **Profile** | taskbar avatar | `ProfileWindow.tsx` |

All native windows use `react-rnd` for drag/resize, matching the VNC session window UX.

## File manager

- API: `/api/storage/files` (list PROPFIND), `/files/download`, `/files/upload`, `/files/mkdir`, `/files/thumbnail`, `/files/preview`
- Thumbnails: proxied through backend via Nextcloud preview API; rendered via `<img>` (cookies are sent automatically — auth is transparent)
- PDF inline: `/api/storage/files/preview?path=…` returns `Content-Disposition: inline`; rendered in `<iframe>`
- Upload: drag-and-drop to window, or toolbar Upload button (multipart POST)
- Navigation: sidebar quick-access (Home / Documents / Downloads / Music / Pictures / Videos), breadcrumb, back button

## Frontend state

```
Zustand (desktop.ts)
  windows[]          Running session windows (positions, muted, suspended, workspace)
  pinned[]           Desktop icon list
  quickLaunch[]      Taskbar quick-launch app IDs
  wallpaper          Active wallpaper (CSS or URL)
  theme              dark | light | system
  desktopLayout      icons | tiles | clean
  workspaces[]       ["1","2","3","4"]
  activeWorkspace    Currently visible workspace
  fileManagerOpen    Whether FileManagerWindow is shown
  fileManagerPath    Initial/current path for the file manager

localStorage (zustand/persist):
  pinned, quickLaunch, wallpaper, theme, desktopLayout, workspaces, activeWorkspace
  (server preferences overwrite on login — localStorage is a warm cache only)

TanStack Query (30s refetch):
  ["sessions"]       Running sessions — auto-restores windows; auto-closes orphaned windows
  ["apps"]           App catalog
```
