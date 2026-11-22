import { expect, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn.js'

// Fake data only. In the seed, Lena Ortiz (confirmed, 9:45) is double-booked
// with Jon Kim in Chair 2; the first free time after the demo clock's 9:40
// is 11:30 in Chair 2.

test('the front desk moves a visit out of a double-booking, then undoes it', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await expect(page.getByText('1 scheduling conflict')).toBeVisible()

  await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Lena Ortiz' })
  await drawer.getByRole('button', { name: 'Move to…' }).click()
  await drawer.getByRole('radio', { name: /^11:30 AM.*Chair 2$/ }).check()
  await drawer.getByRole('button', { name: 'Move visit' }).click()

  await expect(
    page.getByText('Lena Ortiz: moved to 11:30 AM, Chair 2'),
  ).toBeVisible()
  await expect(
    drawer.getByText('Exam · Chair 2 · 11:30 AM – 12:15 PM'),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('1 scheduling conflict')).toBeHidden()

  await page.getByRole('button', { name: 'Undo move for Lena Ortiz' }).click()
  await expect(
    page.getByText('Lena Ortiz: move undone, back at 9:45 AM, Chair 2'),
  ).toBeVisible()
  await expect(page.getByText('1 scheduling conflict')).toBeVisible()
})

test("a move at the desk shows on the patient's visits", async ({
  page,
  context,
}) => {
  // Same browser, two tabs: the mock db is shared through localStorage.
  const patient = await context.newPage()
  await patient.goto('/patient')
  await signInAsPatient(patient, 'lena.ortiz@example.com')
  await expect(patient.getByText('9:45 AM – 10:30 AM')).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await page.getByRole('button', { name: /^Lena Ortiz,/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Lena Ortiz' })
  await drawer.getByRole('button', { name: 'Move to…' }).click()
  await drawer.getByRole('radio', { name: /^11:30 AM.*Chair 2$/ }).check()
  await drawer.getByRole('button', { name: 'Move visit' }).click()
  await expect(
    page.getByText('Lena Ortiz: moved to 11:30 AM, Chair 2'),
  ).toBeVisible()

  // The patient's tab updates without a reload.
  await expect(patient.getByText('11:30 AM – 12:15 PM')).toBeVisible()
})
