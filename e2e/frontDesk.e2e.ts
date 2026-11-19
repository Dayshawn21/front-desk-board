import { expect, type Page, test } from '@playwright/test'

// Fake data only. Each test gets a fresh browser context, so a fresh mock
// database and no remembered sign-in.

async function signInAsFrontDesk(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await expect(page.getByRole('button', { name: /^Jon Kim,/ })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await signInAsFrontDesk(page)
})

test('front desk books a visit, then checks a patient in', async ({ page }) => {
  await page.getByRole('button', { name: 'New appointment' }).click()
  const booking = page.getByRole('dialog', { name: 'New appointment' })
  await expect(booking.getByLabel('Patient', { exact: true })).toBeFocused()

  await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
  await booking.getByRole('radio', { name: /11:30 AM.*Chair 2/ }).check()
  await booking.getByRole('button', { name: 'Book', exact: true }).click()

  await expect(
    page.getByText('Booked Ana Diaz: Exam, 11:30 AM, Chair 2'),
  ).toBeVisible()
  await expect(booking).toBeHidden()
  await expect(
    page.getByRole('button', {
      name: /^Ana Diaz, Scheduled, Exam, 11:30 AM to 12:00 PM/,
    }),
  ).toBeVisible()

  // Check in a confirmed patient from the drawer.
  await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
  const drawer = page.getByRole('dialog', { name: /Lena Ortiz/ })
  await drawer.getByRole('button', { name: 'Check in', exact: true }).click()
  await expect(
    drawer.getByRole('heading', { name: 'Status: Arrived' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(drawer).toBeHidden()
  await expect(
    page.getByRole('button', { name: /^Lena Ortiz,.*Arrived/ }),
  ).toBeVisible()
  // Focus returns to the card that opened the drawer.
  await expect(page.getByRole('button', { name: /^Lena Ortiz,/ })).toBeFocused()
})

test('shows the existing double-booking, and a booked time is not offered again', async ({
  page,
}) => {
  // The seed has a deliberate overlap in Chair 2.
  await expect(page.getByText('1 scheduling conflict')).toBeVisible()
  await expect(
    page.getByText(/Chair 2: Jon Kim .* overlaps Lena Ortiz/),
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /^Jon Kim,.*Overlaps another appointment/,
    }),
  ).toBeVisible()

  // Book 11:30 in Chair 2...
  await page.getByRole('button', { name: 'New appointment' }).click()
  let booking = page.getByRole('dialog', { name: 'New appointment' })
  await booking.getByLabel('Patient', { exact: true }).selectOption('p-grace')
  await booking.getByRole('radio', { name: /11:30 AM.*Chair 2/ }).check()
  await booking.getByRole('button', { name: 'Book', exact: true }).click()
  await expect(page.getByText(/^Booked Grace Liu/)).toBeVisible()

  // ...then that time is no longer suggested, and no new conflict appeared.
  await page.getByRole('button', { name: 'New appointment' }).click()
  booking = page.getByRole('dialog', { name: 'New appointment' })
  await booking.getByLabel('Chair', { exact: true }).selectOption('maple-c2')
  await expect(booking.getByRole('radio').first()).toBeVisible()
  await expect(
    booking.getByRole('radio', { name: /11:30 AM.*Chair 2/ }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 scheduling conflict')).toBeVisible()
})

test('clicking an empty spot on the schedule starts a booking there', async ({
  page,
}) => {
  // A real mouse click, so this also checks the spot isn't covered by
  // anything else on the page (jsdom can't check layout).
  await page.getByTestId('slot-maple-c1-14:15').click()

  const booking = page.getByRole('dialog', { name: 'New appointment' })
  await expect(booking.getByLabel('Chair', { exact: true })).toHaveValue(
    'maple-c1',
  )
  await expect(booking.getByLabel('Time of day', { exact: true })).toHaveValue(
    'from',
  )
  await expect(booking.getByRole('radio').first()).toHaveAccessibleName(
    /2:15 PM.*Chair 1/,
  )
})
