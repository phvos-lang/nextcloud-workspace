FROM ubuntu:24.04

# lwp-web-base — TLS wrapper for web-native apps. nginx terminates HTTPS on :8080
# (matching LWP's https:// session upstream) and proxies to your HTTP app on
# 127.0.0.1:$LWP_APP_PORT. Runs fully as the unprivileged lwp user.
#
# Usage in a child image:
#   FROM lwp-web-base
#   RUN <install your web app>
#   ENV LWP_APP_PORT=8081
#   CMD ["your-app", "--host", "127.0.0.1", "--port", "8081"]
ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
      nginx-light openssl ca-certificates curl python3-minimal && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /etc/lwp-tls && \
    openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
      -keyout /etc/lwp-tls/key.pem -out /etc/lwp-tls/cert.pem -subj "/CN=lwp-web" && \
    chmod 644 /etc/lwp-tls/cert.pem /etc/lwp-tls/key.pem && \
    userdel -r ubuntu 2>/dev/null || true && useradd -m -s /bin/bash -u 1000 lwp

COPY nginx-tls.conf.template /etc/lwp-tls/nginx.conf.template
COPY lwp-web-entry.sh        /usr/local/bin/lwp-web-entry.sh
COPY lwp-vpn-relay.py        /usr/local/bin/lwp-vpn-relay.py
RUN chmod +x /usr/local/bin/lwp-web-entry.sh /usr/local/bin/lwp-vpn-relay.py

USER lwp
WORKDIR /home/lwp
ENV LWP_APP_PORT=8081
EXPOSE 8080

# entrypoint starts the TLS front, then exec's the child CMD (the app).
ENTRYPOINT ["/usr/local/bin/lwp-web-entry.sh"]
CMD ["sleep", "infinity"]
