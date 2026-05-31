import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Loại bỏ console.*/debugger CHỈ ở bản production (giữ log khi dev).
  esbuild: mode === "production" ? { drop: ["console", "debugger"] } : {},
  build: {
    // Tách vendor chunks để cache tốt hơn + tránh bundle 1 file khổng lồ
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Animation libs (nặng nhất)
          "vendor-motion": ["framer-motion", "motion", "gsap"],
          // HTTP + UI util
          "vendor-misc": [
            "axios",
            "react-hot-toast",
            "react-icons",
            "react-markdown",
            "styled-components",
            "lucide-react",
          ],
        },
      },
    },
  },
}));
