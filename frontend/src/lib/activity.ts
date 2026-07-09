// Shared user-activity tracker.
//
// The desktop embeds each remote session in a same-origin <iframe>. When a user
// works *inside* that iframe (typing, mousing in KasmVNC), the input events fire
// on the iframe's document, NOT the top window — so a plain window-level idle
// timer sees no activity and wrongly suspends an actively-used session.
//
// This module keeps a single "last activity" timestamp fed from BOTH the top
// window and every session iframe (via attachActivity on iframe load), so idle
// detection reflects real use.

type Listener = () => void;

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel",
] as const;

let lastActivity = Date.now();
const listeners = new Set<Listener>();

export function markActivity(): void {
  lastActivity = Date.now();
  listeners.forEach((l) => l());
}

export function getLastActivity(): number {
  return lastActivity;
}

/** Subscribe to activity pulses (used to fire onActive immediately on resume). */
export function onActivity(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let globalInited = false;
/** Attach top-window listeners once (idempotent). */
export function initGlobalActivity(): void {
  if (globalInited) return;
  globalInited = true;
  ACTIVITY_EVENTS.forEach((e) =>
    window.addEventListener(e, markActivity, { passive: true }),
  );
}

/**
 * Attach activity listeners to an arbitrary EventTarget (e.g. a same-origin
 * iframe's contentWindow). Returns a cleanup fn. Safe to call in a try/catch —
 * cross-origin access throws, callers ignore it.
 */
export function attachActivity(target: EventTarget): () => void {
  ACTIVITY_EVENTS.forEach((e) =>
    target.addEventListener(e, markActivity, { passive: true }),
  );
  return () =>
    ACTIVITY_EVENTS.forEach((e) => target.removeEventListener(e, markActivity));
}
