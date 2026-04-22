import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: [
      'use-sync-external-store',
      'use-sync-external-store/shim/with-selector',
      'zustand/traditional',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'use-sync-external-store/shim/with-selector.js': path.resolve(__dirname, './node_modules/use-sync-external-store/shim/with-selector.js'),
      'use-sync-external-store/shim/with-selector': path.resolve(__dirname, './node_modules/use-sync-external-store/shim/with-selector.js'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3002',
        ws: true,
      },
    },
  },
});
