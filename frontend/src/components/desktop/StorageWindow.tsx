import { HardDrive, X } from "lucide-react";
import { Rnd } from "react-rnd";
import { useDesktopStore } from "@/store/desktop";
import Storage from "@/pages/Storage";

export function StorageWindow() {
  const { setStorageOpen } = useDesktopStore();
  const TASKBAR_H = 48;

  return (
    <Rnd
      default={{ x: 120, y: 60, width: 860, height: window.innerHeight - TASKBAR_H - 120 }}
      minWidth={600}
      minHeight={400}
      bounds={{ top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight - TASKBAR_H } as any}
      dragHandleClassName="storage-drag"
      style={{ zIndex: 8000, position: "fixed" }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
        {/* Title bar */}
        <div className="storage-drag flex h-10 shrink-0 cursor-move items-center gap-2 border-b border-gray-200 px-4 dark:border-white/10">
          <HardDrive className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Files &amp; Storage</span>
          <button
            onClick={() => setStorageOpen(false)}
            className="ml-auto text-gray-400 hover:text-gray-900 transition-colors dark:text-gray-500 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto text-gray-900 dark:text-white">
          <Storage />
        </div>
      </div>
    </Rnd>
  );
}
