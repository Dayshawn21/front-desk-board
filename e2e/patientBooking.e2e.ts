import { expect, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn.js'

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

test('a new patient signs up, then books', async ({ page }) => {
  await page.goto('/patient')
  await page.getByRole('link', { name: /create an account/i }).click()
  await expect(page).toHaveURL(/\/patient\/sign-up$/)
  await page.getByText('Riverbend Family Dental').click()
  await page.getByLabel('First name').fill('Zoe')
  await page.getByLabel('Last name').fill('Quill')
  await page.getByLabel('Phone').fill('555-0199')
  await page.getByLabel('Email').fill('zoe.quill@example.com')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Your visits' })).toBeVisible()
  await expect(page).toHaveURL(/\/patient$/)
  await expect(page.getByText('You have no visits today.')).toBeVisible()

  // Signed in: a reload keeps it, and booking goes straight to the form.
  await page.reload()
  await page.getByRole('link', { name: 'Book a visit' }).click()
  await expect(
    page.getByRole('heading', { name: 'Book a visit' }),
  ).toBeVisible()
})

test('a patient resets a forgotten password through the demo inbox', async ({
  page,
}) => {
  await page.goto('/patient')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email').fill('owen.hart@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(
    page.getByRole('heading', { name: 'Check your email' }),
  ).toBeVisible()

  await page.getByRole('link', { name: /demo inbox/i }).click()
  await page
    .getByRole('article')
    .first()
    .getByRole('link', { name: 'Reset your password' })
    .click()
  await expect(page).toHaveURL(/\/patient\/reset-password\?token=/)
  await page.getByLabel('New password').fill('brand new pass')
  await page.getByLabel('Type it again').fill('brand new pass')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(
    page.getByRole('heading', { name: 'Password changed' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Sign in' }).click()
  // The old password no longer works; the new one does.
  await page.getByLabel('Email').fill('owen.hart@example.com')
  await page.getByLabel('Password').fill('demo1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toContainText("don't match")
  await page.getByLabel('Password').fill('brand new pass')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Your visits' })).toBeVisible()
})

test('a signed-in patient changes their password', async ({ page }) => {
  await page.goto('/patient')
  await signInAsPatient(page, 'ravi.menon@example.com')
  await page
    .getByRole('region', { name: 'Your account' })
    .getByRole('link', { name: 'Change password' })
    .click()
  await page.getByLabel('Current password').fill('demo1234')
  await page.getByLabel('New password').fill('brand new pass')
  await page.getByLabel('Type it again').fill('brand new pass')
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(
    page.getByRole('heading', { name: 'Password changed' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByLabel('Email').fill('ravi.menon@example.com')
  await page.getByLabel('Password').fill('brand new pass')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Your visits' })).toBeVisible()
})
