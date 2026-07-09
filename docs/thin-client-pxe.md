# Thin clients: PXE-boot kiosk (design)

> **Status: idea / design note — nothing here is implemented.**
> Goal: repurpose any PC as a stateless thin client. It PXE-boots a tiny
> Linux from the network, starts a locked-down kiosk browser fullscreen on
> the LWP URL, and everything else — desktop, apps, files, VPN — happens
> inside LWP. No local disk used, no local state, nothing to manage on the
> device itself.

## Why

- Old desktops/laptops become LWP terminals with zero OS maintenance.
- Nothing sensitive ever lands on the device (RAM-only, stateless).
- One image on one HTTP server serves every client; update = replace one
  file, clients pick it up on next boot.

## Boot chain

```
power on
 └─ NIC PXE ROM ──DHCP──► next-server + filename
     └─ iPXE (undionly.kpxe / snponly.efi via TFTP)
         └─ boot.ipxe (HTTP)
             └─ kernel (vmlinuz) + initrd — HTTP, fast
                 └─ live squashfs fetched to RAM (toram)
                     └─ kiosk compositor + browser → https://lwp.example.org
```

- **DHCP**: existing server hands out `next-server` (TFTP) and the iPXE
  binary as `filename` (BIOS: `undionly.kpxe`, UEFI: `snponly.efi`).
  Dual-stack detection via DHCP option 93 (client architecture).
- **iPXE chain-load**: the tiny TFTP payload immediately chains to an HTTP
  `boot.ipxe`, so everything heavy travels over HTTP, not TFTP.
- **Live root in RAM** (`toram`): the network can drop after boot; the
  client keeps running. No NFS/iSCSI root needed.

Example `boot.ipxe`:

```ipxe
#!ipxe
set base http://boot.example.org/lwp-kiosk
kernel ${base}/vmlinuz boot=live fetch=${base}/filesystem.squashfs toram \
    quiet splash lwp.url=https://lwp.example.org
initrd ${base}/initrd.img
boot
```

The LWP URL rides on the kernel command line (`lwp.url=…`), so one image
serves multiple environments (test/prod) with different boot scripts.
Per-device overrides are possible in iPXE (`chain ${base}/mac-${net0/mac}.ipxe ||`).

## The image

Two reasonable builds (pick one):

| | Debian live-build | Alpine netboot |
|---|---|---|
| Size (squashfs) | ~500–700 MB | ~300–400 MB |
| Firmware/driver coverage | broad (recommended for mixed old PCs) | good, leaner |
| Build tooling | `live-build`, very scriptable | `mkimage`/apk overlays |

Contents, either way:

- kernel + firmware (wifi optional; wired recommended)
- **cage** (Wayland kiosk compositor — one app, fullscreen, nothing else)
  or X11 + openbox for very old GPUs
- **Chromium** in kiosk mode
- ALSA (audio arrives as an Opus stream inside the browser — no PulseAudio
  server needed on the client)
- a supervisor loop that restarts the browser if it dies

Kiosk session (systemd unit sketch):

```ini
[Unit]
Description=LWP kiosk
After=network-online.target

[Service]
User=kiosk
Restart=always
RestartSec=2
ExecStart=/usr/bin/cage -- /usr/bin/chromium \
  --kiosk --incognito --noerrdialogs --no-first-run \
  --disable-translate --disable-pinch --overscroll-history-navigation=0 \
  --autoplay-policy=no-user-gesture-required \
  "$(sed -n 's/.*lwp\.url=\([^ ]*\).*/\1/p' /proc/cmdline)"
```

Notes:

- `--incognito`: nothing persists between sessions (stateless by design).
- `--autoplay-policy`: lets the LWP audio stream start without a click.
- Clipboard, fullscreen and clipboard-read permissions can be pre-granted
  via a Chromium managed-policy JSON baked into the image
  (`/etc/chromium/policies/managed/lwp.json`) so the session behaves like
  a desktop, not a website.

## Login flow

The kiosk browser lands on the LWP login page; with OIDC SSO the user signs
in exactly as they would in any browser. TOTP, session takeover, policies —
all unchanged, because the client *is* just a browser.

Optional hardening for shared/public devices:

- LWP "stop sessions on logout" preference forced via group policy.
- Browser restarts (and therefore wipes) on logout redirect — point the
  post-logout redirect at a URL the supervisor watches, or simply restart
  the kiosk unit on a timer after logout.

## Limitations (inherent to the browser client)

- **No local USB passthrough** — mass-storage/smartcard redirection does
  not exist in a plain browser session. File transfer runs through
  Nextcloud/drag-drop like on any LWP client.
- **Printing** — via Nextcloud/documents inside the session, not local
  spooling.
- **Multi-monitor** — same status as the main LWP client (parked).
- RAM: `toram` + Chromium wants **≥ 4 GB** on the client.

## Server-side pieces to stand up (when implementing)

1. `dnsmasq` (or existing DHCP + a proxy-DHCP dnsmasq, no address changes
   needed) serving the iPXE binaries over TFTP.
2. Any static HTTP server for `boot.ipxe`, kernel, initrd, squashfs.
3. An image build pipeline (live-build config in this repo, CI job builds
   the squashfs, publishes it as an artifact / to the boot server).
4. Optionally: match kiosk devices by MAC in the boot script for per-room
   URLs or a maintenance image.

Existing projects worth borrowing from instead of building from scratch:
[Porteus Kiosk](https://porteus-kiosk.org) (config-file driven kiosk distro,
supports PXE) and Debian's `live-build` examples.
