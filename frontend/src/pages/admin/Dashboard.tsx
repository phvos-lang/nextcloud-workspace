import { useQuery } from "@tanstack/react-query";
import { Monitor, Users, LayoutGrid, Activity } from "lucide-react";
import client from "@/api/client";
import type { AdminSession } from "@/types";

interface Stats {
  active_sessions: number;
  users_online: number;
  total_users: number;
  total_apps: number;
}

export default function AdminDashboard() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: () => client.get("/api/admin/stats").then((r) => r.data),
    refetchInterval: 15_000,
  });

  const { data: sessions = [] } = useQuery<AdminSession[]>({
    queryKey: ["admin", "sessions"],
    queryFn: () => client.get("/api/admin/sessions").then((r) => r.data),
    refetchInterval: 15_000,
  });

  const statCards = [
    { label: "Active Sessions", value: stats?.active_sessions ?? "—", icon: Monitor, color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20" },
    { label: "Users Online",    value: stats?.users_online ?? "—",    icon: Users,   color: "text-green-500 bg-green-50 dark:bg-green-900/20" },
    { label: "Total Users",     value: stats?.total_users ?? "—",     icon: Activity, color: "text-purple-500 bg-purple-50 dark:bg-purple-900/20" },
    { label: "Active Apps",      value: stats?.total_apps    ?? "—",    icon: LayoutGrid, color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className={`rounded-xl p-3 ${color}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Live Sessions</h2>
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["User", "Pod", "Status", "Started"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sessions.map((s) => (
              <tr key={s.id} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-mono text-xs">{s.user_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-mono text-xs">{s.pod_name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === "running" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-yellow-100 text-yellow-700"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(s.started_at).toLocaleTimeString()}</td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No active sessions</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
