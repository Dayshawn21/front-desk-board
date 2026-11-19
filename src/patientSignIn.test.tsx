import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { updateAppointment } from './api/schedule'
import { renderWithQuery } from './test/render'

// The patient's sign-in is a demo: pick one of the office's made-up
// patients, no password. It's remembered for this tab, like the staff one.
function openAt(path: string) {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

async function signInAs(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await screen.findByRole('heading', { name: /^Sign in/ })
  await user.click(screen.getByRole('button', { name }))
}

describe('choosing an office at /patient', () => {
  it('lists every office, each linking to its patient sign-in', async () => {
    openAt('/patient')
    expect(
      await screen.findByRole('heading', { name: 'Choose your dental office' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Maple Street Dental/ }),
    ).toHaveAttribute('href', '/patient/maple')
    expect(
      screen.getByRole('link', { name: /Riverbend Family Dental/ }),
    ).toHaveAttribute('href', '/patient/riverbend')
    expect(
      within(screen.getByRole('banner')).getByText('Patient sign-in'),
    ).toBeInTheDocument()
  })
})

describe('signing in as a patient', () => {
  it("lists only that office's made-up patients, with no password", async () => {
    openAt('/patient/maple')
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Maple Street Dental')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Owen Hart' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hana Sato' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /\w+ \w+/ })).toHaveLength(15)
    // Says plainly it's pretend.
    expect(screen.getByText(/made-up patients/i)).toBeInTheDocument()
    expect(screen.getByText(/no password/i)).toBeInTheDocument()
  })

  it("shows the patient's visits today, with a check-in link", async () => {
    const { user } = openAt('/patient/maple')
    await signInAs(user, 'Owen Hart')

    const heading = await screen.findByRole('heading', { name: 'Your visits' })
    expect(heading).toHaveFocus()
    expect(screen.getByText(/Hi Owen/)).toBeInTheDocument()

    const visits = screen.getByRole('list', { name: 'Your visits today' })
    const [visit] = within(visits).getAllByRole('listitem')
    expect(visit).toHaveTextContent('Booked')
    expect(
      within(visit).getByRole('link', { name: /^Check in/ }),
    ).toHaveAttribute('href', '/check-in/maple/a-04')

    expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute(
      'href',
      '/book/maple',
    )
    // Who's signed in, and a way out, in the page header.
    const header = screen.getByRole('banner')
    expect(within(header).getByText('Owen Hart')).toBeInTheDocument()
    expect(
      within(header).getByRole('button', { name: 'Sign out' }),
    ).toBeInTheDocument()
  })

  it('shows a finished visit as done, with nothing to check in', async () => {
    const { user } = openAt('/patient/maple')
    await signInAs(user, 'Ana Diaz')

    const visits = await screen.findByRole('list', {
      name: 'Your visits today',
    })
    const [visit] = within(visits).getAllByRole('listitem')
    expect(visit).toHaveTextContent('Done')
    expect(
      within(visit).queryByRole('link', { name: /^Check in/ }),
    ).not.toBeInTheDocument()
  })

  it('shows a cancelled visit as cancelled, with nothing to check in', async () => {
    await updateAppointment('maple', 'a-04', {
      status: 'cancelled',
      cancelReason: 'patient-cancelled',
    })
    const { user } = openAt('/patient/maple')
    await signInAs(user, 'Owen Hart')

    const visits = await screen.findByRole('list', {
      name: 'Your visits today',
    })
    expect(visits).toHaveTextContent('Cancelled')
    expect(
      within(visits).queryByRole('link', { name: /^Check in/ }),
    ).not.toBeInTheDocument()
  })

  it('remembers the sign-in on reload, and forgets it on sign out', async () => {
    const first = openAt('/patient/maple')
    await signInAs(first.user, 'Owen Hart')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    // Like a reload: the same tab, a fresh app.
    const second = openAt('/patient/maple')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()

    await second.user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toHaveFocus()
    second.unmount()

    openAt('/patient/maple')
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
  })

  it("is per office: a Maple patient isn't signed in at Riverbend", async () => {
    const first = openAt('/patient/maple')
    await signInAs(first.user, 'Owen Hart')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    openAt('/patient/riverbend')
    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hana Sato' }),
    ).toBeInTheDocument()
  })

  it("doesn't touch the staff sign-in", async () => {
    const first = openAt('/patient/maple')
    await signInAs(first.user, 'Owen Hart')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    openAt('/')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /sign in as a patient/i }),
    ).toHaveAttribute('href', '/patient')
  })

  it("says so when the office doesn't exist", async () => {
    openAt('/patient/nowhere')
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't find that practice",
      }),
    ).toBeInTheDocument()
  })
})
