import { useEffect } from "react";
import { toast } from "sonner";
import client from "@/api/client";
import { useDesktopStore } from "@/store/desktop";

// Warn thresholds
const LIFETIME_WARN_S = 5 * 60;  // "session ends soon" at T-5min
const IDLE_WARN_S = 2 * 60;      // "about to idle out" at T-2min

// Module state survives re-renders; keyed by sessionId.
const lastBeat = new Map<string, number>();
const warned = { lifetime: new Set<string>(), idle: new Set<string>() };
let idleTimeoutMin = 0; // cached from heartbeat responses

interface BeatResponse {
  ok: boolean;
  lifetime_remaining_s: number | null;
  idle_timeout_min: number;
}

function beatOne(sessionId: string, appName: string) {
  return client
    .post<BeatResponse>(`/api/sessions/${sessionId}/heartbeat`)
    .then((r) => {
      lastBeat.set(sessionId, Date.now());
      idleTimeoutMin = r.data.idle_timeout_min ?? 0;
      const rem = r.data.lifetime_remaining_s;
      if (rem !== null && rem <= LIFETIME_WARN_S && !warned.lifetime.has(sessionId)) {
        warned.lifetime.add(sessionId);
        toast.warning(`${appName} ends in ${Math.max(1, Math.round(rem / 60))} min`, {
          description: "Maximum session lifetime is almost reached — save your work.",
          duration: 30_000,
        });
      }
    })
    .catch(() => {});
}

/**
 * Keep in-use sessions alive for the server-side idle reaper. Beats every 60s
 * for visible (non-minimized, non-suspended) session windows while the tab is
 * focused — so minimized/suspended/closed sessions naturally go idle and reap.
 *
 * Also warns before the reaper hits: near the lifetime cap (save your work)
 * and when a minimized/hidden session is about to idle out (with a keep-alive
 * action).
 */
export function useSessionHeartbeat() {
  useEffect(() => {
    const beat = () => {
      if (document.hidden) return;
      const wins = useDesktopStore.getState().windows
        .filter((w) => !w.minimized && !w.suspended && w.sessionId);
      wins.forEach((w) => beatOne(w.sessionId, w.appName));
    };

    const checkIdle = () => {
      if (document.hidden || idleTimeoutMin <= 0) return;
      const now = Date.now();
      // Windows we are NOT beating (minimized) drift toward the idle reaper.
      const wins = useDesktopStore.getState().windows
        .filter((w) => w.minimized && !w.suspended && w.sessionId);
      for (const w of wins) {
        const last = lastBeat.get(w.sessionId);
        if (!last) continue;
        const remaining = idleTimeoutMin * 60 - (now - last) / 1000;
        if (remaining > 0 && remaining <= IDLE_WARN_S && !warned.idle.has(w.sessionId)) {
          warned.idle.add(w.sessionId);
          toast.warning(`${w.appName} stops in ${Math.max(1, Math.round(remaining / 60))} min (idle)`, {
            duration: 30_000,
            action: {
              label: "Keep alive",
              onClick: () => {
                warned.idle.delete(w.sessionId);
                beatOne(w.sessionId, w.appName);
              },
            },
          });
        }
        // Re-arm the warning once the session has been kept alive.
        if (remaining > IDLE_WARN_S) warned.idle.delete(w.sessionId);
      }
    };

    beat();
    const beatId = setInterval(beat, 60_000);
    const idleId = setInterval(checkIdle, 30_000);
    return () => { clearInterval(beatId); clearInterval(idleId); };
  }, []);
}
