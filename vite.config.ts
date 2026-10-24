import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Served from https://<user>.github.io/gym-tracker/
const base = "/gym-tracker/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // New versions wait until the app tells them to take over (see spec: no updates mid-session).
      registerType: "prompt",
      // The workbox glob below already precaches every icon in public/.
      includeManifestIcons: false,
      manifest: {
        name: "Gym Tracker",
        short_name: "Gym",
        description: "Track exercises, weights and reps at the gym.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        background_color: "#1f2937",
        theme_color: "#1f2937",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
      },
    }),
  ],
});
