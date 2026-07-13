import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
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

          if (id.includes('/node_modules/recharts/')) {
            return 'charts';
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
