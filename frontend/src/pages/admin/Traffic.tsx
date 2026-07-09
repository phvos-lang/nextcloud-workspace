import { useQuery } from "@tanstack/react-query";
import { Activity, Users, LogIn, ShieldAlert } from "lucide-react";
import client from "@/api/client";

interface ActiveSession { user: string; app: string; web_native: boolean; status: string; started_at: string | null }
interface Traffic {
  active: ActiveSession[]; active_count: number; users_online: number;
  by_app: { app: string; count: number }[];
  auth_ok: number; auth_failed: number; sessions_24h: number;
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500"><Icon className="h-4 w-4" /> {label}</div>
      <div className={"mt-2 text-3xl font-bold " + (accent ?? "")}>{value}</div>
    </div>
  );
}

function since(ts: string | null): string {
  if (!ts) return "—";
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function Traffic() {
  const { data } = useQuery<Traffic>({
    queryKey: ["admin", "traffic"],
    queryFn: () => client.get("/api/admin/stats/traffic").then((r) => r.data),
    refetchInterval: 10_000,
  });
  if (!data) return <div className="text-sm text-gray-400">Loading…</div>;
  const maxApp = Math.max(1, ...data.by_app.map((b) => b.count));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Traffic</h1>
        <span className="flex items-center gap-1 text-xs text-green-500"><span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> live</span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={Activity} label="Active sessions" value={data.active_count} accent="text-indigo-500" />
        <Stat icon={Users} label="Users online" value={data.users_online} />
        <Stat icon={LogIn} label="Logins (24h)" value={data.auth_ok} accent="text-green-500" />
        <Stat icon={ShieldAlert} label="Failed logins (24h)" value={data.auth_failed} accent={data.auth_failed ? "text-red-500" : ""} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 font-semibold">Active by app</h2>
          {data.by_app.length === 0 ? <p className="text-sm text-gray-400">No active sessions.</p> : (
            <div className="space-y-2">
              {data.by_app.map((b) => (
                <div key={b.app} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-sm">{b.app}</span>
                  <div className="h-4 flex-1 rounded bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded bg-indigo-500" style={{ width: `${(b.count / maxApp) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-sm tabular-nums">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 font-semibold">Live sessions ({data.active.length})</h2>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-400">
                <tr><th className="pb-2">User</th><th className="pb-2">App</th><th className="pb-2">Status</th><th className="pb-2 text-right">Uptime</th></tr>
              </thead>
              <tbody>
                {data.active.map((s, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 truncate">{s.user}</td>
                    <td className="py-1.5">{s.app} {s.web_native && <span className="ml-1 rounded bg-teal-500/20 px-1 text-[10px] text-teal-500">web</span>}</td>
                    <td className="py-1.5">
                      <span className={"rounded-full px-2 py-0.5 text-xs " + (s.status === "running" ? "bg-green-500/15 text-green-500" : s.status === "suspended" ? "bg-amber-500/15 text-amber-500" : "bg-gray-500/15 text-gray-400")}>{s.status}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-400">{since(s.started_at)}</td>
                  </tr>
                ))}
                {data.active.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No active sessions.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
