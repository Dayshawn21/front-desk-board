// Lighthouse on the production build: Accessibility, Best Practices and SEO
// must all be 100. Performance isn't checked here: on a shared CI machine it
// says more about the machine than the app (see docs/PERFORMANCE.md).
//
// It audits, in light and dark, on a phone and a desktop:
//   - the signed-out pages, as they load;
//   - the board and the signed-in patient pages, signed in as the demo users;
//   - the board's states: the Patient flow tab, each drawer, dialog and menu,
//     and the error screen (snapshots of the page as it is, not as it loads);
//   - the password-reset flow, which needs a token from the Demo inbox.
//
// Usage (after `npm run build`):
//   npm run lighthouse                     every theme and device
//   npm run lighthouse -- --theme dark --device mobile
//   npm run lighthouse -- --base http://localhost:5173   another server
// Reports (HTML), screenshots and a summary go to lighthouse-report/.
import { mkdir, writeFile, appendFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { startFlow, desktopConfig } from 'lighthouse'
import puppeteer from 'puppeteer-core'
import * as chromeLauncher from 'chrome-launcher'
import { serve } from './serve.mjs'

const { values: args } = parseArgs({
  options: {
    theme: { type: 'string', default: 'all' },
    device: { type: 'string', default: 'all' },
    base: { type: 'string' },
    out: { type: 'string', default: 'lighthouse-report' },
  },
})
const pick = (value, all) => (value === 'all' ? all : value.split(','))
const THEMES = pick(args.theme, ['light', 'dark'])
const DEVICES = pick(args.device, ['mobile', 'desktop'])
const CATEGORIES = ['accessibility', 'best-practices', 'seo']

// The demo accounts (src/mocks/patientLogins.ts; staff sign in by name).
const STAFF = 'Rosa Jimenez'
const PATIENT = { email: 'owen.hart@example.com', password: 'demo1234' }

const SIGNED_OUT_PAGES = [
  ['staff-sign-in', '/'],
  ['choose-office', '/book'],
  ['book-signed-out', '/book/maple'],
  ['patient-sign-in', '/patient'],
  ['sign-up', '/patient/sign-up'],
  ['forgot-password', '/patient/forgot-password'],
  ['demo-inbox', '/patient/demo-inbox'],
  ['check-in-link', '/check-in/maple/a-11'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim()

// ---- Page helpers ---------------------------------------------------------

// Click the first button or tab (inside the open dialog, if `inDialog`)
// whose aria-label starts with `start`, or whose text contains it. Buttons
// with initials in front of the name ("RJ Rosa Jimenez") have no aria-label.
async function click(page, start, { inDialog = false } = {}) {
  await page.waitForFunction(
    (start, inDialog) => {
      const root = inDialog ? document.querySelector('[role=dialog]') : document
      if (!root) return false
      const s = start.toLowerCase()
      const text = (b) =>
        (b.innerText ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
      const hit = (b) => {
        const aria = b.getAttribute('aria-label')
        return aria ? aria.toLowerCase().startsWith(s) : text(b).includes(s)
      }
      const b = [...root.querySelectorAll('button,[role=tab]')].find(hit)
      b?.click()
      return Boolean(b)
    },
    { timeout: 10_000 },
    start,
    inDialog,
  )
  await sleep(400)
}

// Fill the input whose <label> starts with `labelStart`.
async function fill(page, labelStart, value) {
  const handle = await page.waitForFunction(
    (labelStart) => {
      const label = [...document.querySelectorAll('label')].find((l) =>
        l.innerText.trim().startsWith(labelStart),
      )
      return label?.htmlFor || label?.querySelector('input')?.id || null
    },
    { timeout: 10_000 },
    labelStart,
  )
  const selector = `[id="${await handle.jsonValue()}"]`
  await page.click(selector, { count: 3 })
  await page.type(selector, value)
}

const waitForText = (page, pattern) =>
  page.waitForFunction(
    (source) => new RegExp(source, 'i').test(document.body.innerText),
    { timeout: 10_000 },
    pattern,
  )

// The board has loaded: some visit button (labelled "Name, status, …").
const boardReady = (page) =>
  page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].some((b) =>
        /^[^,]+, [^,]+, /.test(b.getAttribute('aria-label') ?? ''),
      ),
    { timeout: 10_000 },
  )

async function signInAsStaff(page, base) {
  await page.goto(base + '/', { waitUntil: 'networkidle0' })
  await click(page, STAFF)
  await boardReady(page)
}

async function signInAsPatient(page, base) {
  await page.goto(base + '/patient', { waitUntil: 'networkidle0' })
  await page.locator('input[type=email]').fill(PATIENT.email)
  await page.locator('input[type=password]').fill(PATIENT.password)
  await page.locator('form button[type=submit]').click()
  await waitForText(page, 'Your visits')
}

// Open a visit's drawer. On a phone the board shows one chair at a time
// (a "Chair" group of labelled radios), so switch chairs until it's there.
async function openVisit(page, name) {
  for (const chair of [null, 'Chair 1', 'Chair 2', 'Chair 3']) {
    if (chair) {
      const picked = await page.evaluate((chair) => {
        const label = [...document.querySelectorAll('fieldset label')].find(
          (l) => l.innerText.replace(/\s+/g, ' ').trim() === chair,
        )
        label?.click()
        return Boolean(label)
      }, chair)
      if (!picked) continue
      await sleep(300)
    }
    const found = await page.evaluate(
      (name) =>
        [...document.querySelectorAll('button')].some((b) =>
          (b.getAttribute('aria-label') ?? '').startsWith(name + ','),
        ),
      name,
    )
    if (found) return click(page, name + ',')
  }
  throw new Error(`visit not found on the board: ${name}`)
}

// The board's states, each opened from a freshly loaded board.
const BOARD_STATES = [
  [
    'patient-flow',
    async (page) => {
      await click(page, 'Patient flow')
      await page.waitForSelector('[role=tab][aria-selected=true]')
      await waitForText(page, 'Arrived')
    },
  ],
  ['check-in-drawer', (page) => openVisit(page, 'Lena Ortiz')],
  [
    'billing',
    async (page) => {
      await openVisit(page, 'Ana Diaz')
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[role=dialog] label')].some((l) =>
          /^Amount/.test(l.innerText.trim()),
        ),
      )
    },
  ],
  [
    'billing-error',
    async (page) => {
      await openVisit(page, 'Ana Diaz')
      await fill(page, 'Amount', 'abc')
      await click(page, 'Record payment', { inDialog: true })
      await page.waitForSelector('[role=dialog] [aria-invalid=true]')
    },
  ],
  [
    'cancel-reason',
    async (page) => {
      await openVisit(page, 'Owen Hart')
      await click(page, 'Cancel visit…', { inDialog: true })
    },
  ],
  [
    'move-to',
    async (page) => {
      await openVisit(page, 'Lena Ortiz')
      await click(page, 'Move to…', { inDialog: true })
    },
  ],
  ['new-appointment', (page) => click(page, 'New appointment')],
  ['account-menu', (page) => click(page, 'Account menu')],
]

