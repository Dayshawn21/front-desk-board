import { expect, test } from '@playwright/test'

// A patient books online in one tab; the front desk's board, open in
// another tab of the same browser, shows the visit without a reload.

test('a patient books online and the visit appears on the front desk board', async ({
  context,
}) => {
  const board = await context.newPage()
  await board.goto('/')
  await board.getByRole('button', { name: /rosa jimenez/i }).click()
  await expect(board.getByRole('button', { name: /^Jon Kim,/ })).toBeVisible()

  const patient = await context.newPage()
  await patient.goto('/book/maple')
  await expect(
    patient.getByRole('heading', { name: 'Book a visit' }),
  ).toBeVisible()
  await patient.getByLabel('Who is the visit for?').selectOption('p-grace')
  await patient.getByRole('radio', { name: /^Checkup/ }).check()
  // Click the visible label: the radio itself is visually hidden.
  await patient
    .getByRole('group', { name: 'Pick a time' })
    .getByText('11:30 AM', { exact: true })
    .click()
  await patient.getByRole('button', { name: 'Book 11:30 AM' }).click()
  await expect(
    patient.getByRole('heading', { name: "You're booked" }),
  ).toBeVisible()

  await expect(
    board.getByRole('button', {
      name: /^Grace Liu, Scheduled, Exam, 11:30 AM to 12:00 PM/,
    }),
  ).toBeVisible()
})

test('the sign-in page links to the patient booking page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /book a visit online/i }).click()
  await expect(page).toHaveURL(/\/book\/maple$/)
  await expect(
    page.getByRole('heading', { name: 'Book a visit' }),
  ).toBeVisible()
})
