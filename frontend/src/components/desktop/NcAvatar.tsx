import { useState } from "react";

/** Nextcloud avatar with graceful fallback to initials when NC has none/isn't set. */
export function NcAvatar({ name, size = 28, className = "" }: { name?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?")[0]?.toUpperCase() ?? "?";

  if (failed) {
    return (
      <span
        className={"flex shrink-0 items-center justify-center rounded-full bg-indigo-500/30 font-semibold text-indigo-200 " + className}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {initial}
      </span>
    );
  }
  return (
    <img
      src={`/api/nextcloud/avatar?size=${size * 2}`}
      alt=""
      onError={() => setFailed(true)}
      className={"shrink-0 rounded-full object-cover " + className}
      style={{ width: size, height: size }}
    />
  );
}