// ---- Suites ----------------------------------------------------------------
// Each runs in its own browser, so one failing doesn't stop the others.

async function signedOutPages(flow, page, base) {
  for (const [name, url] of SIGNED_OUT_PAGES) {
    await flow.navigate(base + url, { name })
  }
}

async function signedInPages(flow, page, base) {
  // Keep storage between navigations: the sign-in lives there.
  const go = (name, url) =>
    flow.navigate(base + url, { name, disableStorageReset: true })
  await signInAsStaff(page, base)
  await go('board', '/')
  await signInAsPatient(page, base)
  await go('your-visits', '/patient')
  await go('book-signed-in', '/book/maple')
  await go('change-password', '/patient/change-password')
}

async function boardStates(flow, page, base) {
  await signInAsStaff(page, base)
  for (const [name, open] of BOARD_STATES) {
    await page.reload({ waitUntil: 'networkidle0' })
    await boardReady(page)
    await open(page)
    await flow.snapshot({ name })
  }
  // Last, as it leaves the board crashed: ?crash breaks the board on purpose.
  // (A snapshot doesn't collect console messages, so the error the app logs
  // here on purpose isn't counted against Best Practices.)
  await page.goto(base + '/?crash', { waitUntil: 'networkidle0' })
  await waitForText(page, 'Something went wrong')
  await flow.snapshot({ name: 'error-screen' })
}

async function passwordReset(flow, page, base) {
  await page.goto(base + '/patient/forgot-password', {
    waitUntil: 'networkidle0',
  })
  await fill(page, 'Email', PATIENT.email)
  await click(page, 'Send reset link')
  await waitForText(page, 'Check your email')
  await flow.snapshot({ name: 'check-your-email' })

  // Go to the links' addresses rather than clicking them, so no navigation
  // starts in the middle of a wait.
  const inbox = await page.evaluate(
    () =>
      [...document.querySelectorAll('main a')].find((a) =>
        /demo inbox/i.test(a.innerText),
      )?.href,
  )
  await page.goto(inbox, { waitUntil: 'networkidle0' })
  await page.waitForSelector('article')
  await flow.snapshot({ name: 'inbox-with-email' })
  const resetLink = await page.evaluate(
    () =>
      [...document.querySelectorAll('article a')].find((a) =>
        /reset your password/i.test(a.innerText),
      )?.href,
  )
  if (!resetLink) throw new Error('no reset link in the Demo inbox')

  // The token lives in storage, so keep it.
  await flow.navigate(resetLink, {
    name: 'reset-password',
    disableStorageReset: true,
  })
  await fill(page, 'New password', 'brand new pass')
  await fill(page, 'Type it again', 'not the same')
  await click(page, 'Change password')
  await page.waitForSelector('[role=alert]')
  await flow.snapshot({ name: 'reset-mismatch-error' })
}

const SUITES = [
  ['signed-out', signedOutPages],
  ['signed-in', signedInPages],
  ['board-states', boardStates],
  ['password-reset', passwordReset],
]

// ---- Running ---------------------------------------------------------------

