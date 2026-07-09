import { useState } from "react";
import { X, Folder, ChevronLeft, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useDesktopStore } from "@/store/desktop";
import { cn } from "@/lib/utils";
import client from "@/api/client";

interface FileEntry {
  name: string;
  path: string;
  type: "dir" | "file";
  mime: string;
}

const PRESETS = [
  { label: "Night blue",  value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  { label: "Twilight",    value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" },
  { label: "Forest",      value: "linear-gradient(135deg, #0a3d2b 0%, #1a5c3e 50%, #0d2b1f 100%)" },
  { label: "Ember",       value: "linear-gradient(135deg, #1a0000 0%, #3d0000 40%, #7b2000 100%)" },
  { label: "Slate",       value: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 50%, #3a3a3c 100%)" },
  { label: "Aurora",      value: "linear-gradient(135deg, #0d1b2a 0%, #1b4332 35%, #1d3557 70%, #0d1b2a 100%)" },
  { label: "Deep sea",    value: "linear-gradient(180deg, #020b18 0%, #0a2040 50%, #0d3060 100%)" },
  { label: "Minimal dark",value: "#111113" },
];

export function WallpaperPicker({ onClose }: { onClose(): void }) {
  const { wallpaper, setWallpaper } = useDesktopStore();
  const [custom, setCustom] = useState(
    PRESETS.some((p) => p.value === wallpaper) ? "" : wallpaper
  );

  // Browse the user's Nextcloud files for an image wallpaper
  const { data: ncCfg } = useQuery({
    queryKey: ["storage", "nextcloud"],
    queryFn: () => client.get("/api/storage/nextcloud").then((r) => r.data),
    staleTime: 60_000,
  });
  const ncReady = !!(ncCfg?.system_configured || ncCfg?.personal_url);
  const [ncOpen, setNcOpen] = useState(false);
  const [ncPath, setNcPath] = useState("/");
  const { data: files = [], isLoading: filesLoading } = useQuery<FileEntry[]>({
    queryKey: ["wp-files", ncPath],
    queryFn: () => client.get("/api/storage/files", { params: { path: ncPath } }).then((r) => r.data),
    enabled: ncReady && ncOpen,
    staleTime: 30_000,
  });
  const dirs = files.filter((f) => f.type === "dir");
  const images = files.filter((f) => f.type === "file" && (f.mime || "").startsWith("image/"));
  const parentPath = ncPath.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";

  const apply = (value: string, close = false) => {
    setWallpaper(value);
    setCustom(value.startsWith("http") ? value : "");
    if (close) onClose();
  };

  const current = wallpaper || PRESETS[0].value;
  const isGrad = (v: string) => v.startsWith("linear-gradient") || v.startsWith("radial-gradient") || v.startsWith("#");

  return (
    <div
      className="fixed inset-0 z-[9200] flex items-end justify-center pb-16"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Transparent backdrop — clicking outside closes */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-gray-900/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
        {/* Live preview strip */}
        <div
          className="h-14 w-full rounded-t-2xl transition-all duration-300"
          style={isGrad(current)
            ? { background: current }
            : { backgroundImage: `url(${current})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />

        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="font-semibold text-white">Wallpaper</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => apply(p.value, true)}
                title={p.label}
                className={cn(
                  "group relative h-16 w-full overflow-hidden rounded-xl ring-2 transition-all",
                  current === p.value
                    ? "ring-indigo-400 scale-95"
                    : "ring-transparent hover:ring-white/30 hover:scale-[0.97]",
                )}
                style={p.value.startsWith("#") ? { background: p.value } : { backgroundImage: p.value }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-center text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {p.label}
                </span>
              </button>
            ))}
          </div>

          {ncReady && (
            <div className="mt-3">
              <button
                onClick={() => setNcOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 text-xs font-medium text-white/60 hover:text-white transition-colors"
              >
                {ncOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                From your files (Nextcloud)
              </button>
              {ncOpen && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {ncPath !== "/" && (
                      <button
                        onClick={() => setNcPath(parentPath)}
                        className="flex h-6 w-6 items-center justify-center rounded text-white/50 hover:bg-white/10 hover:text-white"
                        title="Back"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="truncate text-[11px] text-white/40">{ncPath}</span>
                    {filesLoading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-white/30" />}
                  </div>
                  {dirs.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {dirs.map((d) => (
                        <button
                          key={d.path}
                          onClick={() => setNcPath(d.path)}
                          className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                        >
                          <Folder className="h-3 w-3 text-sky-400" />
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {images.map((f) => (
                        <button
                          key={f.path}
                          title={f.name}
                          onClick={() => apply(`/api/storage/files/thumbnail?path=${encodeURIComponent(f.path)}&size=1920`, true)}
                          className="group relative h-16 overflow-hidden rounded-lg ring-2 ring-transparent hover:ring-indigo-400 transition-all"
                        >
                          <img
                            src={`/api/storage/files/thumbnail?path=${encodeURIComponent(f.path)}&size=128`}
                            alt={f.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            {f.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    !filesLoading && (
                      <p className="py-2 text-center text-[11px] text-white/30">
                        No images in this folder
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <label className="mb-1 block text-xs text-white/50">Custom image URL</label>
            <div className="flex gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && custom && apply(custom, true)}
                placeholder="https://…/photo.jpg"
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 outline-none ring-1 ring-white/10 focus:ring-indigo-500"
              />
              <button
                onClick={() => custom && apply(custom, true)}
                disabled={!custom}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
