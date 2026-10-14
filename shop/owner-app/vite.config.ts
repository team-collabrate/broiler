import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 5174 },
  preview: { port: 5174 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg", "icon-192.png", "icon-512.png", "icon-512-maskable.png"],
      manifest: {
        name: "Kumbakonam Dashboard",
        short_name: "KDash",
        // Stable identity separate from start_url, so the installed app
        // survives a future start_url change without counting as a new
        // install (PWABuilder flags a manifest with no id).
        id: "/",
        description: "Kumbakonam Cafe — sales dashboard & menu management",
        theme_color: "#FAFAF8",
        background_color: "#FAFAF8",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        // PNG icons alongside the SVG — Android/TWA packaging (PWABuilder)
        // needs real raster icons at these sizes; it doesn't accept an
        // SVG-only manifest. See scripts/prepare-pwa-icons.mjs.
        icons: [
          { src: "pwa-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // `png` covers the brand logo on the lock screen — without it cached,
        // reopening the installed app offline would show a logo-less PIN
        // screen (the img hides itself on error rather than showing a broken
        // glyph, so the failure would be silent).
        globPatterns: ["**/*.{js,css,html,svg,png}"],
      },
    }),
  ],
});
