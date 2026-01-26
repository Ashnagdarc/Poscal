import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "public",
      filename: "sw.js",
      // We'll register the service worker manually to avoid the auto-injected registerSW.js script being fetched repeatedly
      injectRegister: null,
      includeAssets: ["favicon.png", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Position Size Calculator",
        short_name: "Pos Size Calc",
        description: "A sleek forex and CFD position size calculator",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
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
        manualChunks: {
          // Separate React and React DOM
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Radix UI components (large library)
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-navigation-menu',
          ],
          // Charts library
          'charts': ['recharts'],
          // TanStack Query
          'data-libs': ['@tanstack/react-query'],
          // Form libraries
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Icons and utilities
          'utils': ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
