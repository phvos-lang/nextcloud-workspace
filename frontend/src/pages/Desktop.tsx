import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import client from "@/api/client";
import type { App, Session } from "@/types";
import { useAuthStore } from "@/store/auth";
import { useDesktopStore } from "@/store/desktop";
import { useIdleTimer } from "@/hooks/useIdleTimer";
import { Window } from "@/components/desktop/Window";
import { Taskbar } from "@/components/desktop/Taskbar";
import { SystemBanner } from "@/components/desktop/SystemBanner";
import { AppLauncher } from "@/components/desktop/AppLauncher";
import { DesktopIcon } from "@/components/desktop/DesktopIcon";
import { ContextMenu } from "@/components/desktop/ContextMenu";
import { WallpaperPicker } from "@/components/desktop/WallpaperPicker";
import { AdminWindow } from "@/components/desktop/AdminWindow";
import { LaunchPanel } from "@/components/desktop/LaunchPanel";
import { AltTabSwitcher } from "@/components/desktop/AltTabSwitcher";
import { Expose } from "@/components/desktop/Expose";
import { OnboardingModal } from "@/components/OnboardingModal";
import { DesktopTiles } from "@/components/desktop/DesktopTiles";
import { StorageWindow } from "@/components/desktop/StorageWindow";
import { ProfileWindow } from "@/components/desktop/ProfileWindow";
import { FileManagerWindow } from "@/components/desktop/FileManagerWindow";
import { CommandPalette } from "@/components/desktop/CommandPalette";
import { useOpenFilePoll } from "@/hooks/useOpenFilePoll";
import { useClipboardCapture } from "@/hooks/useClipboardCapture";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";

const DEFAULT_WALLPAPER =
  "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)";

