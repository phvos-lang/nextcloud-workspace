"""
rclone config generation and mount helpers.

Passwords in rclone config files must be 'obscured' using rclone's XOR cipher.
We implement it here so we don't need rclone installed on the backend.
"""
import base64

_RCLONE_KEY = bytes([
    0x9c, 0x93, 0x5b, 0x48, 0x73, 0x0a, 0x55, 0x42,
    0x87, 0x10, 0x4b, 0x54, 0x23, 0xe2, 0x07, 0xab,
    0x27, 0x36, 0x68, 0xe8, 0xc2, 0x97, 0xdb, 0xde,
    0xf6, 0xa9, 0x8f, 0x85, 0xbd, 0x1d, 0x86, 0xed,
])


def obscure(plain: str) -> str:
    """Encode a password for rclone config (rclone obscure algorithm)."""
    data = plain.encode("utf-8")
    result = bytes(b ^ _RCLONE_KEY[i % len(_RCLONE_KEY)] for i, b in enumerate(data))
    return base64.urlsafe_b64encode(result).decode()


def rclone_name(storage_name: str) -> str:
    """Sanitize a storage name into a valid rclone remote name."""
    return storage_name.lower().replace(" ", "-").replace("/", "-")


def build_rclone_config(mounts: list[dict]) -> str:
    """
    Build an rclone.conf string from a list of storage config dicts.
    Each dict has: name, provider, config (decrypted).
    """
    sections: list[str] = []

    for m in mounts:
        name = rclone_name(m["name"])
        cfg = m["config"]
        provider = m["provider"]
        lines = [f"[{name}]"]

        if provider == "sftp":
            lines += [
                "type = sftp",
                f"host = {cfg['host']}",
                f"port = {cfg.get('port', 22)}",
                f"user = {cfg['user']}",
            ]
            if cfg.get("password"):
                lines.append(f"pass = {obscure(cfg['password'])}")
            if cfg.get("key_pem"):
                lines.append(f"key_file_pass = {obscure(cfg['key_pem'])}")

        elif provider == "s3":
            lines += [
                "type = s3",
                f"provider = {cfg.get('s3_provider', 'AWS')}",
                f"access_key_id = {cfg['access_key_id']}",
                f"secret_access_key = {cfg['secret_access_key']}",
            ]
            if cfg.get("region"):
                lines.append(f"region = {cfg['region']}")
            if cfg.get("endpoint"):
                lines.append(f"endpoint = {cfg['endpoint']}")
            if cfg.get("bucket"):
                # Pre-set the root path to this bucket
                lines.append(f"# bucket = {cfg['bucket']}")

        elif provider == "webdav":
            lines += [
                "type = webdav",
                f"url = {cfg['url']}",
                f"vendor = {cfg.get('vendor', 'other')}",
                f"user = {cfg['user']}",
            ]
            if cfg.get("password"):
                lines.append(f"pass = {obscure(cfg['password'])}")

        elif provider == "gdrive":
            lines += [
                "type = drive",
                f"token = {cfg['token']}",
            ]
            if cfg.get("root_folder_id"):
                lines.append(f"root_folder_id = {cfg['root_folder_id']}")

        elif provider == "onedrive":
            lines += [
                "type = onedrive",
                f"token = {cfg['token']}",
                f"drive_id = {cfg.get('drive_id', '')}",
                f"drive_type = {cfg.get('drive_type', 'personal')}",
            ]

        sections.append("\n".join(lines))

    return "\n\n".join(sections) + "\n"


def build_mount_script(mounts: list[dict]) -> str:
    """
    Generate a bash script that installs rclone (if missing) and mounts
    each configured remote. Intended for /custom-cont-init.d/ in webtop containers.
    """
    remote_lines = []
    for m in mounts:
        name = rclone_name(m["name"])
        path = m["mount_path"]
        remote_lines.append(
            f"mkdir -p {path}\n"
            f"rclone mount {name}: {path} "
            f"--config /etc/rclone/rclone.conf "
            f"--vfs-cache-mode writes "
            f"--vfs-cache-dir /tmp/rclone-cache/{name} "
            f"--allow-other --daemon "
            f"--log-level INFO --log-file /tmp/rclone-{name}.log "
            f"|| echo 'LWP: failed to mount {name}'"
        )

    mounts_sh = "\n".join(remote_lines)

    return f"""#!/bin/bash
# LWP storage mounts — auto-generated
set -e

# Install rclone if not already present
if ! command -v rclone &>/dev/null; then
    curl -fsS https://rclone.org/install.sh | bash
fi

# Allow other users to access FUSE mounts (needed for the desktop user)
echo user_allow_other >> /etc/fuse.conf 2>/dev/null || true

# Mount each configured remote
{mounts_sh}
echo "LWP: storage mounts started"
"""
