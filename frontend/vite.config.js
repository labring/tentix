import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  optimizeDeps: {
    // exclude: ["tentix-ui"],
  },
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@frontend": resolve(__dirname, "./src"),
      "@comp": resolve(__dirname, "./src/components"),
      "@store": resolve(__dirname, "./src/store"),
      "@hook": resolve(__dirname, "./src/hooks"),
      "@lib": resolve(__dirname, "./src/lib"),
      "@modal": resolve(__dirname, "./src/modal"),
      "@server": resolve(__dirname, "../server"),
      "@db": resolve(__dirname, "../server/db"),
      "@api": resolve(__dirname, "../server/api"),
      "tentix-ui": resolve(__dirname, "../packages/ui"),
      "src": [resolve(__dirname, "./src")],
      "@ui": resolve(__dirname, "../packages/ui/src"),
    },
  },
  server: {
    proxy: {
      "/api/ws/chat": {
        target: "ws://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    sourcemap: false,
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('tailwindcss')) {
              return 'vendor-tailwind';
            }
            return 'vendor';
          }
          if (id.includes('packages/ui')) {
            return 'tentix-ui';
          }
          // Default: let Vite handle other chunks
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/styles-[hash].css';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    cssCodeSplit: false,
    cssMinify: true,
    assetsInlineLimit: 10240,
    reportCompressedSize: true,
  }
});