export default function Desktop() {
  const { user } = useAuthStore();
  const {
    windows, launcherOpen, setLauncherOpen,
    adminOpen,
    storageOpen, profileOpen, fileManagerOpen,
    launching,
    wallpaper, pinned, restoreFromSessions, ensureSystemIcons,
    focusWindow, closeWindow,
    theme, desktopLayout,
    activeWorkspace,
    suspendWindow, resumeWindow,
    detached, detachAll, setDetached,
  } = useDesktopStore();

  // Session transfer between tabs: the most recently opened desktop tab claims
  // the sessions; other tabs detach their windows (containers keep running)
  // and show a takeover overlay until the user claims them back.
  const tabId = useRef(crypto.randomUUID());
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    const bc = new BroadcastChannel("lwp-desktop");
    bcRef.current = bc;
    bc.onmessage = (e) => {
      if (e.data?.type === "claim" && e.data.tabId !== tabId.current) detachAll();
    };
    bc.postMessage({ type: "claim", tabId: tabId.current });
    return () => bc.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const claimDesktop = useCallback(() => {
    bcRef.current?.postMessage({ type: "claim", tabId: tabId.current });
    setDetached(false);
  }, [setDetached]);

  // Idle timer — suspend sessions after 15 min inactivity
  const IDLE_MS = 15 * 60 * 1000;
  const qc = useQueryClient();
  const onIdle = useCallback(() => {
    // Background-eligible apps (Terminal) stay running when the user opted in —
    // pausing would freeze their tmux jobs. The backend reaper caps them at 48h.
    const prefs = (useAuthStore.getState().user?.preferences ?? {}) as Record<string, unknown>;
    const bgIds = prefs.terminal_background
      ? new Set((qc.getQueryData<App[]>(["apps"]) ?? []).filter((a) => a.bg_allowed).map((a) => a.id))
      : new Set<string>();
    const running = useDesktopStore.getState().windows.filter(
      (w) => !w.suspended && w.workspace !== undefined && !bgIds.has(w.appId)
    );
    if (!running.length) return;
    running.forEach((w) => {
      client.post(`/api/sessions/${w.sessionId}/pause`).catch(() => {});
      suspendWindow(w.windowId);
    });
    toast.info(`${running.length} session${running.length > 1 ? "s" : ""} suspended due to inactivity`);
  }, [suspendWindow, qc]);

  const onActive = useCallback(() => {
    const suspended = useDesktopStore.getState().windows.filter((w) => w.suspended);
    if (!suspended.length) return;
    suspended.forEach((w) => {
      client.post(`/api/sessions/${w.sessionId}/resume`).catch(() => {});
      resumeWindow(w.windowId);
    });
    toast.success("Sessions resumed");
  }, [resumeWindow]);

  useIdleTimer({ idleMs: IDLE_MS, onIdle, onActive });
  useOpenFilePoll();
  useClipboardCapture();
  useSessionHeartbeat();

  // Apply theme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark")   { root.classList.add("dark"); return; }
    if (theme === "light")  { root.classList.remove("dark"); return; }
    // system
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.matches ? root.classList.add("dark") : root.classList.remove("dark");
    const onChange = (e: MediaQueryListEvent) =>
      e.matches ? root.classList.add("dark") : root.classList.remove("dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Onboarding — show once per user. Server preference is the source of truth
  // so it stays dismissed across browsers / private windows; localStorage is a
  // fast-path fallback for accounts onboarded before the server flag existed.
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!user) return;
    // Already provisioned (NC connected) or previously onboarded ⇒ never ask again.
    const onboarded = (user.preferences as any)?.onboarded === true
      || (user as any)?.nc_connected === true
      || !!localStorage.getItem(`lwp_setup_${user.id}`);
    if (!onboarded) setShowOnboarding(true);
  }, [user?.id]);

  const [desktopCtx, setDesktopCtx] = useState<{ x: number; y: number } | null>(null);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [exposeOpen, setExposeOpen] = useState(false);
  const [altTabOpen, setAltTabOpen] = useState(false);
  const [altTabIdx, setAltTabIdx] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Keyboard shortcuts
  const altHeld = useRef(false);
  const windowsRef = useRef(windows);
  useEffect(() => { windowsRef.current = windows; }, [windows]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") { altHeld.current = true; return; }

      // Ctrl/Cmd+K — command palette
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // Alt+Tab — window switcher
      if (e.key === "Tab" && altHeld.current) {
        e.preventDefault();
        const wins = windowsRef.current;
        if (!wins.length) return;
        setAltTabOpen(true);
        setAltTabIdx((prev) => {
          const next = e.shiftKey ? prev - 1 : prev + 1;
          return ((next % wins.length) + wins.length) % wins.length;
        });
        return;
      }

      // Super/Meta — toggle launcher; Super+Tab — Exposé
      if (e.key === "Meta" && !e.repeat) {
        if (e.shiftKey) { setExposeOpen((v) => !v); return; }
        setLauncherOpen(!launcherOpen);
        return;
      }

      // Escape — close overlays in priority order
      if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (altTabOpen) { setAltTabOpen(false); return; }
        if (exposeOpen) { setExposeOpen(false); return; }
        if (launcherOpen) { setLauncherOpen(false); return; }
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Alt") return;
      altHeld.current = false;
      if (altTabOpen) {
        const win = windowsRef.current[altTabIdx];
        if (win) focusWindow(win.windowId);
        setAltTabOpen(false);
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [altTabOpen, altTabIdx, exposeOpen, launcherOpen, paletteOpen]);

  const { data: sessions = [], isSuccess: sessionsLoaded } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: () => client.get("/api/sessions").then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: apps = [] } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: () => client.get("/api/apps").then((r) => r.data),
  });

  const { data: ncCfg } = useQuery({
    queryKey: ["storage", "nextcloud"],
    queryFn: () => client.get("/api/storage/nextcloud").then((r) => r.data),
    staleTime: 60_000,
  });

  // Clipboard sync (privacy opt-in): hydrate server-side history once on login
  useEffect(() => {
    const prefs = user?.preferences as Record<string, unknown> | undefined;
    if (prefs?.clipboard_sync && Array.isArray(prefs.clipboard_history)) {
      useDesktopStore.getState().mergeClips(prefs.clipboard_history as string[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Sync system icons whenever role or NC config changes
  useEffect(() => {
    if (user) ensureSystemIcons(user.is_admin, !!(ncCfg?.system_configured || ncCfg?.personal_url));
  }, [user?.is_admin, ncCfg?.system_configured, ncCfg?.personal_url]);

  // Adopt running sessions as windows — on load and continuously, so sessions
  // started in another tab/device appear here (session transfer) as the
  // sessions poll picks them up. Skipped while detached (another tab owns them).
  useEffect(() => {
    if (detached || !sessions.length || !apps.length) return;
    const alreadyOpen = new Set(windows.map((w) => w.sessionId));
    const fresh = sessions.filter((s) => !alreadyOpen.has(s.id));
    if (fresh.length) restoreFromSessions(fresh, apps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, apps, detached]);

  // Auto-close windows whose session stopped (app exited inside VNC or container died)
  useEffect(() => {
    if (!sessionsLoaded || detached) return;
    const live = new Set(sessions.map((s) => s.id));
    useDesktopStore.getState().windows.forEach((w) => {
      if (w.sessionId && !live.has(w.sessionId)) closeWindow(w.windowId);
    });
  }, [sessions, sessionsLoaded, closeWindow]);

  const handleDesktopRightClick = (e: React.MouseEvent) => {
    // Only fire if click is on the desktop canvas itself
    if ((e.target as HTMLElement).closest("[data-no-ctx]")) return;
    e.preventDefault();
    setDesktopCtx({ x: e.clientX, y: e.clientY });
  };

  const bg = wallpaper || DEFAULT_WALLPAPER;
  const isGradient = bg.startsWith("linear-gradient") || bg.startsWith("radial-gradient") || bg.startsWith("#");

  return (
    <div
      className="relative h-screen w-screen overflow-hidden select-none"
      style={
        isGradient
          ? { background: bg }
          : { backgroundImage: `url("${bg}")`, backgroundSize: "cover", backgroundPosition: "center" }
      }
      onContextMenu={handleDesktopRightClick}
      onMouseDown={() => {
        if (launcherOpen) setLauncherOpen(false);
        if (desktopCtx) setDesktopCtx(null);
      }}
    >
      {/* Session-transfer overlay: another tab claimed the desktop */}
      {detached && (
        <div className="fixed inset-0 z-[9900] flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <p className="text-lg font-medium text-white">
            Your desktop moved to another tab
          </p>
          <p className="max-w-sm text-center text-sm text-white/60">
            Sessions keep running there. Take them back to continue in this tab —
            the other tab will hand them over.
          </p>
          <button
            onClick={claimDesktop}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Use desktop here
          </button>
        </div>
      )}

      {/* Desktop icons / tiles — layout controlled by desktopLayout */}
      {desktopLayout === "icons" && pinned.length > 0 && (
        <div className="absolute left-3 top-3 flex flex-col gap-1 pb-14" data-no-ctx>
          {pinned.map((item) => (
            <DesktopIcon key={item.id} item={item} apps={apps} />
          ))}
        </div>
      )}
      {desktopLayout === "tiles" && (
        <div data-no-ctx>
          <DesktopTiles apps={apps} />
        </div>
      )}

      {/* App windows — only show windows belonging to the active workspace */}
      {windows.map((win) => (
        <div key={win.windowId} data-no-ctx style={{ display: win.workspace === activeWorkspace ? undefined : "none" }}>
          <Window win={win} />
        </div>
      ))}

      {/* App launcher overlay */}
      {launcherOpen && (
        <div data-no-ctx>
          <AppLauncher onClose={() => setLauncherOpen(false)} />
        </div>
      )}

      {/* Right-click context menu on wallpaper */}
      {desktopCtx && (
        <ContextMenu
          x={desktopCtx.x}
          y={desktopCtx.y}
          items={[
            {
              label: "App launcher",
              icon: "⊞",
              onClick: () => setLauncherOpen(true),
            },
          ]}
          onClose={() => setDesktopCtx(null)}
        />
      )}

      {/* Wallpaper picker modal */}
      {showWallpaper && (
        <div data-no-ctx>
          <WallpaperPicker onClose={() => setShowWallpaper(false)} />
        </div>
      )}

      {/* Admin window */}
      {adminOpen && (
        <div data-no-ctx>
          <AdminWindow />
        </div>
      )}

      {/* Storage window */}
      {storageOpen && (
        <div data-no-ctx>
          <StorageWindow />
        </div>
      )}

      {/* Profile window */}
      {profileOpen && (
        <div data-no-ctx>
          <ProfileWindow />
        </div>
      )}

      {/* File manager native window */}
      {fileManagerOpen && (
        <div data-no-ctx>
          <FileManagerWindow />
        </div>
      )}

      {/* Taskbar — always on top */}
      <div data-no-ctx>
        <SystemBanner />
        <Taskbar onExposeOpen={() => setExposeOpen(true)} />
      </div>

      {/* Alt+Tab window switcher */}
      {altTabOpen && (
        <div data-no-ctx>
          <AltTabSwitcher
            selectedIdx={altTabIdx}
            onSelect={(windowId) => { focusWindow(windowId); setAltTabOpen(false); }}
          />
        </div>
      )}

      {/* Exposé / Mission Control */}
      {exposeOpen && (
        <div data-no-ctx>
          <Expose
            onClose={() => setExposeOpen(false)}
            onSelect={(windowId) => { focusWindow(windowId); setExposeOpen(false); }}
          />
        </div>
      )}

      {/* Launch overlay — shown while container starts */}
      {paletteOpen && <CommandPalette apps={apps} onClose={() => setPaletteOpen(false)} />}

      {launching && <LaunchPanel info={launching} />}

      {/* First-run onboarding */}
      {showOnboarding && user && (
        <OnboardingModal userId={String(user.id)} onDone={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
