FROM ubuntu:24.04

# OpenConnect (GlobalProtect/AnyConnect) + ocproxy: the tunnel runs entirely in
# userspace (lwIP) — no /dev/net/tun, no NET_ADMIN, container stays unprivileged.
# ocproxy exposes the tunnel as a SOCKS5 proxy on :1080 for the user's other
# session containers (reachable as socks5h://vpn:1080 on the per-user network).
RUN apt-get update -qq && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        openconnect ocproxy tmux whiptail \
        curl ca-certificates openssl && \
    ARCH=$(uname -m) && \
    curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.${ARCH}" \
        -o /usr/local/bin/ttyd && \
    chmod +x /usr/local/bin/ttyd && \
    rm -rf /var/lib/apt/lists/*

RUN userdel -r ubuntu 2>/dev/null || true && \
    useradd -m -s /bin/bash -u 1000 lwp && \
    # plain-terminal look inside tmux
    printf 'set -g status off\n' > /etc/tmux.conf

# Self-signed cert so ttyd serves HTTPS — nginx proxies all session upstreams
# as https:// with proxy_ssl_verify off (same as the terminal image).
RUN mkdir -p /etc/ttyd && \
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout /etc/ttyd/key.pem -out /etc/ttyd/cert.pem \
        -subj "/CN=lwp-vpn" && \
    chmod 644 /etc/ttyd/cert.pem /etc/ttyd/key.pem

COPY lwp-vpn-connect.sh /usr/local/bin/lwp-vpn-connect.sh
COPY lwp-vpn-up.sh      /usr/local/bin/lwp-vpn-up.sh
COPY lwp-vpn-entry.sh   /usr/local/bin/lwp-vpn-entry.sh
RUN chmod +x /usr/local/bin/lwp-vpn-connect.sh /usr/local/bin/lwp-vpn-up.sh \
             /usr/local/bin/lwp-vpn-entry.sh

USER lwp
WORKDIR /home/lwp

EXPOSE 7681 1080
CMD ["/usr/local/bin/lwp-vpn-entry.sh"]
