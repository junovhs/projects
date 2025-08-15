import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Treat /pages as static in dev: don't scan or watch them
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  optimizeDeps: {
    // Only scan the app shell
    entries: ['index.html', 'src/main.jsx'],
    // Skip any bare imports that live inside /pages mini-apps
    exclude: [
      'canvas-confetti',
      'html2canvas',
      'notificationSystem',
      'errorHandler',
      'fileEditor',
      'aiPatcher',
      'zipManager',
      'utils',
      'scaffoldImporter',
      'aiDebriefingAssistant',
      'confetti',
      'fileSystem'
    ],
  },
  server: {
    // Don't even watch changes under /pages
    watch: { ignored: ['**/pages/**'] },
  },
  build: {
    rollupOptions: { input: 'index.html' },
  },
})
