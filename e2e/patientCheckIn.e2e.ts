import { expect, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn'

// The front desk opens a visit's check-in link (as if sent to the patient's
// phone); the patient ticks their forms and taps "I'm here"; the board, in
// the first tab, shows them Arrived with the checklist updated.

test('a patient checks in from their phone and the board shows them arrived', async ({
  context,
}) => {
  const board = await context.newPage()
  await board.goto('/')
  await board.getByRole('button', { name: /rosa jimenez/i }).click()
  await board.getByRole('button', { name: /^Ravi Menon,/ }).click()
  const drawer = board.getByRole('dialog', { name: /Ravi Menon/ })

  // The drawer's link opens the patient's page in a new tab.
  const [phone] = await Promise.all([
    context.waitForEvent('page'),
    drawer.getByRole('link', { name: /open check-in page/i }).click(),
  ])
  await expect(phone).toHaveURL(/\/check-in\/maple\/a-11$/)
  await board.keyboard.press('Escape')

  // The link alone shows nothing: the patient signs in first.
  await expect(
    phone.getByRole('heading', { name: 'Sign in to check in' }),
  ).toBeVisible()
  await expect(phone.getByText(/Ravi/)).toHaveCount(0)
  await signInAsPatient(phone, 'ravi.menon@example.com')
  await expect(phone.getByRole('heading', { name: 'Check in' })).toBeVisible()
  await phone
    .getByRole('checkbox', { name: "I've filled in my visit forms" })
    .check()
  await expect(phone.getByText('Saved')).toBeVisible()
  await phone.getByRole('button', { name: "I'm here" }).click()
  await expect(
    phone.getByRole('heading', { name: "You're checked in" }),
  ).toBeVisible()

  const card = board.getByRole('button', { name: /^Ravi Menon,.*Arrived/ })
  await expect(card).toBeVisible()
  await card.click()
  await expect(
    board
      .getByRole('dialog', { name: /Ravi Menon/ })
      .getByRole('checkbox', { name: 'Forms complete' }),
  ).toBeChecked()
})

test("a signed-in patient can't open another patient's check-in page", async ({
  page,
}) => {
  await page.goto('/patient')
  await signInAsPatient(page, 'owen.hart@example.com')
  await expect(page.getByRole('heading', { name: 'Your visits' })).toBeVisible()

  // Ravi Menon's link, typed in by hand.
  await page.goto('/check-in/maple/a-11')
  await expect(
    page.getByRole('heading', { name: "We couldn't find that visit" }),
  ).toBeVisible()
  await expect(page.getByText(/Ravi/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: "I'm here" })).toHaveCount(0)
})
