// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Vercel compiles each .ts file in api/ (and what it imports) to its own .js
// file, without bundling, and keeps import paths as written. Node then needs
// real file extensions, so `import ... from '../server/handler'` crashes the
// function (this happened on the first deploy). This test does the same
// per-file compile and loads the route, so that can't come back unnoticed.

const ROUTE_FILES = [
  'api/parse-booking.ts',
  'server/handler.ts',
  'server/parseBooking.ts',
  'src/lib/assist.ts',
  'src/mocks/seed.ts',
  'src/config.ts',
  'src/types.ts',
]

// Compiles files one by one, like Vercel, into a fresh folder; returns it.
function compileLikeVercel(files: string[]): string {
  const root = resolve(__dirname, '..')
  // Inside node_modules so the compiled files can still find @anthropic-ai/sdk.
  const cache = join(root, 'node_modules', '.cache')
  mkdirSync(cache, { recursive: true })
  const out = mkdtempSync(join(cache, 'vercel-compile-'))

  for (const file of files) {
    const { outputText } = ts.transpileModule(
      readFileSync(join(root, file), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2023,
          verbatimModuleSyntax: true,
        },
      },
    )
    const dest = join(out, file.replace(/\.ts$/, '.js'))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, outputText)
  }
  writeFileSync(join(out, 'package.json'), '{"type":"module"}')
  return out
}

describe('api/parse-booking after a Vercel-style per-file compile', () => {
  it('loads and answers without bundling', async () => {
    const out = compileLikeVercel(ROUTE_FILES)

    // Load the compiled file with Node itself, not through Vite.
    const route = await import(
      /* @vite-ignore */ pathToFileURL(join(out, 'api/parse-booking.js')).href
    )
    const response: Response = await route.POST(
      new Request('http://localhost/api/parse-booking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ practiceId: 'nope', text: 'x' }),
      }),
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Unknown practice.' })
  })
})

describe('api/patient-sign-in after a Vercel-style per-file compile', () => {
  it('loads and answers without bundling', async () => {
    const out = compileLikeVercel([
      'api/patient-sign-in.ts',
      'server/signInGate.ts',
    ])
    const route = await import(
      /* @vite-ignore */ pathToFileURL(join(out, 'api/patient-sign-in.js')).href
    )
    const response: Response = await route.POST(
      new Request('http://localhost/api/patient-sign-in', {
        method: 'POST',
        headers: { 'x-real-ip': '203.0.113.7' },
      }),
    )
    expect(response.status).toBe(204)
  })
})
