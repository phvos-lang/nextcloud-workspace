import { useAuthStore } from "@/store/auth";

// KasmVNC's HTML5 client (noVNC-derived) reads `resize=` from the URL on
// load — no relaunch needed, just remount the iframe with the new value.
export type VncDisplayMode = "remote" | "scale" | "off";

export const VNC_DISPLAY_MODES: { value: VncDisplayMode; label: string; hint: string }[] = [
  { value: "remote", label: "Fit window (default)", hint: "Remote resolution follows the window size — sharpest text, resizes live." },
  { value: "scale",  label: "Scale to fit",          hint: "Native resolution, visually scaled to fit the window — good for high-DPI zoom." },
  { value: "off",    label: "Native (100%)",         hint: "Exact pixel size, no scaling — scrollbars if the window is smaller." },
];

function modeFromPrefs(prefs: Record<string, unknown> | undefined): VncDisplayMode {
  const v = prefs?.vnc_display_mode;
  return v === "scale" || v === "off" ? v : "remote";
}

/** Reactive — re-renders the caller when the user changes the preference,
 * so an already-open window's iframe re-navigates with the new `resize=`
 * value immediately (no relaunch, no page reload). */
export function useVncDisplayMode(): VncDisplayMode {
  return useAuthStore((s) => modeFromPrefs(s.user?.preferences as Record<string, unknown> | undefined));
}

/** Query string to append to a KasmVNC connect_url (no leading '?'). */
export function vncQueryString(mode: VncDisplayMode): string {
  // KasmVNC's own isInsideKasmVDI() check is just `window.self !== window.top`
  // — true for us because the session always loads inside our <iframe>. It
  // then assumes it's embedded in the real Kasm Workspaces platform (which
  // bridges clipboard itself via postMessage) and disables its OWN clipboard
  // entirely (clipboard_up/clipboard_down = false) — nothing reaches the
  // textarea our bridge reads, and nothing reaches the OS clipboard either.
  // Force both back on. clipboard_seamless=false additionally keeps it on
  // the legacy textarea+ServerCutText path (what our bridge is built
  // against) instead of the native-Clipboard-API "seamless" mode, which
  // needs user activation we can't guarantee from an async websocket event.
  return `resize=${mode}&autoconnect=1&clipboard_up=true&clipboard_down=true&clipboard_seamless=false`;
}
