import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import client from "@/api/client";

interface Status {
  announcement: string;
  announcement_level: string;
  maintenance: boolean;
  maintenance_message: string;
  broadcast: string;
  broadcast_level: string;
  broadcast_ts: string;
}

export function SystemBanner() {
  const { data } = useQuery<Status>({
    queryKey: ["system-status"],
    queryFn: () => client.get("/api/system/status").then((r) => r.data),
    refetchInterval: 20_000,
  });
  const [dismissed, setDismissed] = useState<string>(() => sessionStorage.getItem("lwp_ann_dismissed") || "");

  // One-shot admin broadcast: toast whenever broadcast_ts changes. localStorage
  // keeps a reload from re-toasting an already-seen message.
  useEffect(() => {
    if (!data?.broadcast || !data.broadcast_ts) return;
    if (localStorage.getItem("lwp_broadcast_seen") === data.broadcast_ts) return;
    localStorage.setItem("lwp_broadcast_seen", data.broadcast_ts);
    const opts = { duration: 30_000, description: "Message from your administrator" };
    if (data.broadcast_level === "critical") toast.error(data.broadcast, opts);
    else if (data.broadcast_level === "warning") toast.warning(data.broadcast, opts);
    else toast.info(data.broadcast, opts);
  }, [data?.broadcast_ts]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  const showAnn = !!data.announcement && dismissed !== data.announcement;
  if (!showAnn && !data.maintenance) return null;

  const annColor =
    data.announcement_level === "critical" ? "bg-red-600" :
    data.announcement_level === "warning"  ? "bg-amber-600" :
                                             "bg-indigo-600";

  const dismiss = () => {
    sessionStorage.setItem("lwp_ann_dismissed", data.announcement);
    setDismissed(data.announcement);
  };

  return (
    <div className="fixed left-0 right-0 top-0 z-[9500] flex flex-col text-white">
      {data.maintenance && (
        <div className="flex items-center justify-center gap-2 bg-amber-700 px-4 py-1.5 text-xs font-medium">
          <Wrench className="h-3.5 w-3.5 shrink-0" />
          {data.maintenance_message || "Maintenance in progress — starting new sessions is temporarily disabled."}
        </div>
      )}
      {showAnn && (
        <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium ${annColor}`}>
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{data.announcement}</span>
          <button onClick={dismiss} className="ml-1 shrink-0 opacity-70 hover:opacity-100" title="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
