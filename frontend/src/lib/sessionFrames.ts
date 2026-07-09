// Registry of live session iframes (by windowId) so desktop-level tools (e.g.
// the shared clipboard) can reach into a running KasmVNC session. Same-origin,
// so we can drive KasmVNC's own clipboard textarea directly — no dependency on
// the flaky navigator.clipboard read permission.

const frames = new Map<string, HTMLIFrameElement>();

export function registerFrame(id: string, el: HTMLIFrameElement): void {
  frames.set(id, el);
}

export function unregisterFrame(id: string): void {
  frames.delete(id);
  webClips.delete(id);
}

function clipEl(id: string): HTMLTextAreaElement | null {
  try {
    return (frames.get(id)?.contentDocument
      ?.getElementById("noVNC_clipboard_text") as HTMLTextAreaElement) ?? null;
  } catch {
    return null; // cross-origin / not ready
  }
}

/** Push text into a session's clipboard (KasmVNC sends it to the remote). */
export function pushToSession(id: string, text: string): boolean {
  const ta = clipEl(id);
  if (!ta) return false;
  ta.value = text;
  ta.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

/** Read a session's current clipboard (KasmVNC keeps the textarea in sync;
 * web apps report their last captured selection/copy). */
export function readFromSession(id: string): string | null {
  const ta = clipEl(id);
  return ta ? ta.value : (webClips.get(id) ?? null);
}

// ── Web-app clipboard bridge ──────────────────────────────────────────────────
// Web-native apps (ttyd terminal, Jupyter, …) have no KasmVNC clipboard
// textarea, so the VNC bridge can't see them. Instead: watch selections and
// copies inside their same-origin iframe (the ttyd DOM renderer keeps the
// terminal as real DOM text, so getSelection() works) and report them upward.

const webClips = new Map<string, string>();

export function attachClipboardCapture(
  id: string,
  el: HTMLIFrameElement,
  onCapture: (text: string) => void,
): void {
  try {
    const doc = el.contentDocument;
    if (!doc || clipEl(id)) return; // KasmVNC sessions have their own bridge
    const grab = () => {
      const t = el.contentWindow?.getSelection()?.toString() ?? "";
      if (t.trim() && webClips.get(id) !== t) {
        webClips.set(id, t);
        onCapture(t);
      }
    };
    // Selection settles after the event — read it on the next tick.
    doc.addEventListener("mouseup", () => setTimeout(grab, 0));
    doc.addEventListener("copy", () => setTimeout(grab, 0));
  } catch {
    /* cross-origin / not ready */
  }
}

/** Mirror a clip into every open KasmVNC session's clipboard (excluding the
 * source), so Ctrl+V inside those apps pastes it immediately. */
export function pushToVncSessions(text: string, excludeId?: string): void {
  for (const id of frames.keys()) {
    if (id !== excludeId) pushToSession(id, text);
  }
}

// ── Live window thumbnails ────────────────────────────────────────────────────
// KasmVNC draws the remote desktop on a <canvas> inside the (same-origin)
// session iframe — scale it down to a JPEG data URL. Minimized windows unmount
// their iframe, so the last capture is cached (Window captures on minimize).

const snapshots = new Map<string, string>();
const SNAP_MAX_W = 480;

/** Capture the session's canvas now and cache it. Null if not capturable. */
export function captureSnapshot(id: string): string | null {
  try {
    const doc = frames.get(id)?.contentDocument;
    const canvas = doc?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !canvas.width || !canvas.height) return null;
    const scale = Math.min(1, SNAP_MAX_W / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(canvas.width * scale));
    out.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    const url = out.toDataURL("image/jpeg", 0.55);
    snapshots.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/** Best-available thumbnail: fresh capture, else the cached one. */
export function getSnapshot(id: string): string | null {
  return captureSnapshot(id) ?? snapshots.get(id) ?? null;
}

export function dropSnapshot(id: string): void {
  snapshots.delete(id);
}
