FROM lwp-web-base

# pgweb — PostgreSQL web client (single Go binary), behind the TLS wrapper.
USER root
ARG PGWEB_VER=0.17.0
RUN apt-get update && apt-get install -y --no-install-recommends unzip && \
    curl -fsSL "https://github.com/sosedoff/pgweb/releases/download/v${PGWEB_VER}/pgweb_linux_amd64.zip" -o /tmp/pg.zip && \
    unzip /tmp/pg.zip -d /tmp && mv /tmp/pgweb_linux_amd64 /usr/local/bin/pgweb && \
    chmod +x /usr/local/bin/pgweb && rm /tmp/pg.zip && \
    apt-get purge -y unzip && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

USER lwp
ENV LWP_APP_PORT=8081 LWP_BASE_PREFIX=1

# --sessions: connect UI (no DB URL needed at start). --prefix: served under the
# session path so assets resolve behind LWP's proxy.
CMD ["bash", "-lc", "exec pgweb --bind 127.0.0.1 --listen 8081 --sessions --prefix session/${LWP_SESSION_TOKEN}"]
