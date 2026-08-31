import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: false
  },
  server: {
    // Dev server runs on 5173 by default; override with VITE_DEV_PORT if needed.
    // strictPort keeps the port predictable so the backend CORS origin stays valid.
    port: Number(process.env.VITE_DEV_PORT) || 5173,
    strictPort: true
  }
});
