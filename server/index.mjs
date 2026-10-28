// Must stay first — ESM runs every import before the body, so a setGlobalDispatcher()
// call further down lands after ./routes/* have made their module-scope calls.
import './proxy-bootstrap.mjs'
// Second, before any ./routes/* read the key at module load: this applies
// /creds/creds.json onto process.env, so `process.env.TATUM_API_KEY` is set on
// the controller path (which delivers the key as a file, not an env var) and
// stays live across the rotation push. A no-op where the key is already in env.
import './credentials-store.mjs'
import express from 'express'
import { createServer as createHttpServer } from 'http'
import { fileURLToPath } from 'url'
import path from 'path'
import { existsSync } from 'fs'
import tatumRoutes from './routes/tatum.mjs'
import receiptsRoutes from './routes/receipts.mjs'
import predictionRoutes from './routes/prediction.mjs'
import x402Routes from './routes/x402.mjs'
import { credentialGuard } from './credential-guard.mjs'
import { ownerGuard, sessionInfo } from './owner.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

// Run from the project root. The preview-sidecar starts this server with CWD=/,
// but tooling that resolves paths from the CWD — notably Tailwind's `content`
// globs — must see the project files, or it silently generates no utilities
// (unstyled preview). `vite build` already runs from here; this makes dev match.
process.chdir(root)

const app = express()
app.disable('x-powered-by')
// Hosted behind one proxy (Render): req.ip should be the visitor, not the proxy.
app.set('trust proxy', 1)
app.use(express.json())

// Redact the server's keys and passcode from every response before it leaves the process.
app.use(credentialGuard)

// Public demo: visitors read, the owner (OWNER_PASSCODE) writes.
app.get('/api/session', sessionInfo)
app.use('/api', ownerGuard)

app.use('/api/tatum', tatumRoutes)
app.use('/api/prediction', predictionRoutes)
app.use('/api', x402Routes)
app.use('/api', receiptsRoutes)
app.use('/api', tatumRoutes)
// Unknown API paths get a JSON 404 instead of falling through to Vite's SPA
// fallback, which answers 200 with index.html and crashes the client's JSON reads.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }))

const server = createHttpServer(app)

// Hosted (NODE_ENV=production after `npm run build`): serve the built UI from
// dist/. Locally: Vite in middleware mode with hot reload.
const dist = path.join(root, 'dist')
if (process.env.NODE_ENV === 'production' && existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false }))
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
} else {
  // All Vite config is inline — no vite.config.js needed, no temp files written.
  // cacheDir points to /tmp so dep pre-bundling works on read-only node_modules mounts.
  const { createServer: createViteServer } = await import('vite')
  const { default: react } = await import('@vitejs/plugin-react')
  const vite = await createViteServer({
    root,
    configFile: false,
    cacheDir: '/tmp/vite',
    plugins: [react()],
    server: {
      middlewareMode: true,
      hmr: { server },
      // Allow any Host — the preview is served on a per-project subdomain this file
      // cannot know. Must be the boolean `true` or an array; the string 'all' is
      // iterated per-character and silently blocks everything (no warning, no error).
      // NB: Vite's 403 body says to add the host to vite.config.js — that does not apply
      // here, `configFile: false` means any vite.config.js is silently ignored.
      allowedHosts: true,
    },
    appType: 'spa',
  })
  app.use(vite.middlewares)
}

const port = process.env.PORT ?? 3000
server.listen(port, () => {
  console.log(`preview-sidecar listening on :${port}`)
})
