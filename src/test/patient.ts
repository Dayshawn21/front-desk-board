import { screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { DEMO_PATIENT_PASSWORD } from '../mocks/patientLogins'

// Fills in and sends the patient sign-in form on the page.
export async function signInWithForm(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password = DEMO_PATIENT_PASSWORD,
) {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}
