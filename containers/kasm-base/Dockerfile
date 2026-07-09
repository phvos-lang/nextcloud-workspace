FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    HOME=/home/lwp \
    USER=lwp \
    DISPLAY=:1 \
    PULSE_RUNTIME_PATH=/run/user/1000/pulse

# KasmVNC version — bump here to upgrade
ARG KASMVNC_VER=1.4.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg \
      ssl-cert openssl \
      openbox \
      supervisor \
      dbus-x11 python3-dbus \
      x11-xkb-utils xkb-data x11-utils \
      adwaita-icon-theme hicolor-icon-theme \
      wmctrl xdotool \
      pulseaudio pulseaudio-utils \
      ffmpeg \
      xauth \
      libgtk-3-0t64 libglib2.0-0t64 libdbus-1-3 libxss1 \
      libgtk-3-bin \
      gsettings-desktop-schemas \
      shared-mime-info \
      librsvg2-common \
      xdg-user-dirs \
      xterm \
      unzip fuse3 \
    && update-mime-database /usr/share/mime \
    && gtk-update-icon-cache -f /usr/share/icons/hicolor \
    && gtk-update-icon-cache -f /usr/share/icons/Adwaita 2>/dev/null || true \
    && curl -fsSL \
        "https://github.com/kasmtech/KasmVNC/releases/download/v${KASMVNC_VER}/kasmvncserver_noble_${KASMVNC_VER}_amd64.deb" \
        -o /tmp/kasmvnc.deb \
    && apt-get install -y /tmp/kasmvnc.deb \
    && rm /tmp/kasmvnc.deb \
    && curl -fsSL https://rclone.org/install.sh | bash \
    && rm -rf /var/lib/apt/lists/* \
    && make-ssl-cert generate-default-snakeoil --force-overwrite

RUN userdel -r ubuntu 2>/dev/null || true && \
    useradd -m -s /bin/bash -u 1000 lwp && \
    usermod -aG ssl-cert lwp

# KasmVNC config (port 8080, no SSL, no auth file used — nginx handles auth)
RUN mkdir -p /home/lwp/.vnc /home/lwp/.config/pulse /etc/lwp
COPY kasmvnc.yaml  /home/lwp/.vnc/kasmvnc.yaml
COPY xstartup      /home/lwp/.vnc/xstartup
COPY openbox.xml   /etc/lwp/openbox.xml
COPY pulse.conf    /home/lwp/.config/pulse/default.pa
RUN chmod +x /home/lwp/.vnc/xstartup && \
    chown -R lwp:lwp /home/lwp/.vnc /home/lwp/.config && \
    cp -r /home/lwp/. /etc/lwp/skel/

COPY supervisord.conf         /etc/supervisor/supervisord.conf
COPY conf.d/lwp-rclone.conf   /etc/supervisor/conf.d/lwp-rclone.conf
COPY conf.d/lwp-mounts.conf   /etc/supervisor/conf.d/lwp-mounts.conf
COPY conf.d/lwp-audio.conf    /etc/supervisor/conf.d/lwp-audio.conf
COPY conf.d/lwp-record.conf   /etc/supervisor/conf.d/lwp-record.conf
COPY conf.d/lwp-video.conf    /etc/supervisor/conf.d/lwp-video.conf
COPY conf.d/lwp-opener.conf   /etc/supervisor/conf.d/lwp-opener.conf
COPY conf.d/lwp-vpn-relay.conf /etc/supervisor/conf.d/lwp-vpn-relay.conf
COPY conf.d/lwp-fileserver.conf /etc/supervisor/conf.d/lwp-fileserver.conf
COPY lwp-start-kasm.sh        /usr/local/bin/lwp-start-kasm.sh
COPY lwp-nc-mount.sh          /usr/local/bin/lwp-nc-mount.sh
COPY lwp-mounts.sh            /usr/local/bin/lwp-mounts.sh
COPY lwp-audio.sh             /usr/local/bin/lwp-audio.sh
COPY lwp-video.sh             /usr/local/bin/lwp-video.sh
COPY lwp-opener.sh            /usr/local/bin/lwp-opener.sh
COPY lwp-audio-server.py      /usr/local/bin/lwp-audio-server.py
COPY lwp-video-server.py      /usr/local/bin/lwp-video-server.py
COPY lwp-record.sh            /usr/local/bin/lwp-record.sh
COPY lwp-xdg-open.sh          /usr/local/bin/lwp-xdg-open.sh
COPY lwp-vpn-relay.py         /usr/local/bin/lwp-vpn-relay.py
COPY lwp-fileserver.py        /usr/local/bin/lwp-fileserver.py
RUN chmod +x /usr/local/bin/lwp-start-kasm.sh \
             /usr/local/bin/lwp-nc-mount.sh \
             /usr/local/bin/lwp-mounts.sh \
             /usr/local/bin/lwp-audio.sh \
             /usr/local/bin/lwp-video.sh \
             /usr/local/bin/lwp-opener.sh \
             /usr/local/bin/lwp-record.sh \
             /usr/local/bin/lwp-xdg-open.sh \
             /usr/local/bin/lwp-vpn-relay.py \
             /usr/local/bin/lwp-fileserver.py && \
    if command -v xdg-open; then mv /usr/bin/xdg-open /usr/bin/xdg-open.real; fi && \
    ln -sf /usr/local/bin/lwp-xdg-open.sh /usr/bin/xdg-open

ENV LWP_START_APP=xterm

EXPOSE 8080 8081 19090

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
