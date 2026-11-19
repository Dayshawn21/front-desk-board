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
    // Watch a run in installed Edge (on Windows, Application Control can block
    // the downloaded Chromium's visible browser; headless runs aren't affected):
    //   $env:PW_CHANNEL = 'msedge'; $env:SLOWMO = '600'; npx playwright test --headed --workers=1
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 0) },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || undefined,
      },
    },
    // The accessibility checks again with the device set to dark. The app's
    // default theme follows the device, so every screen renders dark, and
    // axe re-checks colour contrast there.
    {
      name: 'chromium-dark',
      testMatch: '**/a11y.e2e.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || undefined,
        colorScheme: 'dark',
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
