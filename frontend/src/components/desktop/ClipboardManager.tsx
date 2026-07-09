import { useState } from "react";
import { ClipboardCheck, Download, Trash2, X, Send } from "lucide-react";
import { toast } from "sonner";
import { useDesktopStore } from "@/store/desktop";
import { pushToSession, readFromSession } from "@/lib/sessionFrames";

/**
 * Shared desktop clipboard — bridges copy/paste between session apps. Each app
 * is its own container, so we keep a history here and push/pull entries through
 * KasmVNC's own clipboard (same-origin), which is reliable regardless of the
 * browser's navigator.clipboard read permission.
 */
export function ClipboardManager({ onClose }: { onClose(): void }) {
  const { windows, clipboardHistory, addClip, clearClips } = useDesktopStore();
  const [manual, setManual] = useState("");

  // Topmost non-minimized session window = the paste target.
  const active = [...windows]
    .filter((w) => !w.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0];

  const sendTo = (text: string) => {
    addClip(text);
    navigator.clipboard?.writeText(text).catch(() => {});
    if (active && pushToSession(active.windowId, text)) {
      toast.success(`Sent to ${active.appName} — paste with Ctrl+V`);
    } else {
      // Web-native apps (terminal, Jupyter) paste straight from the system
      // clipboard, which we just wrote.
      toast.message(`Copied — paste with Ctrl+V${active ? ` in ${active.appName}` : ""}`);
    }
    onClose();
  };

  const grab = () => {
    if (!active) { toast.error("No active session"); return; }
    const t = readFromSession(active.windowId);
    if (t && t.trim()) { addClip(t); toast.success(`Captured from ${active.appName}`); }
    else toast.message("Nothing to capture — copy inside the app first");
  };

  return (
    <>
      <div className="fixed inset-0 z-[99998]" onClick={onClose} />
      <div className="fixed bottom-14 right-2 z-[99999] flex w-[320px] flex-col rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
          <ClipboardCheck className="h-4 w-4 text-indigo-400" />
          <span className="flex-1 text-sm font-semibold text-white">Clipboard</span>
          <button onClick={grab} title="Capture from the active session" className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <Download className="h-4 w-4" />
          </button>
          <button onClick={clearClips} title="Clear history" className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Manual entry */}
        <div className="flex items-center gap-2 border-b border-white/10 p-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) { sendTo(manual); setManual(""); } }}
            placeholder={active ? `Type & send to ${active.appName}…` : "Type text…"}
            className="min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={() => { if (manual.trim()) { sendTo(manual); setManual(""); } }}
            disabled={!manual.trim()}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* History */}
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {clipboardHistory.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-white/30">
              Copy inside an app, or hit the ⤓ button to capture. Then click an entry to send it to the active app.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {clipboardHistory.map((c, i) => (
                <li key={i}>
                  <button
                    onClick={() => sendTo(c)}
                    title={active ? `Send to ${active.appName}` : "Copy"}
                    className="group flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/10"
                  >
                    <Send className="mt-0.5 h-3 w-3 shrink-0 text-white/25 group-hover:text-indigo-400" />
                    <span className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-white/80">{c}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
