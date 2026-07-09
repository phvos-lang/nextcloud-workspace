import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Monitor, Settings, ShieldCheck, Users,
  LogOut, Menu, X, Moon, Sun, BookOpen, Users2, HardDrive, BarChart2, Activity,
} from "lucide-react";
import { toast } from "sonner";
import client from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/",        icon: LayoutGrid, label: "Desktop" },
  { to: "/storage", icon: HardDrive,  label: "Storage" },
  { to: "/profile", icon: Users,      label: "Profile" },
];

const adminItems = [
  { to: "/admin",          icon: ShieldCheck, label: "Dashboard" },
  { to: "/admin/users",    icon: Users,       label: "Users" },
  { to: "/admin/groups",   icon: Users2,      label: "Groups" },
  { to: "/admin/apps",     icon: LayoutGrid,  label: "App Catalog" },
  { to: "/admin/sessions", icon: Monitor,     label: "Sessions" },
  { to: "/admin/traffic",  icon: Activity,    label: "Traffic" },
  { to: "/admin/audit",      icon: BookOpen,  label: "Audit Log" },
  { to: "/admin/analytics",  icon: BarChart2, label: "Analytics" },
  { to: "/admin/settings",   icon: Settings,  label: "Settings" },
];

export default function AppShell() {
  const { user, setUser } = useAuthStore();
  const { dark, toggle: toggleTheme } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function logout() {
    await client.post("/api/auth/logout");
    setUser(null);
    toast.success("Signed out");
    navigate("/login");
  }

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const navLink = (to: string, icon: React.ElementType, label: string) => {
    const Icon = icon;
    return (
      <Link
        key={to}
        to={to}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive(to)
            ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        )}
      >
        <Icon className="h-4 w-4" />{label}
      </Link>
    );
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Monitor className="h-6 w-6 text-brand-500" />
        <span className="text-lg font-bold tracking-tight">Nextcloud Linux Workspace</span>
      </div>

      {navItems.map(({ to, icon, label }) => navLink(to, icon, label))}

      {user?.is_admin && (
        <>
          <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
          <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Admin</p>
          {adminItems.map(({ to, icon, label }) => navLink(to, icon, label))}
        </>
      )}

      <div className="mt-auto space-y-1 border-t border-gray-200 pt-4 dark:border-gray-700">
        <div className="mb-1 px-3 text-sm text-gray-500 truncate">{user?.display_name || user?.email}</div>

        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Light mode" : "Dark mode"}
        </button>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-56 z-50 bg-white dark:bg-gray-900">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex h-12 items-center gap-3 border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Monitor className="h-5 w-5 text-brand-500" />
          <span className="font-bold">Nextcloud Linux Workspace</span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
