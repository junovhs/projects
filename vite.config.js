import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

function staticPagesPlugin() {
  // serve /pages/** as raw static files (no Vite transforms)
  const root = process.cwd()
  const baseDir = path.resolve(root, 'pages')

  const mime = (ext) => ({
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon',
    '.wasm': 'application/wasm',
    '.txt':  'text/plain; charset=utf-8',
  }[ext] || 'application/octet-stream')

  const importMap = `
    <script type="importmap">
    {
      "imports": {
        "canvas-confetti": "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.module.mjs",
        "html2canvas":     "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js",
        "confetti":        "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.module.mjs"
      }
    }
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/es-module-shims@1.10.0/dist/es-module-shims.min.js"></script>
  `

  return {
    name: 'static-pages',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/pages/')) return next()

        // strip query/hash
        const rawUrl = req.url.split('?')[0].split('#')[0]
        let rel = decodeURIComponent(rawUrl.replace(/^\/pages\//, ''))
        let abs = path.join(baseDir, rel)

        // if directory or path ends with '/', default to index.html
        try {
          const st = await fs.stat(abs)
          if (st.isDirectory()) abs = path.join(abs, 'index.html')
        } catch {
          if (rawUrl.endsWith('/')) abs = path.join(abs, 'index.html')
        }

        try {
          let data = await fs.readFile(abs)
          const ext = path.extname(abs).toLowerCase()
          let body = data

          // on HTML: inject an import map so bare imports (confetti/html2canvas) resolve
          if (ext === '.html') {
            let html = data.toString('utf8')
            if (html.includes('</head>')) {
              html = html.replace('</head>', `${importMap}\n</head>`)
            } else {
              html = importMap + '\n' + html
            }
            body = Buffer.from(html, 'utf8')
          }

          res.statusCode = 200
          res.setHeader('Content-Type', mime(ext))
          res.end(body)
          return
        } catch {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Not found')
          return
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    // NOTE: our static-pages plugin runs first so Vite never touches /pages/**
    staticPagesPlugin(),
    react(),
  ],
  publicDir: 'public',
  // keep the shell lean; don't scan /pages in dev
  optimizeDeps: {
    entries: ['index.html', 'src/main.jsx'],
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
    // disable the scary overlay; errors will go to console instead
    hmr: { overlay: false },
    // don't watch /pages for performance/noise
    watch: { ignored: ['**/pages/**'] },
  },
  build: { rollupOptions: { input: 'index.html' } },
})
