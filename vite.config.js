import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      // In development, forward API calls to the local backend.
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui/') || id.includes('/lucide-react/')) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
  }
});
