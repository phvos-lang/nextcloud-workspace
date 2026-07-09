import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, RefreshCw, Search, X } from "lucide-react";
import client from "@/api/client";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  action: string;
  action_label: string;
  action_color: string;
  resource: string;
  detail: string;
  timestamp: string;
}

const PAGE = 100;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");            // debounced search actually sent
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: actions = [] } = useQuery<string[]>({
    queryKey: ["admin", "audit", "actions"],
    queryFn: () => client.get("/api/admin/audit/actions").then((r) => r.data),
    staleTime: 60_000,
  });

  const filterParams = {
    action: actionFilter || undefined,
    q: q || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  };

  const { data = [], isLoading, refetch, isFetching } = useQuery<AuditEntry[]>({
    queryKey: ["admin", "audit", actionFilter, q, dateFrom, dateTo, page],
    queryFn: () =>
      client.get("/api/admin/audit", {
        params: { ...filterParams, limit: PAGE, offset: page * PAGE },
      }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const exportCsv = () => {
    const params = new URLSearchParams();
    Object.entries(filterParams).forEach(([k, v]) => v && params.set(k, v));
    window.open(`/api/admin/audit/export?${params.toString()}`, "_blank");
  };

  const inputCls =
    "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            title="Export current view (filters applied, max 10k rows)"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search + date range */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user, action, resource, detail…"
            className={cn(inputCls, "w-72 pl-8")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className={inputCls}
          title="From date"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className={inputCls}
          title="To date (inclusive)"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => { setActionFilter(""); setPage(0); }}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            !actionFilter ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          All
        </button>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => { setActionFilter(a); setPage(0); }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              actionFilter === a
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-400">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-2.5">
                      <div className="h-3.5 animate-pulse rounded bg-gray-100 dark:bg-gray-800" style={{ width: `${60 + (i % 3) * 15}%` }} />
                    </td>
                  </tr>
                ))
              : data.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap" title={new Date(e.timestamp).toLocaleString()}>
                      {relTime(e.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-medium">{e.display_name}</span>
                      {e.display_name !== e.username && (
                        <span className="ml-1.5 text-xs text-gray-400">@{e.username}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800", e.action_color)}>
                        {e.action_label || e.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate" title={e.resource}>
                      {e.resource}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[240px] truncate font-mono" title={e.detail}>
                      {e.detail || "—"}
                    </td>
                  </tr>
                ))
            }
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                  No audit entries yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          ← Previous
        </button>
        <span className="text-sm text-gray-400">Page {page + 1}</span>
        <button
          disabled={data.length < PAGE}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Next →
        </button>
        {data.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            Showing {page * PAGE + 1}–{page * PAGE + data.length}
          </span>
        )}
      </div>
    </div>
  );
}
