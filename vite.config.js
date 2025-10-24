// projects/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel project URL is no longer needed here.

export default defineConfig({
  plugins: [
    react(),
  ],
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
});