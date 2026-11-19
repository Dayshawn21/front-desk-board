import type { Page } from '@playwright/test'

// The demo patient login (see src/mocks/patientLogins.ts and the README).
export const DEMO_PATIENT_PASSWORD = 'demo1234'

export async function signInAsPatient(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(DEMO_PATIENT_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}
