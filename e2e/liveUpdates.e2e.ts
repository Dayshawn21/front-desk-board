import { expect, type Page, test } from '@playwright/test'

// Two tabs in one browser context share localStorage, like two tabs of the
// same browser. Each tab signs in on its own (sign-in is per tab).

async function signIn(page: Page, name: RegExp) {
  await page.goto('/')
  await page.getByRole('button', { name }).click()
  await expect(page.getByRole('button', { name: /^Jon Kim,/ })).toBeVisible()
}

test('a booking in one tab shows up on the board in another, without a reload', async ({
  context,
}) => {
  const board = await context.newPage()
  const other = await context.newPage()
  await signIn(board, /rosa jimenez/i)
  await signIn(other, /theo grant/i)

  await other.getByRole('button', { name: 'New appointment' }).click()
  const booking = other.getByRole('dialog', { name: 'New appointment' })
  await booking.getByLabel('Patient', { exact: true }).selectOption('p-ana')
  await booking.getByRole('radio', { name: /11:30 AM.*Chair 2/ }).check()
  await booking.getByRole('button', { name: 'Book', exact: true }).click()
  await expect(other.getByText(/^Booked Ana Diaz/)).toBeVisible()

  await expect(
    board.getByRole('button', { name: /^Ana Diaz, Scheduled, Exam, 11:30 AM/ }),
  ).toBeVisible()
})

test('changes survive a reload, and Reset demo data puts the demo back', async ({
  page,
}) => {
  await signIn(page, /rosa jimenez/i)
  await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
  const drawer = page.getByRole('dialog', { name: /Lena Ortiz/ })
  await drawer.getByRole('button', { name: 'Check in', exact: true }).click()
  await expect(
    drawer.getByRole('heading', { name: 'Status: Arrived' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(
    page.getByRole('button', { name: /^Lena Ortiz,.*Arrived/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: /account menu/i }).click()
  await page.getByRole('button', { name: 'Reset demo data' }).click()
  await expect(page.getByText('Demo data reset')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Lena Ortiz,.*Confirmed/ }),
  ).toBeVisible()
})
