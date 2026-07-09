import { useState } from "react";
import { Rnd } from "react-rnd";
import {
  LayoutDashboard, LayoutGrid, Users, Monitor, Package, Settings, FileText, X,
} from "lucide-react";
import { useDesktopStore } from "@/store/desktop";
import { cn } from "@/lib/utils";

// Admin page components — imported directly (no router needed)
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminApps from "@/pages/admin/Apps";
import AdminUsers from "@/pages/admin/Users";
import AdminSessions from "@/pages/admin/Sessions";
import AdminSettings from "@/pages/admin/Settings";
import AuditLog from "@/pages/admin/AuditLog";
import ImageBuilder from "@/pages/admin/ImageBuilder";

type Page = "dashboard" | "apps" | "users" | "sessions" | "builds" | "audit" | "settings";

const NAV: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard",     icon: LayoutDashboard },
  { id: "apps",      label: "App Catalog",   icon: LayoutGrid },
  { id: "users",     label: "Users",         icon: Users },
  { id: "sessions",  label: "Sessions",      icon: Monitor },
  { id: "builds",    label: "Image Builder", icon: Package },
  { id: "audit",     label: "Audit Log",     icon: FileText },
  { id: "settings",  label: "Settings",      icon: Settings },
];

export function AdminWindow() {
  const { setAdminOpen } = useDesktopStore();
  const [page, setPage] = useState<Page>("dashboard");
  const TASKBAR_H = 48;

  return (
    <Rnd
      default={{ x: 80, y: 40, width: 1100, height: window.innerHeight - TASKBAR_H - 80 }}
      minWidth={800}
      minHeight={500}
      bounds="window"
      dragHandleClassName="admin-drag"
      style={{ zIndex: 8000, position: "fixed" }}
    >
      {/* Force dark mode inside the window */}
      <div className="dark flex h-full overflow-hidden rounded-xl border border-white/10 bg-gray-900 shadow-2xl">

        {/* Sidebar */}
        <div className="flex w-48 shrink-0 flex-col border-r border-white/10 bg-gray-950 pt-1">
          {/* Title bar / drag handle */}
          <div className="admin-drag flex h-10 cursor-move items-center gap-2 px-4">
            <span className="text-sm font-bold text-white">Admin</span>
            <button
              onClick={() => setAdminOpen(false)}
              className="ml-auto text-gray-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 px-2 py-2">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  page === id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-6 text-white">
          {page === "dashboard" && <AdminDashboard />}
          {page === "apps"      && <AdminApps />}
          {page === "users"     && <AdminUsers />}
          {page === "sessions"  && <AdminSessions />}
          {page === "builds"    && <ImageBuilder />}
          {page === "audit"     && <AuditLog />}
          {page === "settings"  && <AdminSettings />}
        </div>
      </div>
    </Rnd>
  );
}
