import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Rnd } from "react-rnd";
import {
  ArrowLeft, ArrowRight, RotateCw, Home, X, Minus, Maximize2, Minimize2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import client from "@/api/client";
import { useDesktopStore, type AppWindow } from "@/store/desktop";

interface NavState {
  history: string[];
  idx: number;
}

export function BrowserWindow({ win }: { win: AppWindow }) {
  const { focusWindow, minimizeWindow, toggleMaximize, closeWindow, updateBounds } =
    useDesktopStore();
  const qc = useQueryClient();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const homeUrl = win.connectUrl;
  const [nav, setNav] = useState<NavState>({ history: [homeUrl], idx: 0 });
  const [addressInput, setAddressInput] = useState(homeUrl);
  const [loading, setLoading] = useState(false);

  const currentUrl = nav.history[nav.idx] ?? homeUrl;

  useEffect(() => { setAddressInput(currentUrl); }, [currentUrl]);

  const navigate = (url: string) => {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target) && !target.startsWith("/")) {
      target = `https://${target}`;
    }
    setNav((n) => {
      const trimmed = n.history.slice(0, n.idx + 1);
      return { history: [...trimmed, target], idx: trimmed.length };
    });
  };

  const back = () => setNav((n) => ({ ...n, idx: Math.max(0, n.idx - 1) }));
  const forward = () => setNav((n) => ({ ...n, idx: Math.min(n.history.length - 1, n.idx + 1) }));
  const refresh = () => setIframeKey((k) => k + 1);
  const home = () => navigate(homeUrl);

  const onAddrKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") navigate(addressInput);
    if (e.key === "Escape") setAddressInput(currentUrl);
  };

  const stopSession = useMutation({
    mutationFn: () => client.delete(`/api/sessions/${win.sessionId}`),
    onSettled: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  // Close the window immediately; container teardown happens in the background.
  const handleClose = () => { closeWindow(win.windowId); stopSession.mutate(); };

  const saveBounds = (x: number, y: number, w: number, h: number) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      client.patch(`/api/sessions/${win.sessionId}/window`, { x, y, width: w, height: h })
        .catch(() => {});
    }, 800);
  };

  if (win.minimized) return null;

  const TASKBAR_H = 48;

  const chrome = (
    <div
      className="window-drag-handle flex h-9 shrink-0 cursor-move items-center gap-1 bg-gray-800 px-2 select-none"
      onMouseDown={() => focusWindow(win.windowId)}
    >
      {/* Window controls */}
      <button
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white"
        onClick={(e) => { e.stopPropagation(); minimizeWindow(win.windowId); }}
        title="Minimise"
      ><Minus className="h-3.5 w-3.5" /></button>
      <button
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white"
        onClick={(e) => { e.stopPropagation(); toggleMaximize(win.windowId); }}
        title={win.maximized ? "Restore" : "Maximise"}
      >{win.maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
      <button
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-500 hover:text-white"
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        title="Close"
      ><X className="h-3.5 w-3.5" /></button>

      <div className="mx-1 h-4 w-px bg-white/10" />

      {/* Navigation */}
      <button onClick={back} disabled={nav.idx === 0}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30">
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <button onClick={forward} disabled={nav.idx >= nav.history.length - 1}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30">
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button onClick={refresh}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white">
        <RotateCw className={`h-3.5 w-3.5 transition-transform ${loading ? "animate-spin" : ""}`} />
      </button>
      <button onClick={home} title="Home"
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-white/10 hover:text-white">
        <Home className="h-3.5 w-3.5" />
      </button>

      {/* Address bar */}
      <div className="flex flex-1 items-center gap-1.5 rounded bg-black/30 px-2.5 py-1 mx-1">
        {win.appIcon
          ? <img src={win.appIcon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />
          : <span className="text-xs leading-none">🌐</span>
        }
        <input
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          onKeyDown={onAddrKey}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 bg-transparent text-xs text-white/80 outline-none"
          spellCheck={false}
        />
      </div>

      <span className="mr-1 max-w-[100px] truncate text-xs text-gray-500">{win.appName}</span>
    </div>
  );

  const iframe = (
    <iframe
      key={`${iframeKey}-${currentUrl}`}
      src={currentUrl}
      className="flex-1 border-0 bg-white"
      allow="clipboard-read; clipboard-write; autoplay; fullscreen; geolocation"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock allow-modals allow-downloads"
      onLoadStart={() => setLoading(true)}
      onLoad={() => setLoading(false)}
      title={win.appName}
    />
  );

  if (win.maximized) {
    return (
      <div
        className="fixed left-0 top-0 flex flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900 shadow-2xl"
        style={{ width: "100vw", height: `calc(100vh - ${TASKBAR_H}px)`, zIndex: win.zIndex }}
        onMouseDown={() => focusWindow(win.windowId)}
      >
        {chrome}
        {iframe}
      </div>
    );
  }

  return (
    <Rnd
      position={{ x: win.x, y: win.y }}
      size={{ width: win.width, height: win.height }}
      minWidth={520}
      minHeight={380}
      bounds="window"
      dragHandleClassName="window-drag-handle"
      style={{ zIndex: win.zIndex, position: "fixed" }}
      onMouseDown={() => focusWindow(win.windowId)}
      onDragStop={(_, d) => {
        updateBounds(win.windowId, d.x, d.y, win.width, win.height);
        saveBounds(d.x, d.y, win.width, win.height);
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        updateBounds(win.windowId, pos.x, pos.y, ref.offsetWidth, ref.offsetHeight);
        saveBounds(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight);
      }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-gray-900 shadow-2xl">
        {chrome}
        {iframe}
      </div>
    </Rnd>
  );
}
