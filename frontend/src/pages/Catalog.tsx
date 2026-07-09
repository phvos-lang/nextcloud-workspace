import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, Play, Search, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import client from "@/api/client";
import type { App, Session } from "@/types";
import { cn } from "@/lib/utils";
import { LaunchDialog } from "@/components/LaunchDialog";

export default function Catalog() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [launchApp, setLaunchApp] = useState<App | null>(null);

  const { data: apps = [], isLoading } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: () => client.get("/api/apps").then((r) => r.data),
  });

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn: () => client.get("/api/sessions").then((r) => r.data),
    refetchInterval: 10_000,
  });

  const categories = [...new Set(apps.map((a) => a.category))].sort();
  const activeSessionByApp = Object.fromEntries(sessions.map((s) => [s.app_id, s]));

  const filtered = apps.filter((app) => {
    const matchSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "All" || app.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Desktop Apps</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps…"
            className="rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        {["All", ...categories].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeCategory === cat
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => {
            const activeSession = activeSessionByApp[app.id];

            return (
              <div
                key={app.id}
                className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
              >
                {activeSession && (
                  <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                    Running
                  </span>
                )}

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
                  {app.icon_url ? (
                    <img
                      src={app.icon_url}
                      alt=""
                      className="h-8 w-8 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="text-xl">🖥️</span>
                  )}
                </div>

                <h3 className="mb-1 font-semibold">{app.name}</h3>
                <p className="mb-4 flex-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {app.description}
                </p>

                <div className="mb-4 flex gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{app.cpu_limit}</span>
                  <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" />{app.mem_limit}</span>
                </div>

                {activeSession ? (
                  <button
                    onClick={() => navigate(`/session/${activeSession.session_token}`)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-600 py-2 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/20"
                  >
                    <ExternalLink className="h-4 w-4" /> Connect
                  </button>
                ) : (
                  <button
                    onClick={() => setLaunchApp(app)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                  >
                    <Play className="h-4 w-4" /> Launch
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {launchApp && (
        <LaunchDialog image={launchApp} onClose={() => setLaunchApp(null)} />
      )}
    </div>
  );
}
