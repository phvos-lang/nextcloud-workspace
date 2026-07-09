import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MonitorOff, Clock } from "lucide-react";
import client from "@/api/client";
import type { Session } from "@/types";
import { formatDuration } from "@/lib/utils";

export default function MySessions() {
  const qc = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: () => client.get("/api/sessions").then((r) => r.data),
    refetchInterval: 10_000,
  });

  const kill = useMutation({
    mutationFn: (id: string) => client.delete(`/api/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });

  if (isLoading) return <div className="animate-pulse text-gray-400">Loading…</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">My Sessions</h1>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-gray-400 dark:border-gray-700">
          <MonitorOff className="mb-3 h-10 w-10" />
          <p className="text-sm">No active sessions. Launch one from the Images page.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((sess) => (
            <div key={sess.id}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/20">
                  <span className="text-lg">🖥️</span>
                </div>
                <div>
                  <p className="font-medium">{sess.app_name ?? sess.app_id}</p>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3 w-3" /> {formatDuration(sess.started_at)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <a href={sess.connect_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <ExternalLink className="h-4 w-4" /> Connect
                </a>
                <button
                  onClick={() => { if (confirm("Stop this session?")) kill.mutate(sess.id); }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <MonitorOff className="h-4 w-4" /> Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
