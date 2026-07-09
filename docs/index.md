# Nextcloud Linux Workspace (LWP)

> **Proof of Concept** — a working demo/evaluation build, not a hardened production release.

Browser-based remote desktop — a Kasm alternative built on a custom
VNC stack with a full windowed desktop experience, deeply integrated with
Nextcloud.

**Stack:** React 18 + FastAPI + PostgreSQL + Redis, KasmVNC session containers
behind an nginx `auth_request` proxy. Docker Compose for dev, Kubernetes for
production. External OIDC/LDAP/local auth — bring your own IdP and TLS certs.

## Highlights

- **Windowed desktop in the browser** — drag, snap, Alt-Tab, workspaces,
  Exposé, taskbar, wallpapers.
- **App catalog** — Firefox, Vivaldi, Thunderbird, LibreOffice, VSCodium,
  OpenCode, FileZilla, Remmina, Ferdium (VNC) and Terminal, JupyterLab, pgweb,
  htop (web-native), plus your own images.
- **Per-user VPN gateway** — corporate VPN as an app (userspace OpenConnect,
  unprivileged); a shield on every window routes that app direct or through
  the tunnel, live. See [VPN gateway](vpn.md).
- **Nextcloud everywhere** — WebDAV home mount in every session, file manager,
  Calendar/Tasks/Deck/Talk/Notes/Notifications hub in the taskbar.
- **Extra mounts** — user SFTP (key or password) and S3 remotes at
  `~/Mount/<name>`.
- **Shared clipboard** across VNC and web apps; session sharing (view/control
  invite links); session recording via group policy.
- **Enterprise guardrails** — group quotas and policies (DLP: clipboard,
  download, upload), audit log, Prometheus metrics, maintenance mode.

## Where to start

| Goal | Read |
|---|---|
| Understand the moving parts | [Architecture](architecture.md) |
| Stand up a dev environment | The repo `README.md` quick start |
| Configure login (OIDC/LDAP/local) | [Auth setup](auth-setup.md) |
| Add or build apps | [Apps](apps.md), [Custom images](custom-image.md) |
| Corporate VPN per user | [VPN gateway](vpn.md) |
| Go to production | [Kubernetes deployment](deployment-k8s.md) |
| Audio, storage, performance | [Tuning](tuning.md) |
| Integrate / automate | [API reference](api.md) |
