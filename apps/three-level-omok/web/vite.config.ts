import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/threemok/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3100", "/threemok/socket.io": { target: "http://localhost:3100", ws: true } },
  },
});
