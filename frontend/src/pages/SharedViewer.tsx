import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye, MousePointer2, AlertTriangle } from "lucide-react";
import client from "@/api/client";

interface ShareInfo {
  connect_url: string;
  mode: "view" | "control";
  app_name: string;
  owner: string;
}

/**
 * Full-screen viewer for a shared session. Requires login (RequireAuth in App).
 * View-only mode is enforced with a transparent overlay that swallows all
 * pointer/keyboard input before it reaches the session iframe.
 */
export default function SharedViewer() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    client
      .get(`/api/sessions/shared/${token}/info`)
      .then((r) => setInfo(r.data))
      .catch((e) => {
        setError(e?.response?.status === 404
          ? "This share link is invalid, expired or revoked."
          : "Could not load the shared session.");
      });
  }, [token]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0d0d1a] text-white">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <p className="text-sm text-white/70">{error}</p>
        <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">Back to desktop</a>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0d1a]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Banner */}
      <div className="flex h-9 shrink-0 items-center gap-2 bg-[#131320] px-3 text-xs text-white/70">
        {info.mode === "view"
          ? <Eye className="h-3.5 w-3.5 text-sky-400" />
          : <MousePointer2 className="h-3.5 w-3.5 text-amber-400" />}
        <span>
          <span className="font-semibold text-white">{info.app_name}</span>
          {" — shared by "}
          <span className="font-semibold text-white">{info.owner}</span>
          {info.mode === "view" ? " (view only)" : " (full control)"}
        </span>
        <a href="/" className="ml-auto text-indigo-400 hover:text-indigo-300">Exit</a>
      </div>

      {/* Session */}
      <div className="relative min-h-0 flex-1">
        <iframe
          src={info.connect_url}
          title={info.app_name}
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
        />
        {info.mode === "view" && (
          // Input shield: swallows all mouse/keyboard so the guest can watch only.
          <div className="absolute inset-0 z-10" tabIndex={0} />
        )}
      </div>
    </div>
  );
}