async function runSuite(base, outDir, theme, device, [suite, steps]) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      // GitHub's Ubuntu runners don't allow Chrome's sandbox.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      // The app's theme follows the device, so this turns every screen dark.
      ...(theme === 'dark' ? ['--force-dark-mode'] : []),
    ],
  })
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${chrome.port}`,
    defaultViewport: null,
  })
  try {
    const page = await browser.newPage()
    // Snapshots keep the page's own size, so set it ourselves and tell
    // Lighthouse not to change it (the same sizes Lighthouse uses).
    const mobile = device === 'mobile'
    await page.setViewport(
      mobile
        ? {
            width: 412,
            height: 823,
            deviceScaleFactor: 1.75,
            isMobile: true,
            hasTouch: true,
          }
        : { width: 1350, height: 940, deviceScaleFactor: 1 },
    )
    const preset = mobile
      ? { extends: 'lighthouse:default', settings: {} }
      : desktopConfig
    const config = {
      ...preset,
      settings: {
        ...preset.settings,
        onlyCategories: CATEGORIES,
        screenEmulation: { disabled: true },
      },
    }
    const flow = await startFlow(page, { config, name: suite })
    let error
    try {
      await steps(flow, page, base)
    } catch (e) {
      error = e
    }
    const result = await flow.createFlowResult()
    const tag = `${suite}-${theme}-${device}`
    if (result.steps.length > 0) {
      await writeFile(
        path.join(outDir, `${tag}.html`),
        await flow.generateReport(),
      )
    }
    const rows = await Promise.all(
      result.steps.map(({ name, lhr }) =>
        check(name, lhr, { theme, device, outDir }),
      ),
    )
    if (error) {
      rows.push({
        name: `${suite} (stopped)`,
        theme,
        device,
        failures: [`error: ${squash(error.message).slice(0, 200)}`],
      })
    }
    return rows
  } finally {
    await browser.disconnect()
    chrome.kill()
  }
}

// Every category 100: list each audit that pulls a score down.
async function check(name, lhr, { theme, device, outDir }) {
  const failures = []
  const scores = {}
  for (const id of CATEGORIES) {
    const category = lhr.categories[id]
    scores[id] =
      category.score === null ? null : Math.round(category.score * 100)
    for (const ref of category.auditRefs) {
      const audit = lhr.audits[ref.id]
      if (ref.weight === 0 || audit.score === null || audit.score === 1)
        continue
      const nodes = (audit.details?.items ?? [])
        .map((item) => item.node?.snippet ?? item.description ?? item.url)
        .filter(Boolean)
        .slice(0, 3)
      failures.push(
        `${ref.id}${nodes.length ? ': ' + nodes.map(squash).join(' | ') : ''}`,
      )
    }
  }
  const shot = lhr.fullPageScreenshot?.screenshot?.data
  if (shot) {
    await writeFile(
      path.join(outDir, `${name}-${theme}-${device}.jpg`),
      Buffer.from(shot.split(',')[1], 'base64'),
    )
  }
  return { name, theme, device, scores, failures }
}

async function main() {
  const outDir = path.resolve(args.out)
  await mkdir(outDir, { recursive: true })
  const server = args.base ? null : await serve('dist')
  const base = (args.base ?? server.url).replace(/\/$/, '')
  console.log(`Lighthouse against ${base}`)

  const rows = []
  try {
    for (const theme of THEMES) {
      for (const device of DEVICES) {
        for (const suite of SUITES) {
          console.log(`  ${suite[0]}, ${theme}, ${device}…`)
          try {
            rows.push(...(await runSuite(base, outDir, theme, device, suite)))
          } catch (e) {
            rows.push({
              name: `${suite[0]} (didn't start)`,
              theme,
              device,
              failures: [`error: ${squash(e.message).slice(0, 200)}`],
            })
          }
        }
      }
    }
  } finally {
    await server?.close()
  }

  const score = (r, id) => r.scores?.[id] ?? '–'
  const lines = [
    '| Page or state | Theme | Device | A11y | Best pr. | SEO | Failing |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${r.theme} | ${r.device} | ${CATEGORIES.map((c) => score(r, c)).join(' | ')} | ${r.failures.join('<br>').replaceAll('|', '\\|') || '–'} |`,
    ),
  ]
  const failed = rows.filter((r) => r.failures.length > 0)
  const verdict =
    failed.length === 0
      ? `All ${rows.length} pages and states score 100 for Accessibility, Best Practices and SEO.`
      : `${failed.length} of ${rows.length} pages and states fall short of 100.`
  const summary = `## Lighthouse\n\n${verdict}\n\n${lines.join('\n')}\n`
  await writeFile(path.join(outDir, 'summary.md'), summary)
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  }

  for (const r of rows) {
    const label = `${r.name} ${r.theme} ${r.device}`.padEnd(40)
    const scores = CATEGORIES.map((c) => String(score(r, c)).padStart(3)).join(
      ' ',
    )
    console.log(`${label} ${scores}  ${r.failures.join(' ; ')}`)
  }
  console.log(`\n${verdict}\nReports: ${outDir}`)
  process.exitCode = failed.length === 0 ? 0 : 1
}

await main()
