import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      // We'll register the service worker manually to avoid the auto-injected registerSW.js script being fetched repeatedly
      injectRegister: null,
      includeAssets: ["favicon.png", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        id: "/",
        name: "Poscal",
        short_name: "Poscal",
        description: "Forex and CFD position sizing, signals, and trading journal tools.",
        lang: "en",
        dir: "ltr",
        categories: ["finance", "productivity", "utilities"],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        shortcuts: [
          {
            name: "Calculator",
            short_name: "Calc",
            description: "Open the position size calculator.",
            url: "/",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Signals",
            short_name: "Signals",
            description: "Open trading signals.",
            url: "/signals",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Journal",
            short_name: "Journal",
            description: "Open the trading journal.",
            url: "/journal",
            icons: [{ src: "pwa-192x192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react-router-dom/')) {
            return 'react-vendor';
          }

          if (id.includes('/node_modules/@radix-ui/')) {
            return 'radix-ui';
          }

          if (id.includes('/node_modules/@tanstack/react-query/')) {
            return 'data-libs';
          }

          if (id.includes('/node_modules/react-hook-form/') || id.includes('/node_modules/@hookform/resolvers/') || id.includes('/node_modules/zod/')) {
            return 'forms';
          }

          if (id.includes('/node_modules/lucide-react/') || id.includes('/node_modules/date-fns/') || id.includes('/node_modules/clsx/') || id.includes('/node_modules/tailwind-merge/')) {
            return 'utils';
          }

          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
