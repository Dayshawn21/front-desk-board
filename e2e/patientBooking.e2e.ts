import { expect, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn'

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
  await signInAsPatient(patient, 'grace.liu@example.com')
  await expect(
    patient.getByRole('heading', { name: 'Book a visit' }),
  ).toBeVisible()
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

test('the sign-in page links to /book, where the patient picks a practice', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: /book a visit online/i }).click()
  await expect(page).toHaveURL(/\/book$/)
  await page.getByRole('link', { name: /Riverbend Family Dental/ }).click()
  await expect(page).toHaveURL(/\/book\/riverbend$/)
  await expect(
    page.getByRole('heading', { name: 'Sign in to book' }),
  ).toBeVisible()
})

test('a patient signs in, books, and sees the visit in their list', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: /sign in as a patient/i }).click()
  await expect(page).toHaveURL(/\/patient$/)
  await signInAsPatient(page, 'owen.hart@example.com')
  await expect(page.getByRole('heading', { name: 'Your visits' })).toBeVisible()
  const visits = page.getByRole('list', { name: 'Your visits today' })
  await expect(visits.getByRole('listitem')).toHaveCount(1)

  // Signed in, booking goes straight to the form.
  await page.getByRole('link', { name: 'Book a visit' }).click()
  await page.getByRole('radio', { name: /^Checkup/ }).check()
  await page
    .getByRole('group', { name: 'Pick a time' })
    .getByText('11:30 AM', { exact: true })
    .click()
  await page.getByRole('button', { name: 'Book 11:30 AM' }).click()
  await expect(
    page.getByRole('heading', { name: "You're booked" }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'See your visits' }).click()
  await expect(visits.getByRole('listitem')).toHaveCount(2)
  await expect(visits).toContainText('11:30 AM')

  // Signing out forgets the patient.
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
