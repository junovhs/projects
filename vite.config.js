import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * Only these pages are served as static in dev (we inject CDN import maps for their bare imports).
 * Everything else—including JSX in .js files—goes through Vite + React plugin.
 */
const staticOnlyPages = [
  'cat.Optics & Design/video-play-button',
  'cat.TravelPerks/tp-brainstorm',
  'cat.Utilities/diranalyze'
]

function staticPagesPlugin () {
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

  const importMapHTML = `
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

        const relPath = decodeURIComponent(req.url.split('?')[0].replace(/^\/pages\//, '')).replace(/\/+$/, '')
        if (!staticOnlyPages.some(p => relPath.startsWith(p))) {
          return next() // let Vite transform it (so JSX in .js works)
        }

        // Serve static for the known-bare-import pages
        let abs = path.join(baseDir, relPath)
        try {
          const st = await fs.stat(abs)
          if (st.isDirectory()) abs = path.join(abs, 'index.html')
        } catch {
          if (req.url.endsWith('/')) abs = path.join(abs, 'index.html')
        }

        try {
          let data = await fs.readFile(abs)
          const ext = path.extname(abs).toLowerCase()
          let body = data

          if (ext === '.html') {
            let html = data.toString('utf8')
            // NEW: only inject our import map if the page doesn’t already define one
            const hasImportMap = /<script\s+type=["']importmap["']/.test(html)
            if (!hasImportMap) {
              html = html.includes('</head>')
                ? html.replace('</head>', `${importMapHTML}\n</head>`)
                : importMapHTML + '\n' + html
            }
            body = Buffer.from(html, 'utf8')
          }

          res.statusCode = 200
          res.setHeader('Content-Type', mime(ext))
          res.end(body)
        } catch {
          res.statusCode = 404
          res.end('Not found')
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [
    staticPagesPlugin(),
    // IMPORTANT: also transform JSX inside .js files
    react({
      // broaden the include so .js with JSX is handled
      include: [/\.jsx?$/, /\.tsx?$/],
      babel: { }
    })
  ],
  publicDir: 'public',
  // keep the app shell dep scan tight
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
  // help esbuild understand JSX in .js when it runs (belt+braces)
  esbuild: { jsx: 'automatic' },
  server: {
    hmr: { overlay: false },
    // NEW: in dev, send /api/* to your deployed Vercel domain (no CLI needed)
    proxy: {
      '/api': {
        target: 'https://lilapps.vercel.app',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: { rollupOptions: { input: 'index.html' } },
})
