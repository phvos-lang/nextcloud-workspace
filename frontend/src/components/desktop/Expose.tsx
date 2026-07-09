import { useEffect, useMemo } from "react";
import { useDesktopStore } from "@/store/desktop";
import { getSnapshot } from "@/lib/sessionFrames";
import { cn } from "@/lib/utils";

interface Props {
  onClose(): void;
  onSelect(windowId: string): void;
}

export function Expose({ onClose, onSelect }: Props) {
  const { windows } = useDesktopStore();

  // Capture thumbnails once when Exposé opens
  const snaps = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const w of windows) m[w.windowId] = getSnapshot(w.windowId);
    return m;
  }, [windows]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight - 48;
  const n = windows.length;
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const PAD = 20;
  const cellW = (vw - PAD * (cols + 1)) / cols;
  const cellH = (vh - PAD * (rows + 1) - 28) / rows; // 28 = header

  return (
    <div
      className="fixed inset-0 z-[9500] bg-black/65 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <p className="absolute top-3 inset-x-0 text-center text-[11px] text-white/35 uppercase tracking-widest pointer-events-none select-none">
        Mission Control — Esc to exit
      </p>

      <div className="absolute left-0 right-0" style={{ top: 28, bottom: 48 }}>
        {n === 0 ? (
          <div className="flex h-full items-center justify-center text-white/30 text-sm">
            No open windows
          </div>
        ) : (
          windows.map((win, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const winW = win.maximized ? vw : win.width;
            const winH = win.maximized ? vh : win.height;
            const scale = Math.min(cellW / winW, cellH / winH) * 0.86;
            const tileW = winW * scale;
            const tileH = winH * scale;
            const left = PAD + col * (cellW + PAD) + (cellW - tileW) / 2;
            const top  = PAD + row * (cellH + PAD) + (cellH - tileH) / 2;

            return (
              <div
                key={win.windowId}
                className={cn(
                  "absolute cursor-pointer group transition-[transform,box-shadow] duration-100 hover:scale-[1.045]",
                  win.minimized && "opacity-45 saturate-0",
                )}
                style={{ left, top, width: tileW, height: tileH }}
                onClick={(e) => { e.stopPropagation(); onSelect(win.windowId); }}
              >
                {/* Window chrome replica */}
                <div className="flex flex-col h-full rounded-xl overflow-hidden border border-white/[0.12] shadow-2xl group-hover:border-white/40 transition-colors">
                  {/* Title bar */}
                  <div
                    className="flex items-center gap-1.5 px-2 bg-[#1e1e38] shrink-0"
                    style={{ height: Math.max(20, 28 * scale) }}
                  >
                    <div className="flex gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                      <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
                      <span className="w-2 h-2 rounded-full bg-[#28c840]" />
                    </div>
                    {win.appIcon && (
                      <img src={win.appIcon} className="h-2.5 w-2.5 object-contain opacity-60 shrink-0" alt="" />
                    )}
                    <span className="text-[9px] text-white/55 truncate flex-1 leading-none">
                      {win.appName}
                    </span>
                    {win.minimized && (
                      <span className="text-[8px] text-yellow-400/70 shrink-0">min</span>
                    )}
                  </div>
                  {/* Content area — live thumbnail when available */}
                  <div className="flex-1 bg-[#0a0a1a] flex items-center justify-center overflow-hidden">
                    {snaps[win.windowId] ? (
                      <img
                        src={snaps[win.windowId]!}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    ) : win.appIcon ? (
                      <img
                        src={win.appIcon}
                        className="opacity-[0.15]"
                        style={{
                          width: Math.min(tileW * 0.35, 72),
                          height: Math.min(tileH * 0.35, 72),
                          objectFit: "contain",
                        }}
                        alt=""
                      />
                    ) : (
                      <span className="opacity-10 text-4xl select-none">🖥️</span>
                    )}
                  </div>
                </div>
                {/* App label below tile */}
                <div className="absolute left-0 right-0 text-center" style={{ top: tileH + 4 }}>
                  <span className="inline-block text-[11px] text-white/70 bg-black/50 rounded px-1.5 py-0.5 max-w-full truncate">
                    {win.appName}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
