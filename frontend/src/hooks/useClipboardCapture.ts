import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useDesktopStore } from "@/store/desktop";
import { pushToVncSessions, readFromSession } from "@/lib/sessionFrames";

/**
 * Passively mirror the active session's clipboard into the shared history, so
 * copying inside one app makes the text available to paste into another.
 * KasmVNC keeps its clipboard textarea in sync on every remote copy, so we just
 * poll the topmost session. Every new capture is also mirrored into the other
 * VNC sessions (their Ctrl+V works at once) and the system clipboard (so
 * web apps — ttyd, Jupyter — paste it natively with Ctrl+V / Ctrl+Shift+V).
 */
export function useClipboardCapture() {
  useEffect(() => {
    let lastSeen = "";
    const id = setInterval(() => {
      const st = useDesktopStore.getState();
      const active = [...st.windows]
        .filter((w) => !w.minimized)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!active) return;
      const t = readFromSession(active.windowId);
      if (t && t.trim() && t !== lastSeen) {
        lastSeen = t;
        st.addClip(t);
        pushToVncSessions(t, active.windowId);
        // Mirror to the system clipboard too so web apps (ttyd, Jupyter) can
        // paste natively — unless group policy forbids the host bridge.
        // Best-effort: Chrome allows clipboard-write for the focused page;
        // if the browser refuses, the ClipboardManager click path still works.
        if (!useAuthStore.getState().user?.policies?.disable_clipboard) {
          try { navigator.clipboard?.writeText(t).catch(() => {}); } catch { /* noop */ }
        }
      }
    }, 1500);
    return () => clearInterval(id);
  }, []);
}
