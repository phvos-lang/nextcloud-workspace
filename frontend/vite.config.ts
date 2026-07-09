import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Hosts allowed to reach the dev/preview server (Vite blocks unknown Host
// headers). Behind a k8s ingress the hostname varies, so default to allowing
// all; pin specific hosts with VITE_ALLOWED_HOSTS="a.example,b.example".
const allowedHosts = process.env.VITE_ALLOWED_HOSTS
  ? process.env.VITE_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean)
  : true;

export default defineConfig({
  plugins: [react()],
  // react-draggable (used by react-rnd) references process.env.NODE_ENV at runtime;
  // Vite doesn't polyfill process so we inject it manually.
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts,
    watch: { usePolling: true },
    proxy: {
      "/api": { target: "http://backend:8000", changeOrigin: true },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts,
  },
});
