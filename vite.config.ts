/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// In dev, serve the Vercel function in api/parse-booking.ts from the Vite
// server, so `npm run dev` works without the Vercel CLI. Same handler file
// in both places; on Vercel this plugin isn't used.
function devApiRoutes(): Plugin {
  return {
    name: 'dev-api-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/parse-booking', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) {
          if (typeof value === 'string') headers.set(key, value)
        }
        const request = new Request(`http://localhost${req.originalUrl}`, {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks),
        })

        const route = await server.ssrLoadModule('/api/parse-booking.ts')
        const response: Response = await route.POST(request)

        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-only secrets for the dev API route, read from .env.local.
  // They go into this Node process only; Vite bundles just VITE_* vars into
  // the browser code, so the key never reaches the page.
  const env = loadEnv(mode, process.cwd(), '')
  for (const name of ['ANTHROPIC_API_KEY', 'CLAUDE_MODEL']) {
    if (env[name] && !process.env[name]) process.env[name] = env[name]
  }

  return {
    plugins: [react(), tailwindcss(), devApiRoutes()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // jsdom typing tests can pass 5 s when the machine is busy (all test
      // files run in parallel); 10 s keeps them from failing at random.
      testTimeout: 10_000,
    },
  }
})
