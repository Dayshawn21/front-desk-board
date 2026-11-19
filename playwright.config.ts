import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run in a real browser against the production build
// (vite preview), not the dev server. They never call the AI route.
const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // not *.test.ts, so Vitest doesn't pick these up
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
