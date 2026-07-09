#!/bin/bash
# Nextcloud WebDAV mount via rclone. Copy of kasm-base/lwp-nc-mount.sh (the
# terminal image isn't based on kasm-base, and Docker build contexts can't
# reach a sibling dir — keep this in sync if the base version changes).
if [ -z "${LWP_NC_URL}" ]; then
    exec sleep infinity
fi

MOUNT="${LWP_NC_MOUNT:-/home/lwp/Files}"
mkdir -p "${MOUNT}"

RCLONE_CONF=$(mktemp /tmp/rclone-nc-XXXXXX.conf)
cat > "${RCLONE_CONF}" <<EOF
[nc]
type = webdav
url = ${LWP_NC_URL}
vendor = nextcloud
user = ${LWP_NC_USER}
pass = $(rclone obscure "${LWP_NC_PASS}")
EOF

rclone mount \
    --config "${RCLONE_CONF}" \
    --no-modtime \
    --vfs-cache-mode full \
    --vfs-cache-max-size 1G \
    --vfs-cache-max-age 24h \
    --dir-cache-time 10m \
    --exclude ".cache/**" \
    nc: \
    "${MOUNT}" &
RCLONE_PID=$!

for _i in $(seq 1 60); do
    mountpoint -q "${MOUNT}" 2>/dev/null && break
    sleep 0.5
done

if mountpoint -q "${MOUNT}" 2>/dev/null; then
    for _dir in Documents Downloads Music Pictures Templates Videos; do
        mkdir -p "${MOUNT}/${_dir}"
    done
    for _dir in Documents Downloads Music Pictures Templates Videos; do
        _local="/home/lwp/${_dir}"
        _nc="${MOUNT}/${_dir}"
        if [ -L "${_local}" ]; then
            :
        elif [ -d "${_local}" ]; then
            find "${_local}" -mindepth 1 -maxdepth 1 -exec mv -n {} "${_nc}/" \; 2>/dev/null || true
            rm -rf "${_local}"
            ln -s "${_nc}" "${_local}"
        else
            ln -s "${_nc}" "${_local}"
        fi
    done
fi

wait "${RCLONE_PID}"
