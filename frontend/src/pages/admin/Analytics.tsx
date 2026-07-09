import { useQuery } from "@tanstack/react-query";
import client from "@/api/client";
import { cn } from "@/lib/utils";

interface AppStat {
  name: string;
  icon_url: string | null;
  total: number;
  active: number;
  avg_duration_min: number;
}

interface UserStat {
  display_name: string;
  username: string;
  total: number;
  active: number;
}

interface Analytics {
  by_app: AppStat[];
  by_user: UserStat[];
  total_session_hours: number;
}

function Badge({ n, green }: { n: number; green?: boolean }) {
  if (!n) return null;
  return (
    <span className={cn(
      "ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
      green ? "bg-green-500/20 text-green-400" : "bg-indigo-500/20 text-indigo-400",
    )}>
      {n}
    </span>
  );
}

export default function Analytics() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["admin", "analytics"],
    queryFn: () => client.get("/api/admin/stats/analytics").then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const maxTotal = Math.max(1, ...(data?.by_app.map((a) => a.total) ?? []));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Analytics</h1>

      <div className="mb-6 flex gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl font-bold">{data?.total_session_hours ?? 0}h</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total session time</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl font-bold">{data?.by_app.reduce((s, a) => s + a.total, 0) ?? 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total sessions</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-2xl font-bold text-green-500">{data?.by_app.reduce((s, a) => s + a.active, 0) ?? 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Active right now</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per-app */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Sessions by app</h2>
          <div className="space-y-3">
            {data?.by_app.map((app) => (
              <div key={app.name}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  {app.icon_url && <img src={app.icon_url} alt="" className="h-4 w-4 object-contain" />}
                  <span className="flex-1 truncate font-medium">{app.name}</span>
                  <span className="text-xs text-gray-500">{app.avg_duration_min}m avg</span>
                  <span className="text-xs font-semibold">{app.total}</span>
                  {app.active > 0 && <Badge n={app.active} green />}
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(app.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!data?.by_app.length && (
              <div className="py-8 text-center text-sm text-gray-400">No session data yet</div>
            )}
          </div>
        </div>

        {/* Per-user */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Top users</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                <th className="pb-2 text-left font-medium">User</th>
                <th className="pb-2 text-right font-medium">Sessions</th>
                <th className="pb-2 text-right font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {data?.by_user.map((u) => (
                <tr key={u.username} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-2 text-left">
                    <div className="font-medium">{u.display_name}</div>
                    <div className="text-xs text-gray-400">@{u.username}</div>
                  </td>
                  <td className="py-2 text-right font-semibold">{u.total}</td>
                  <td className="py-2 text-right">
                    {u.active > 0
                      ? <span className="font-semibold text-green-500">{u.active}</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
              {!data?.by_user.length && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-400">No data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
