import { useEffect, useState } from "react";
import type { LaunchInfo } from "@/store/desktop";

interface Props {
  info: LaunchInfo;
}

export function LaunchPanel({ info }: Props) {
  const [dots, setDots] = useState(".");

  // Animated dots: . → .. → ...
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 500);
    return () => clearInterval(id);
  }, []);

  const isEmoji = !info.appIcon.startsWith("http");

  return (
    <div className="pointer-events-none fixed inset-0 z-[9000] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative flex flex-col items-center gap-5 rounded-2xl bg-black/70 px-10 py-8 ring-1 ring-white/10 shadow-2xl">
        {/* Icon */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
          <span className="absolute inset-0 rounded-2xl border-2 border-white/30 animate-ping" />
          {isEmoji ? (
            <span className="text-5xl">{info.appIcon}</span>
          ) : (
            <img
              src={info.appIcon}
              alt=""
              className="h-14 w-14 object-contain drop-shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{info.appName}</p>
          <p className="mt-1 text-sm text-white/50">
            Starting{dots}
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full origin-left animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-indigo-400" />
        </div>
      </div>
    </div>
  );
}
