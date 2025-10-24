import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel project URL for API proxying during local development.
// CHANGE THIS if your project URL is different.
const VERCEL_PROJECT_URL = 'https://lilapps.vercel.app';

export default defineConfig({
  plugins: [
    react(),
  ],
  publicDir: 'public',
  server: {
    // Proxy API requests to your live Vercel deployment.
    // This avoids needing to run 'vercel dev' locally.
    proxy: {
      '/api': {
        target: VERCEL_PROJECT_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});