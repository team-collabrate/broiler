import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 3003 },
  preview: { port: 3003 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-512-maskable.png"],
      manifest: {
        name: "Honey Broilers Owner",
        short_name: "HB Owner",
        // Stable identity separate from start_url, so the installed app survives a future start_url change.
        id: "/",
        description: "Honey Broilers: sales, bills and credit for the owner",
        theme_color: "#D71920",
        background_color: "#FFFAF2",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The app shell only. Sales figures always come from the server (a fetch on opening and on Refresh), and the
        // service worker never answers a Firestore request, so the owner never sees yesterday's numbers as today's.
        globPatterns: ["**/*.{js,css,html,svg,png}"],
      },
    }),
  ],
});
