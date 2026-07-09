import { useEffect, useRef } from "react";
import {
  getLastActivity, initGlobalActivity, onActivity,
} from "@/lib/activity";

interface IdleTimerOptions {
  idleMs: number;       // ms of inactivity before onIdle fires
  onIdle(): void;       // called when user goes idle
  onActive(): void;     // called when user becomes active again
  enabled?: boolean;
}

/**
 * Fires onIdle after `idleMs` with no activity from the top window OR any
 * session iframe (see @/lib/activity), and onActive the moment activity
 * resumes. Polling-based so multiple activity sources stay consistent.
 */
export function useIdleTimer({ idleMs, onIdle, onActive, enabled = true }: IdleTimerOptions) {
  const isIdle    = useRef(false);
  const idleCb    = useRef(onIdle);
  const activeCb  = useRef(onActive);
  idleCb.current   = onIdle;
  activeCb.current = onActive;

  useEffect(() => {
    if (!enabled) return;
    initGlobalActivity();

    const check = () => {
      if (isIdle.current) return;
      if (Date.now() - getLastActivity() >= idleMs) {
        isIdle.current = true;
        idleCb.current();
      }
    };
    const interval = setInterval(check, 5000);

    // Resume immediately on the next activity pulse after going idle.
    const unsub = onActivity(() => {
      if (isIdle.current) {
        isIdle.current = false;
        activeCb.current();
      }
    });

    return () => { clearInterval(interval); unsub(); };
  }, [idleMs, enabled]);
}
