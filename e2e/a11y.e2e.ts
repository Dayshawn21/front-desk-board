import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

// Automated accessibility checks (axe-core) on each main screen, in a real
// browser so colour contrast and layout are measured. axe finds roughly a
// third of WCAG issues; keyboard and screen-reader behaviour is covered by
// the other tests and by hand.

// WCAG 2.2 A/AA rules plus axe's best practices (which include using only
// ARIA roles that HTML allows on each element; Lighthouse found that one).
const AXE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
]

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .analyze()
  // One line per problem, so a failure says what and where.
  const summary = violations.flatMap((v) =>
    v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} (${v.help})`),
  )
  expect(summary).toEqual([])
}

async function signInAsFrontDesk(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await expect(page.getByRole('button', { name: /^Jon Kim,/ })).toBeVisible()
}

test('sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: /rosa jimenez/i }),
  ).toBeVisible()
  await expectNoViolations(page)
})

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsFrontDesk(page)
  })

  test('schedule board', async ({ page }) => {
    await expectNoViolations(page)
  })

  test('patient flow', async ({ page }) => {
    await page.getByRole('tab', { name: 'Patient flow' }).click()
    await expect(
      page.getByRole('tab', { name: 'Patient flow', selected: true }),
    ).toBeVisible()
    await expectNoViolations(page)
  })

  test('check-in drawer', async ({ page }) => {
    await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
    await expect(page.getByRole('dialog', { name: /Lena Ortiz/ })).toBeVisible()
    await expectNoViolations(page)
  })

  test('new appointment panel', async ({ page }) => {
    await page.getByRole('button', { name: 'New appointment' }).click()
    const booking = page.getByRole('dialog', { name: 'New appointment' })
    await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
    await expect(booking.getByRole('radio').first()).toBeVisible()
    await expectNoViolations(page)
  })

  test('account menu', async ({ page }) => {
    await page.getByRole('button', { name: /account menu/i }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expectNoViolations(page)
  })

  test('toast after booking', async ({ page }) => {
    await page.getByRole('button', { name: 'New appointment' }).click()
    const booking = page.getByRole('dialog', { name: 'New appointment' })
    await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
    await booking.getByRole('radio').first().check()
    await booking.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByText(/^Booked Ana Diaz/)).toBeVisible()
    await expectNoViolations(page)
  })

  test('schedule board on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await expectNoViolations(page)
  })
})
