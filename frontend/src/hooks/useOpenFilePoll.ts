import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { useDesktopStore } from "@/store/desktop";
import client from "@/api/client";

/** Poll /api/sessions/open-file/poll every 3 s; open file manager when container fires xdg-open. */
export function useOpenFilePoll() {
  const { user } = useAuthStore();
  const { setFileManagerOpen } = useDesktopStore();

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      try {
        const res = await client.get<{ events: { path: string; mime: string }[] }>(
          "/api/sessions/open-file/poll"
        );
        for (const ev of res.data.events ?? []) {
          // Map path from container filesystem to NC rclone path
          // e.g. /home/lwp/Files/Documents/foo.pdf → /Documents/foo.pdf
          const ncPath = ev.path.replace(/^\/home\/lwp\/Files/, "") || ev.path;
          setFileManagerOpen(true, ncPath);
        }
      } catch {
        // ignore — user may not have an active session
      }
    };

    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [user?.id, setFileManagerOpen]);
}
