import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        loading: {
          "0%":   { transform: "translateX(-100%)" },
          "50%":  { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" },
        },
        windowOpen: {
          "0%":   { opacity: "0", transform: "scale(0.94) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        minimizeOut: {
          "0%":   { opacity: "1", transform: "scale(1) translateY(0)" },
          "100%": { opacity: "0", transform: "scale(0.08) translateY(120px)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        loading:        "loading 1.5s ease-in-out infinite",
        "window-open":  "windowOpen 0.18s cubic-bezier(0.34,1.4,0.64,1) forwards",
        "minimize-out": "minimizeOut 0.2s cubic-bezier(0.4,0,1,1) forwards",
        "fade-in":      "fadeIn 0.15s ease-out forwards",
      },
      colors: {
        brand: {
          50:  "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
