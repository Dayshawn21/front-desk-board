import { expect, type Page, type Route, test } from '@playwright/test'

// The AI booking assist in a real browser, with the server route faked:
// Playwright answers /api/parse-booking itself, so these tests never call
// Claude (no key, no cost, same answer every run). The real route and the
// model are covered by the unit tests and the eval.

type Draft = {
  patientId: string | null
  visitType: string | null
  durationMinutes: number | null
  chairId: string | null
  timeOfDay: 'morning' | 'afternoon' | null
  earliest: string | null
  notUsed: string[]
}

const anaCleaning: Draft = {
  patientId: 'p-ana',
  visitType: 'cleaning',
  durationMinutes: 60,
  chairId: 'maple-c2',
  timeOfDay: 'afternoon',
  earliest: null,
  notUsed: [],
}

// Answer the AI route with a canned draft; return what the page sent.
async function fakeAssist(page: Page, draft: Draft) {
  const sent: unknown[] = []
  await page.route('**/api/parse-booking', async (route: Route) => {
    sent.push(route.request().postDataJSON())
    await route.fulfill({ json: { draft, warnings: [] } })
  })
  return sent
}

async function openBooking(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await page.getByRole('button', { name: 'New appointment' }).click()
  return page.getByRole('dialog', { name: 'New appointment' })
}

test('describe a visit, AI fills the form, a person picks a time and books', async ({
  page,
}) => {
  const sent = await fakeAssist(page, anaCleaning)
  const booking = await openBooking(page)
  const request =
    '60 min cleaning for Ana Diaz this afternoon with Hygienist Patel'

  await booking.getByLabel(/describe the visit/i).fill(request)
  await booking.getByRole('button', { name: 'Fill in with AI' }).click()

  await expect(
    booking.getByText('AI-filled. Review before booking.'),
  ).toBeVisible()
  expect(sent).toEqual([{ practiceId: 'maple', text: request }])
  await expect(booking.getByLabel('Patient', { exact: true })).toHaveValue(
    'p-ana',
  )
  await expect(booking.getByLabel('Chair', { exact: true })).toHaveValue(
    'maple-c2',
  )

  // The AI never books: the offered times are afternoon ones in Chair 2,
  // and nothing is booked until a person picks one and clicks Book.
  const first = booking.getByRole('radio').first()
  await expect(first).toHaveAccessibleName(/(12|1|2|3|4):\d\d PM.*Chair 2/)
  await first.check()
  await booking.getByRole('button', { name: 'Book', exact: true }).click()

  await expect(page.getByText(/^Booked Ana Diaz: Cleaning/)).toBeVisible()
  await expect(booking).toBeHidden()
})

test('a request for another day gets a plain warning', async ({ page }) => {
  await fakeAssist(page, {
    ...anaCleaning,
    patientId: 'p-priya',
    visitType: 'filling',
    chairId: 'maple-c3',
    timeOfDay: 'morning',
    notUsed: ['tomorrow'],
  })
  const booking = await openBooking(page)

  await booking
    .getByLabel(/describe the visit/i)
    .fill('Filling for Priya in chair 3 tomorrow morning')
  await booking.getByRole('button', { name: 'Fill in with AI' }).click()

  await expect(
    booking.getByText(
      'You asked for tomorrow. This books today, Tuesday, Nov 17, and the times below are for today.',
    ),
  ).toBeVisible()
})

test('a rate-limited request says to wait, and nothing is filled', async ({
  page,
}) => {
  await page.route('**/api/parse-booking', (route) =>
    route.fulfill({ status: 429, body: '' }),
  )
  const booking = await openBooking(page)

  await booking.getByLabel(/describe the visit/i).fill('Exam for Jon Kim')
  await booking.getByRole('button', { name: 'Fill in with AI' }).click()

  await expect(
    booking.getByText('Too many requests. Wait a minute and try again.'),
  ).toBeVisible()
  await expect(booking.getByLabel('Patient', { exact: true })).toHaveValue('')
})
