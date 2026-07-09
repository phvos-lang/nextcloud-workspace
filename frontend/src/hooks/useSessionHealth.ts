import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** Poll for liveness after the iframe has loaded. Disable while suspended. */
  enabled?: boolean;
  /** Consecutive failed pings before declaring the connection lost. */
  failThreshold?: number;
  /** Give up on startup after this many seconds (failed=true). */
  startupTimeoutS?: number;
}

export interface SessionHealth {
  ready: boolean;       // container reachable — safe to mount the iframe
  lost: boolean;        // was ready, now unreachable (websocket/container dropped)
  failed: boolean;      // never became reachable within startupTimeoutS
  frameKey: number;     // bump forces the iframe to remount on reconnect
  elapsed: number;      // seconds spent waiting during initial startup
  reconnect(): void;    // user-triggered reconnect / retry
}

/**
 * Owns the lifecycle of a session iframe's connection:
 *  1. Startup — polls the session URL until the container answers (~10s cold).
 *  2. Liveness — once loaded, pings periodically; N failures ⇒ `lost`.
 *  3. Reconnect — re-verifies then remounts the iframe via `frameKey`.
 */
export function useSessionHealth(url: string, opts: Options = {}): SessionHealth {
  // 3 consecutive failures (~15s) before flagging lost — tolerates brief
  // upstream blips (container hiccups, resizes) without a false "Connection lost".
  const { enabled = true, failThreshold = 3, startupTimeoutS = 60 } = opts;
  const [ready, setReady]       = useState(false);
  const [lost, setLost]         = useState(false);
  const [failed, setFailed]     = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [elapsed, setElapsed]   = useState(0);

  // ── Startup poll: wait for the container to come up ──────────────────────
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      // Poll fast (0.7s) so we mount the instant the container answers.
      const deadline = Date.now() + startupTimeoutS * 1000;
      for (let i = 0; Date.now() < deadline; i++) {
        if (cancelled) return;
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (r.ok) { setReady(true); return; }
        } catch { /* not up yet */ }
        setElapsed(Math.round((i + 1) * 0.7));
        await new Promise((r) => setTimeout(r, 700));
      }
      // The app never opened its port — surface a hard failure instead of an
      // endless spinner; the user chooses to retry or stop the session.
      if (!cancelled) setFailed(true);
    })();
    return () => { cancelled = true; };
  }, [url, frameKey, startupTimeoutS]);

  // ── Liveness poll: detect a dropped connection after load ────────────────
  const fails = useRef(0);
  useEffect(() => {
    if (!ready || !enabled || lost) return;
    fails.current = 0;
    const id = setInterval(async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) { fails.current = 0; return; }
        throw new Error(String(r.status));
      } catch {
        fails.current += 1;
        if (fails.current >= failThreshold) setLost(true);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [ready, enabled, lost, url, failThreshold]);

  const reconnect = useCallback(() => {
    fails.current = 0;
    setLost(false);
    setFailed(false);
    setElapsed(0);
    setFrameKey((k) => k + 1); // remount iframe + re-run startup poll
  }, []);

  return { ready, lost, failed, frameKey, elapsed, reconnect };
}
