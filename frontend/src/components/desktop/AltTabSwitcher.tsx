import { useMemo } from "react";
import { useDesktopStore } from "@/store/desktop";
import { getSnapshot } from "@/lib/sessionFrames";
import { cn } from "@/lib/utils";

interface Props {
  selectedIdx: number;
  onSelect(windowId: string): void;
}

export function AltTabSwitcher({ selectedIdx, onSelect }: Props) {
  const { windows } = useDesktopStore();

  // Thumbnails captured once when the switcher opens
  const snaps = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const w of windows) m[w.windowId] = getSnapshot(w.windowId);
    return m;
  }, [windows]);

  return (
    <div className="fixed inset-0 z-[9800] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 max-w-2xl rounded-2xl bg-black/85 backdrop-blur-xl border border-white/10 px-5 py-4 shadow-2xl">
        {windows.length === 0 ? (
          <span className="text-white/40 text-sm px-4 py-2">No open windows</span>
        ) : (
          windows.map((win, i) => (
            <button
              key={win.windowId}
              onClick={() => onSelect(win.windowId)}
              className={cn(
                "flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all min-w-[76px]",
                i === selectedIdx
                  ? "bg-white/20 ring-1 ring-white/50 scale-105"
                  : "hover:bg-white/10",
              )}
            >
              <div className="relative w-28 h-[4.5rem] rounded-xl bg-black/40 flex items-center justify-center shrink-0 overflow-hidden">
                {snaps[win.windowId] ? (
                  <>
                    <img src={snaps[win.windowId]!} className="h-full w-full object-cover" alt="" />
                    {win.appIcon && (
                      <img src={win.appIcon} className="absolute bottom-1 right-1 w-5 h-5 object-contain drop-shadow" alt="" />
                    )}
                  </>
                ) : win.appIcon
                  ? <img src={win.appIcon} className="w-9 h-9 object-contain" alt="" />
                  : <span className="text-3xl">🖥️</span>
                }
                {win.minimized && (
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-yellow-400 border-2 border-black" />
                )}
              </div>
              <span className={cn(
                "text-[11px] max-w-[112px] truncate text-center leading-tight",
                i === selectedIdx ? "text-white" : "text-white/70",
              )}>
                {win.appName}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
