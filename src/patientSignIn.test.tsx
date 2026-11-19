import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { MOCK_DB_KEY, resetDemoData, updateAppointment } from './api/schedule'
import { renderWithQuery } from './test/render'
import { signInWithForm } from './test/patient'

// Patients sign in at /patient with an email and password (demo logins,
// checked by the mock server). Signed in, they see only their own visits.
function openAt(path: string) {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

describe('the patient sign-in page', () => {
  it('is a real sign-in form, with no list of patients', async () => {
    openAt('/patient')
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'username',
    )
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'type',
      'password',
    )
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(
      screen.queryByRole('button', { name: 'Owen Hart' }),
    ).not.toBeInTheDocument()
    // One demo login, so visitors can try it.
    expect(screen.getByText(/owen\.hart@example\.com/)).toBeInTheDocument()
  })

  it('says so when the email or password is wrong, and stays signed out', async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'owen.hart@example.com', 'wrong-password')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That email and password don't match.",
    )
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Your visits' }),
    ).not.toBeInTheDocument()
  })

  it('asks for both fields before sending', async () => {
    const { user } = openAt('/patient')
    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByLabelText('Email')).toBeRequired()
    expect(screen.getByLabelText('Password')).toBeRequired()
    expect(
      screen.queryByRole('heading', { name: 'Your visits' }),
    ).not.toBeInTheDocument()
  })
})

describe('your visits', () => {
  it("shows the patient's visits today, with a check-in link", async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'owen.hart@example.com')

    const heading = await screen.findByRole('heading', { name: 'Your visits' })
    expect(heading).toHaveFocus()
    expect(screen.getByText(/Hi Owen/)).toBeInTheDocument()
    expect(screen.getByText('Maple Street Dental')).toBeInTheDocument()

    const visits = screen.getByRole('list', { name: 'Your visits today' })
    const items = within(visits).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent('Booked')
    expect(
      within(items[0]).getByRole('link', { name: /^Check in/ }),
    ).toHaveAttribute('href', '/check-in/maple/a-04')

    expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute(
      'href',
      '/book/maple',
    )
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Owen Hart')).toBeInTheDocument()
    expect(
      within(header).getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument()
  })

  it('shows a finished visit as done, with nothing to check in', async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'ana.diaz@example.com')

    const visits = await screen.findByRole('list', {
      name: 'Your visits today',
    })
    expect(visits).toHaveTextContent('Done')
    expect(
      within(visits).queryByRole('link', { name: /^Check in/ }),
    ).not.toBeInTheDocument()
  })

  it('shows a cancelled visit as cancelled, with nothing to check in', async () => {
    await updateAppointment('maple', 'a-04', {
      status: 'cancelled',
      cancelReason: 'patient-cancelled',
    })
    const { user } = openAt('/patient')
    await signInWithForm(user, 'owen.hart@example.com')

    const visits = await screen.findByRole('list', {
      name: 'Your visits today',
    })
    expect(visits).toHaveTextContent('Cancelled')
    expect(
      within(visits).queryByRole('link', { name: /^Check in/ }),
    ).not.toBeInTheDocument()
  })

  it('works for a patient of the other office too', async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'kofi.mensah@example.com')
    await screen.findByRole('heading', { name: 'Your visits' })
    expect(screen.getByText('Riverbend Family Dental')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute(
      'href',
      '/book/riverbend',
    )
  })

  it('remembers the sign-in on reload, and forgets it on sign out', async () => {
    const first = openAt('/patient')
    await signInWithForm(first.user, 'owen.hart@example.com')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    // Like a reload: the same tab, a fresh app.
    const second = openAt('/patient')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()

    await second.user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toHaveFocus()
    second.unmount()

    openAt('/patient')
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it("doesn't touch the staff sign-in", async () => {
    const first = openAt('/patient')
    await signInWithForm(first.user, 'owen.hart@example.com')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    openAt('/')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /sign in as a patient/i }),
    ).toHaveAttribute('href', '/patient')
  })

  it('asks to sign in again when the session ends in another tab', async () => {
    const { user } = openAt('/patient')
    await signInWithForm(user, 'owen.hart@example.com')
    await screen.findByRole('heading', { name: 'Your visits' })

    // Another tab presses Reset demo data, which signs every patient out.
    resetDemoData()
    window.dispatchEvent(new StorageEvent('storage', { key: MOCK_DB_KEY }))

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Please sign in again.')).toBeInTheDocument()
    expect(screen.queryByText(/Hi Owen/)).not.toBeInTheDocument()
  })
})
