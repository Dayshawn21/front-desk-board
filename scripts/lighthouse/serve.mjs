// Serves the production build (dist/) the way Vercel does, for Lighthouse.
// `vite preview` answers every path with index.html, so /robots.txt came
// back as HTML and Lighthouse's robots.txt audit failed; and it has no API
// routes, so the sign-in gate's request logged a 404. Here, like on Vercel:
//   - files in dist/ are served as they are;
//   - "/" and the paths vercel.json rewrites get index.html;
//   - POST /api/patient-sign-in answers 204, as the route does under its limit;
//   - anything else is a plain 404.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.json': 'application/json',
}

// The page paths vercel.json sends to index.html (plus "/").
const isPagePath = (p) =>
  p === '/' ||
  p === '/book' ||
  p.startsWith('/book/') ||
  p.startsWith('/check-in/') ||
  p === '/patient' ||
  p.startsWith('/patient/')

export function serve(distDir, port = 0) {
  const root = path.resolve(distDir)
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost')
    if (pathname === '/api/patient-sign-in' && req.method === 'POST') {
      res.writeHead(204).end()
      return
    }
    const file = path.join(root, decodeURIComponent(pathname))
    if (file.startsWith(root + path.sep)) {
      try {
        if ((await stat(file)).isFile()) {
          const type = TYPES[path.extname(file)] ?? 'application/octet-stream'
          res.writeHead(200, { 'content-type': type })
          res.end(await readFile(file))
          return
        }
      } catch {
        // not a file: fall through
      }
    }
    if (isPagePath(pathname)) {
      res.writeHead(200, { 'content-type': TYPES['.html'] })
      res.end(await readFile(path.join(root, 'index.html')))
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((r) => server.close(r)),
      })
    })
  })
}
