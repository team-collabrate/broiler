import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  server: { port: 3000 },
  preview: { port: 3000 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-512-maskable.png"],
      manifest: {
        // Requested explicitly, replacing "Kumbakonam POS" — this is the
        // name shown under the home-screen icon and in the Android app
        // packaging (PWABuilder/TWA) flow.
        name: "Broiler POS",
        short_name: "Broiler",
        // Stable identity separate from start_url, so the installed app
        // survives a future start_url change without counting as a new
        // install (PWABuilder flags a manifest with no id).
        id: "/",
        description: "Broiler chicken and mutton shop: counter billing",
        theme_color: "#D71920",
        background_color: "#FFFAF2",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        // PNG icons alongside the SVG — Android/TWA packaging (PWABuilder)
        // needs real raster icons at these sizes; it doesn't accept an
        // SVG-only manifest. See scripts/prepare-pwa-icons.mjs.
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only — order/menu data goes through Firestore's own
        // offline cache (TDD §3/§4), not the service worker.
        //
        // `png` is here for the receipt logo specifically. It's fetched at
        // print time, so without it precached the first bill printed on a
        // dropped connection would come out logo-less — and silently, since
        // a logo that won't load degrades to a text-only receipt by design.
        //
        // Product photos shipped in the app (public/items, public/categories) are precached too, so the grid
        // is complete with no signal.
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}"],
        // A photo the owner links from an image host (an https link in a product's image field) is kept after the
        // first time it is shown, so that product also keeps its picture offline.
        runtimeCaching: [
          {
            urlPattern: ({ request, url }: { request: Request; url: URL }) => request.destination === "image" && url.origin !== self.location.origin,
            handler: "CacheFirst",
            options: {
              cacheName: "linked-product-photos",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
