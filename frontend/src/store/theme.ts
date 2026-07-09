import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      dark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      toggle: () => {
        const next = !get().dark;
        document.documentElement.classList.toggle("dark", next);
        set({ dark: next });
      },
    }),
    { name: "lwp-theme" }
  )
);

// Apply on load
const dark = JSON.parse(localStorage.getItem("lwp-theme") || "{}").state?.dark
  ?? window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", dark);
