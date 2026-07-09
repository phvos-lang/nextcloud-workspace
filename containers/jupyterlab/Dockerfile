FROM lwp-web-base

# JupyterLab (web-native, no VNC) behind the TLS wrapper. Ubuntu 24.04 is
# externally-managed (PEP 668), so install into a venv.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-dev build-essential && \
    python3 -m venv /opt/jupyter && \
    /opt/jupyter/bin/pip install --no-cache-dir jupyterlab && \
    apt-get purge -y build-essential python3-dev && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* && \
    chown -R lwp:lwp /home/lwp

USER lwp
ENV LWP_APP_PORT=8081 LWP_BASE_PREFIX=1

# base_url is the session path (token from env at runtime); token auth disabled
# because nginx already authenticates the session. allow_remote_access: we bind
# loopback but the browser's Host header is the LWP hostname (proxied through),
# which Jupyter otherwise blocks with a 403 "non-local 'Host'".
CMD ["bash", "-lc", "exec /opt/jupyter/bin/jupyter lab --no-browser \
  --ip 127.0.0.1 --port 8081 \
  --ServerApp.token='' --ServerApp.password='' \
  --ServerApp.base_url=/session/${LWP_SESSION_TOKEN}/ \
  --ServerApp.allow_remote_access=True \
  --ServerApp.allow_origin='*' --ServerApp.disable_check_xsrf=True \
  --ServerApp.root_dir=/home/lwp"]
