import { useState, useEffect, useRef, useCallback } from "react";
import { Cloud, Palette, LayoutGrid, CheckCircle, ExternalLink, Loader2, XCircle, Monitor, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import client from "@/api/client";
import { useDesktopStore } from "@/store/desktop";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Night blue",  value: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" },
  { label: "Twilight",    value: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)" },
  { label: "Forest",      value: "linear-gradient(135deg, #0a3d2b 0%, #1a5c3e 50%, #0d2b1f 100%)" },
  { label: "Ember",       value: "linear-gradient(135deg, #1a0000 0%, #3d0000 40%, #7b2000 100%)" },
  { label: "Slate",       value: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 50%, #3a3a3c 100%)" },
  { label: "Aurora",      value: "linear-gradient(135deg, #0d1b2a 0%, #1b4332 35%, #1d3557 70%, #0d1b2a 100%)" },
  { label: "Minimal",     value: "#111113" },
  { label: "Deep sea",    value: "linear-gradient(180deg, #020b18 0%, #0a2040 50%, #0d3060 100%)" },
];

const LAYOUTS = [
  { id: "icons",  label: "Desktop icons", desc: "App shortcuts on the desktop", icon: "🖥️" },
  { id: "tiles",  label: "Tiles",         desc: "App grid tiles on the desktop", icon: "⊞" },
  { id: "clean",  label: "Clean desktop", desc: "No icons — use the launcher",   icon: "✦" },
] as const;

const THEMES = [
  { id: "dark",   label: "Dark",   icon: Moon },
  { id: "light",  label: "Light",  icon: Sun },
  { id: "system", label: "System", icon: Monitor },
] as const;

interface Props { userId: string; onDone(): void }

type Step = "welcome" | "nextcloud" | "appearance" | "done";

// NC Login Flow state
type FlowState = "idle" | "starting" | "waiting" | "success" | "error";

