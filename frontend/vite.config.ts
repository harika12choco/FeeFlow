import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend base URL is configurable via VITE_API_BASE (see .env).
// A dev proxy forwards /api -> backend so no CORS issues in development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:8077",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
