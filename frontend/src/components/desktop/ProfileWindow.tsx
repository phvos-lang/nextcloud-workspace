import { UserCircle, X } from "lucide-react";
import { Rnd } from "react-rnd";
import { useDesktopStore } from "@/store/desktop";
import Profile from "@/pages/Profile";

export function ProfileWindow() {
  const { setProfileOpen } = useDesktopStore();
  const TASKBAR_H = 48;

  return (
    <Rnd
      default={{ x: 160, y: 60, width: 900, height: Math.min(window.innerHeight - TASKBAR_H - 120, 760) }}
      minWidth={700}
      minHeight={420}
      bounds="window"
      dragHandleClassName="profile-drag"
      style={{ zIndex: 8000, position: "fixed" }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
        {/* Title bar */}
        <div className="profile-drag flex h-10 shrink-0 cursor-move items-center gap-2 border-b border-gray-200 px-4 dark:border-white/10">
          <UserCircle className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Profile &amp; Preferences</span>
          <button
            onClick={() => setProfileOpen(false)}
            className="ml-auto text-gray-400 hover:text-gray-900 transition-colors dark:text-gray-500 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content — Profile brings its own sidebar + scroll area */}
        <div className="flex-1 min-h-0 overflow-hidden text-gray-900 dark:text-white">
          <Profile />
        </div>
      </div>
    </Rnd>
  );
}
