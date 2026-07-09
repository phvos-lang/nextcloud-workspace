# htop system monitor served over the web via ttyd (reuses the terminal image).
# No VNC.
FROM lwp-terminal

# User-chosen terminal font (Profile → Terminal appearance) — see
# lwp-terminal-entry.sh for the same pattern.
CMD ["bash", "-lc", "FONT_ARGS=(); \
     [ -n \"${LWP_TERM_FONT_FAMILY:-}\" ] && FONT_ARGS+=(-t \"fontFamily=$LWP_TERM_FONT_FAMILY\"); \
     [ -n \"${LWP_TERM_FONT_SIZE:-}\" ]   && FONT_ARGS+=(-t \"fontSize=$LWP_TERM_FONT_SIZE\"); \
     exec ttyd --port 7681 --writable --base-path / \
       --ssl --ssl-cert /etc/ttyd/cert.pem --ssl-key /etc/ttyd/key.pem \
       \"${FONT_ARGS[@]}\" htop"]
