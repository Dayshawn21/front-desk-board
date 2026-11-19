import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { DEMO_PATIENT_PASSWORD } from './mocks/patientLogins'
import { renderWithQuery } from './test/render'
import { signInWithForm } from './test/patient'

// /patient/change-password, behind the patient sign-in.
function openAt(path: string) {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  {
    current = DEMO_PATIENT_PASSWORD,
    next = 'brand new pass',
    again,
  }: { current?: string; next?: string; again?: string } = {},
) {
  await user.type(await screen.findByLabelText('Current password'), current)
  await user.type(screen.getByLabelText('New password'), next)
  await user.type(screen.getByLabelText('Type it again'), again ?? next)
  await user.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('change password', () => {
  it('is linked from Your visits', async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'owen.hart@example.com')
    const account = await screen.findByRole('region', { name: 'Your account' })
    expect(account).toHaveTextContent('owen.hart@example.com')
    expect(
      within(account).getByRole('link', { name: 'Change password' }),
    ).toHaveAttribute('href', '/patient/change-password')
  })

  it('needs the patient to sign in first', async () => {
    openAt('/patient/change-password')
    expect(
      await screen.findByRole('heading', {
        name: 'Sign in to change your password',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
  })

  it('has the right fields for password managers', async () => {
    const { user } = openAt('/patient/change-password')
    await signInWithForm(user, 'owen.hart@example.com')
    expect(
      await screen.findByRole('heading', { name: 'Change your password' }),
    ).toHaveFocus()
    expect(screen.getByLabelText('Current password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    const next = screen.getByLabelText('New password')
    expect(next).toHaveAttribute('autocomplete', 'new-password')
    expect(next).toHaveAttribute('minlength', '8')
    expect(next).toHaveAccessibleDescription(/at least 8 characters/i)
  })

  it('changes the password and says so, still signed in', async () => {
    const first = openAt('/patient/change-password')
    await signInWithForm(first.user, 'owen.hart@example.com')
    await fillIn(first.user)

    expect(
      await screen.findByRole('heading', { name: 'Password changed' }),
    ).toHaveFocus()
    expect(
      screen.getByRole('link', { name: 'Back to your visits' }),
    ).toHaveAttribute('href', '/patient')
    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Sign out',
      }),
    ).toBeInTheDocument()

    // The new password works next time.
    await first.user.click(screen.getByRole('button', { name: 'Sign out' }))
    first.unmount()
    const second = openAt('/patient')
    await signInWithForm(second.user, 'owen.hart@example.com', 'brand new pass')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()
  })

  it('says so when the current password is wrong, and clears the fields', async () => {
    const { user } = openAt('/patient/change-password')
    await signInWithForm(user, 'owen.hart@example.com')
    await fillIn(user, { current: 'not my password' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your current password isn't right.",
    )
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it("says so when the new passwords don't match, and sends nothing", async () => {
    const { user } = openAt('/patient/change-password')
    await signInWithForm(user, 'owen.hart@example.com')
    await fillIn(user, { again: 'something else' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The two new passwords don't match.",
    )
    expect(
      screen.queryByRole('heading', { name: 'Password changed' }),
    ).not.toBeInTheDocument()
  })

  it('locks after too many wrong tries, and offers a reset', async () => {
    const { user } = openAt('/patient/change-password')
    await signInWithForm(user, 'owen.hart@example.com')
    for (let i = 0; i < 5; i++) {
      await fillIn(user, { current: 'not my password' })
      await screen.findByText("Your current password isn't right.")
    }
    await fillIn(user)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Too many tries. Try again in 15 minutes, or reset your password.',
    )
    expect(
      within(alert).getByRole('link', { name: 'Reset your password' }),
    ).toHaveAttribute('href', '/patient/forgot-password')
    expect(
      screen.queryByRole('heading', { name: 'Password changed' }),
    ).not.toBeInTheDocument()
  }, 20_000) // six rounds of typing in jsdom
})
