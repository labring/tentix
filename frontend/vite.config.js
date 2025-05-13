import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
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
      "@lib": resolve(__dirname, "./src/lib"),
      "@server": resolve(__dirname, "../server"),
      "@db": resolve(__dirname, "../server/db"),
      "@api": resolve(__dirname, "../server/api"),
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/ws": {
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
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom','@tanstack/react-router',
            '@tanstack/react-router-devtools',
            '@tanstack/router-plugin'],
          'tiptap-editor': [
            '@tiptap/extension-blockquote',
            '@tiptap/extension-bold',
            '@tiptap/extension-bullet-list',
            '@tiptap/extension-code',
            '@tiptap/extension-code-block',
            '@tiptap/extension-document',
            '@tiptap/extension-horizontal-rule',
            '@tiptap/extension-italic',
            '@tiptap/extension-ordered-list',
            '@tiptap/extension-paragraph',
            '@tiptap/extension-strike',
            '@tiptap/extension-text',
            '@tiptap/html'
          ],
          'ui-vendor': [
            'class-variance-authority',
            'clsx',
            'lucide-react',
            'tailwind-merge',
            'tailwindcss-animate',
            'tentix-ui'
          ]
        }
      }
    }
  }
});
