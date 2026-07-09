import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Maximize2, Minimize2, X, Volume2, RefreshCw, Wifi,
  Upload, Download, FolderDown, Loader2,
} from "lucide-react";
import client from "@/api/client";
import { useSessionHealth } from "@/hooks/useSessionHealth";
import { attachActivity } from "@/lib/activity";
import { useVncDisplayMode, vncQueryString } from "@/lib/vncDisplay";

// Files dropped here upload to the Nextcloud root, which is rclone-mounted into
// the container at ~/Files — so they appear inside the running session.
const TRANSFER_DIR = "/";

interface FileItem { name: string; path: string; type: string; size: number; mime: string }

export default function SessionViewer() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const uploadRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const url = `/session/${token}/`;
  const { ready, lost, frameKey, elapsed, reconnect } = useSessionHealth(url);
  const vncMode = useVncDisplayMode();

  // Hide toolbar after 3s of no mouse movement
  function resetHideTimer() {
    setToolbarVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3000);
  }

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, []);

  // F11 toggles fullscreen on the container div
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  function toggleFullscreen() {
    const el = document.getElementById("session-container");
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  // ── File transfer ──────────────────────────────────────────────────────────
  const filesQuery = useQuery({
    queryKey: ["session-transfer-files"],
    queryFn: async () =>
      (await client.get<FileItem[]>("/api/storage/files", { params: { path: TRANSFER_DIR } })).data,
    enabled: showFiles,
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return client.post("/api/storage/files/upload", form, { params: { path: TRANSFER_DIR } });
    },
    onSuccess: (_r, file) => {
      toast.success(`Sent “${file.name}” to session (~/Files)`);
      qc.invalidateQueries({ queryKey: ["session-transfer-files"] });
    },
    onError: () => toast.error("Upload failed — is Nextcloud storage connected?"),
  });

  const uploadFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((f) => uploadMut.mutate(f));
  }, [uploadMut]);

  // A file drag over the KasmVNC iframe won't reach the parent's handlers, so
  // detect the drag at the window level and raise a covering drop overlay.
  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragging(true); }
    }
    window.addEventListener("dragenter", onDragEnter);
    return () => window.removeEventListener("dragenter", onDragEnter);
  }, []);

  // On iframe load: feed activity from inside the session (same-origin) so the
  // idle timer doesn't suspend an actively-used session, and focus it.
  function onIframeLoad() {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      try { attachActivity(win); } catch { /* cross-origin — ignore */ }
    }
    iframeRef.current?.focus();
  }

  // Browsers gate autoplay until a user gesture; nudge KasmVNC's audio to play.
  function enableAudio() {
    try {
      iframeRef.current?.contentWindow?.focus();
      const doc = iframeRef.current?.contentDocument;
      doc?.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
        el.muted = false;
        el.play().catch(() => {});
      });
    } catch { /* ignore */ }
  }

  return (
    <div
      id="session-container"
      className="relative h-full w-full bg-black"
      onMouseMove={resetHideTimer}
    >
      {/* Floating toolbar */}
      <div
        className={`absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-black/70 px-3 py-1.5 backdrop-blur-sm transition-opacity duration-300 ${toolbarVisible || showFiles ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <span className="text-xs text-gray-300 font-mono">{token?.slice(0, 8)}…</span>
        <div className="h-4 w-px bg-gray-600" />
        <button onClick={() => uploadRef.current?.click()} className="text-gray-300 hover:text-white" title="Send a file to the session">
          <Upload className="h-4 w-4" />
        </button>
        <button onClick={() => setShowFiles((v) => !v)} className={`hover:text-white ${showFiles ? "text-indigo-400" : "text-gray-300"}`} title="Session files / download">
          <FolderDown className="h-4 w-4" />
        </button>
        <button onClick={enableAudio} className="text-gray-300 hover:text-white" title="Enable sound">
          <Volume2 className="h-4 w-4" />
        </button>
        <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white" title="Toggle fullscreen (F11)">
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button onClick={() => navigate("/sessions")} className="text-gray-300 hover:text-red-400" title="Disconnect">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={uploadRef} type="file" multiple className="hidden"
        onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
      />

      {/* Files / download panel */}
      {showFiles && (
        <div className="absolute right-3 top-14 z-50 max-h-[60vh] w-72 overflow-auto rounded-xl border border-white/10 bg-[#12121f]/95 p-2 shadow-2xl backdrop-blur">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-white/60">Session files (~/Files)</span>
            {uploadMut.isPending && <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />}
          </div>
          {filesQuery.isLoading ? (
            <div className="px-2 py-4 text-center text-xs text-white/40">Loading…</div>
          ) : filesQuery.isError ? (
            <div className="px-2 py-4 text-center text-xs text-white/40">Connect Nextcloud storage to transfer files.</div>
          ) : (
            <ul className="space-y-0.5">
              {(filesQuery.data ?? []).filter((f) => f.type !== "dir").map((f) => (
                <li key={f.path}>
                  <a
                    href={`/api/storage/files/download?path=${encodeURIComponent(f.path)}`}
                    download={f.name}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/80 hover:bg-white/10"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    <span className="truncate">{f.name}</span>
                  </a>
                </li>
              ))}
              {(filesQuery.data ?? []).filter((f) => f.type !== "dir").length === 0 && (
                <li className="px-2 py-4 text-center text-xs text-white/40">No files yet — drop one on the desktop.</li>
              )}
            </ul>
          )}
        </div>
      )}

      {!ready ? (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center text-white">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-white/10 border-t-indigo-500" />
            <div className="text-sm font-semibold">Starting…</div>
            {elapsed > 0 && (
              <div className="mt-1 text-xs text-gray-400">{elapsed.toFixed(0)}s</div>
            )}
          </div>
        </div>
      ) : (
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={`${url}?${vncQueryString(vncMode)}`}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; autoplay; fullscreen; microphone; camera; display-capture"
          title="Remote Desktop"
          onLoad={onIframeLoad}
        />
      )}

      {/* Drag-to-upload overlay — covers the iframe so drops are captured */}
      {dragging && (
        <div
          className="absolute inset-0 z-[55] flex items-center justify-center border-2 border-dashed border-indigo-400/70 bg-indigo-950/60 backdrop-blur-sm"
          onDragOver={(e) => { e.preventDefault(); }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
          }}
        >
          <div className="pointer-events-none text-center text-white">
            <Upload className="mx-auto mb-3 h-10 w-10 text-indigo-300" />
            <div className="text-sm font-semibold">Drop to send to the session</div>
            <div className="mt-1 text-xs text-white/50">Files appear in ~/Files inside the desktop</div>
          </div>
        </div>
      )}

      {/* Connection-lost overlay with reconnect */}
      {lost && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center text-white">
            <Wifi className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <div className="text-sm font-semibold">Connection lost</div>
            <div className="mt-1 text-xs text-gray-400">The session became unreachable.</div>
            <button
              onClick={reconnect}
              className="mx-auto mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