export function OnboardingModal({ userId, onDone }: Props) {
  const qc = useQueryClient();
  const { wallpaper, setWallpaper, theme, setTheme, desktopLayout, setDesktopLayout } = useDesktopStore();

  const [step, setStep] = useState<Step>("welcome");
  const [ncUrl, setNcUrl]   = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [flowErr, setFlowErr]     = useState("");
  const [flowUsername, setFlowUsername] = useState("");
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollData = useRef<{ endpoint: string; token: string; nc_url: string } | null>(null);
  const popupRef = useRef<Window | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  useEffect(() => () => stopPoll(), []);

  const startFlow = useCallback(async () => {
    if (!ncUrl.trim()) return;
    setFlowState("starting"); setFlowErr("");
    try {
      const r = await client.post("/api/storage/nextcloud/connect", { url: ncUrl.trim() });
      const { login_url, poll_endpoint, poll_token, nc_url: resolvedUrl } = r.data;
      pollData.current = { endpoint: poll_endpoint, token: poll_token, nc_url: resolvedUrl };
      popupRef.current = window.open(login_url, "nc_login", "width=600,height=700,noopener");
      setFlowState("waiting");
      pollRef.current = setInterval(async () => {
        try {
          const pr = await client.post("/api/storage/nextcloud/connect/poll", {
            poll_endpoint: poll_endpoint,
            poll_token: poll_token,
            nc_url: resolvedUrl,
          });
          if (pr.data.done) {
            stopPoll();
            popupRef.current?.close();
            setFlowState("success");
            setFlowUsername(pr.data.username);
            qc.invalidateQueries({ queryKey: ["storage", "nextcloud"] });
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e: any) {
      setFlowState("error");
      setFlowErr(e.response?.data?.detail ?? "Could not reach Nextcloud");
    }
  }, [ncUrl, qc]);

  const finish = () => {
    stopPoll();
    localStorage.setItem(`lwp_setup_${userId}`, "1");
    // Persist server-side so it stays dismissed in other browsers / private windows.
    client.patch("/api/auth/me/preferences", { onboarded: true }).catch(() => {});
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[9900] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 shadow-2xl ring-1 ring-white/10 overflow-hidden">

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pt-5 pb-0">
          {(["welcome","nextcloud","appearance"] as Step[]).map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full transition-all",
              step === s ? "bg-indigo-400" :
              ["welcome","nextcloud","appearance"].indexOf(step) > i ? "bg-indigo-700" : "bg-white/10"
            )} />
          ))}
        </div>

        <div className="p-6 space-y-5">

          {/* ── Welcome ── */}
          {step === "welcome" && (
            <>
              <div className="text-center space-y-2 py-4">
                <div className="text-5xl mb-3">👋</div>
                <h2 className="text-xl font-bold text-white">Welcome to Nextcloud Linux Workspace</h2>
                <p className="text-sm text-white/50">Let's get your workspace set up in two quick steps.</p>
              </div>
              <button onClick={() => setStep("nextcloud")}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
                Get started →
              </button>
            </>
          )}

          {/* ── Nextcloud connect ── */}
          {step === "nextcloud" && (
            <>
              <div className="flex items-start gap-3">
                <Cloud className="h-6 w-6 shrink-0 text-indigo-400 mt-0.5" />
                <div>
                  <h2 className="font-bold text-white">Connect Nextcloud</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Your files will be mounted inside every desktop session.
                  </p>
                </div>
              </div>

              {flowState === "idle" || flowState === "starting" || flowState === "error" ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Nextcloud URL</label>
                    <input
                      value={ncUrl}
                      onChange={(e) => setNcUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && startFlow()}
                      placeholder="https://cloud.example.com"
                      className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 ring-1 ring-white/10 outline-none focus:ring-indigo-500"
                    />
                  </div>
                  {flowState === "error" && (
                    <p className="flex items-center gap-1.5 text-sm text-red-400">
                      <XCircle className="h-4 w-4" /> {flowErr}
                    </p>
                  )}
                  <button
                    onClick={startFlow}
                    disabled={!ncUrl.trim() || flowState === "starting"}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                  >
                    {flowState === "starting"
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</>
                      : <><ExternalLink className="h-4 w-4" /> Sign in with Nextcloud</>}
                  </button>
                </div>
              ) : flowState === "waiting" ? (
                <div className="rounded-xl bg-white/5 p-4 text-center space-y-2">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400 mx-auto" />
                  <p className="text-sm text-white/70">Waiting for you to complete login in the popup…</p>
                  <button onClick={() => { stopPoll(); setFlowState("idle"); }}
                    className="text-xs text-white/30 hover:text-white/60 underline">Cancel</button>
                </div>
              ) : (
                <div className="rounded-xl bg-green-900/30 ring-1 ring-green-700/40 p-4 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-300">Connected!</p>
                    <p className="text-xs text-green-500">Logged in as <strong>{flowUsername}</strong></p>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep("welcome")}
                  className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-white/50 hover:text-white hover:border-white/20">
                  Back
                </button>
                <button onClick={() => setStep("appearance")}
                  className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                  {flowState === "success" ? "Next →" : "Skip →"}
                </button>
              </div>
            </>
          )}

          {/* ── Appearance ── */}
          {step === "appearance" && (
            <>
              <div className="flex items-start gap-3">
                <Palette className="h-6 w-6 shrink-0 text-indigo-400 mt-0.5" />
                <div>
                  <h2 className="font-bold text-white">Appearance</h2>
                  <p className="text-xs text-white/40 mt-0.5">Customise your desktop experience.</p>
                </div>
              </div>

              {/* Theme */}
              <div>
                <p className="mb-2 text-xs font-medium text-white/50">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {THEMES.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTheme(id)}
                      className={cn("flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs transition-all",
                        theme === id
                          ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                          : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                      )}>
                      <Icon className="h-5 w-5" />{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout */}
              <div>
                <p className="mb-2 text-xs font-medium text-white/50">Desktop layout</p>
                <div className="grid grid-cols-3 gap-2">
                  {LAYOUTS.map((l) => (
                    <button key={l.id} onClick={() => setDesktopLayout(l.id)}
                      className={cn("flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition-all",
                        desktopLayout === l.id
                          ? "border-indigo-500 bg-indigo-900/30 text-indigo-300"
                          : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                      )}>
                      <span className="text-lg">{l.icon}</span>
                      <span className="font-medium">{l.label}</span>
                      <span className="text-center leading-tight opacity-70">{l.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wallpaper */}
              <div>
                <p className="mb-2 text-xs font-medium text-white/50">Wallpaper</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((p) => (
                    <button key={p.value} onClick={() => setWallpaper(p.value)} title={p.label}
                      className={cn("group relative h-12 rounded-lg ring-2 transition-all overflow-hidden",
                        (wallpaper || PRESETS[0].value) === p.value
                          ? "ring-indigo-400 scale-95"
                          : "ring-transparent hover:ring-white/30"
                      )}
                      style={p.value.startsWith("#") ? { background: p.value } : { backgroundImage: p.value }}
                    >
                      <span className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep("nextcloud")}
                  className="flex-1 rounded-xl border border-white/10 py-2 text-sm text-white/50 hover:text-white hover:border-white/20">
                  Back
                </button>
                <button onClick={finish}
                  className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                  <LayoutGrid className="inline h-4 w-4 mr-1.5" />Start desktop
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
