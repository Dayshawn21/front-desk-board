import { expect, test } from '@playwright/test'
import { signInAsPatient } from './patientSignIn.js'

// Fake data only; payments are pretend (no card is charged). In the seed,
// Ana Diaz is checked out and owes $190.00 after her plan's $60.00.

test('front desk records a payment at checkout, then undoes it', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await page.getByRole('button', { name: /^Ana Diaz,/ }).click()

  const drawer = page.getByRole('dialog', { name: 'Ana Diaz' })
  const billing = drawer.getByRole('region', { name: 'Billing' })
  await expect(billing.getByRole('status')).toHaveText('Balance due: $190.00')

  await billing.getByLabel('Amount').fill('50')
  await billing.getByRole('radio', { name: 'Cash' }).check()
  await billing.getByRole('button', { name: 'Record payment' }).click()

  await expect(page.getByText('Ana Diaz: $50.00 paid in cash')).toBeVisible()
  await expect(billing.getByRole('status')).toHaveText('Balance due: $140.00')
  await expect(
    drawer.getByRole('checkbox', { name: 'Copay collected' }),
  ).toBeChecked()

  await page.getByRole('button', { name: 'Undo payment for Ana Diaz' }).click()
  await expect(
    page.getByText('Ana Diaz: payment of $50.00 undone'),
  ).toBeVisible()
  await expect(billing.getByRole('status')).toHaveText('Balance due: $190.00')
  await expect(
    drawer.getByRole('checkbox', { name: 'Copay collected' }),
  ).not.toBeChecked()
})

test("the office manager sees today's totals", async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /theo grant/i }).click()
  const totals = page.getByRole('region', { name: "Today's billing" })
  await expect(totals).toContainText('Billed$190.00')
  await expect(totals).toContainText('Outstanding$190.00')
})

test("a payment at the desk shows on the patient's bill", async ({
  page,
  context,
}) => {
  // Same browser, two tabs: the mock db is shared through localStorage.
  const patient = await context.newPage()
  await patient.goto('/patient')
  await signInAsPatient(patient, 'ana.diaz@example.com')
  const bill = patient.getByRole('region', { name: 'Your bill' })
  await expect(bill).toContainText('Balance due: $190.00')

  await page.goto('/')
  await page.getByRole('button', { name: /rosa jimenez/i }).click()
  await page.getByRole('button', { name: /^Ana Diaz,/ }).click()
  const billing = page
    .getByRole('dialog', { name: 'Ana Diaz' })
    .getByRole('region', { name: 'Billing' })
  await billing.getByLabel('Amount').fill('50')
  await billing.getByRole('button', { name: 'Record payment' }).click()
  await expect(page.getByText('Ana Diaz: $50.00 paid by card')).toBeVisible()

  // The patient's tab updates without a reload.
  await expect(bill).toContainText('Balance due: $140.00')
})
