import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fetchDemoInbox, requestPasswordReset } from './api/patientPortal'
import { renderWithQuery } from './test/render'
import { signInWithForm } from './test/patient'

// Forgot password, from the patient sign-in form: ask for a link, open it
// from the demo inbox, choose a new password, sign in with it.
function openAt(path: string) {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

async function resetPath(email = 'owen.hart@example.com') {
  await requestPasswordReset(email)
  const [latest] = await fetchDemoInbox()
  return latest.link
}

describe('forgot password', () => {
  it('is linked from the patient sign-in form', async () => {
    openAt('/patient')
    expect(
      await screen.findByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/patient/forgot-password')
  })

  it('sends a link, and says the same thing whether or not the account exists', async () => {
    const { user } = openAt('/patient/forgot-password')
    expect(
      await screen.findByRole('heading', { name: 'Reset your password' }),
    ).toBeInTheDocument()
    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toHaveAttribute('autocomplete', 'email')

    await user.type(email, 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    const done = await screen.findByRole('heading', {
      name: 'Check your email',
    })
    expect(done).toHaveFocus()
    expect(
      screen.getByText(/If an account exists for nobody@example\.com/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /demo inbox/i })).toHaveAttribute(
      'href',
      '/patient/demo-inbox',
    )
    expect(
      screen.getByRole('link', { name: 'Back to sign in' }),
    ).toHaveAttribute('href', '/patient')
  })
})

describe('the demo inbox', () => {
  it('lists the emails sent in this browser, newest first', async () => {
    await requestPasswordReset('owen.hart@example.com')
    await requestPasswordReset('ravi.menon@example.com')
    openAt('/patient/demo-inbox')

    expect(
      await screen.findByRole('heading', { name: 'Demo inbox' }),
    ).toBeInTheDocument()
    const emails = await screen.findAllByRole('article')
    expect(emails).toHaveLength(2)
    expect(emails[0]).toHaveTextContent('To: ravi.menon@example.com')
    expect(emails[0]).toHaveTextContent('Reset your password')
    const link = within(emails[0]).getByRole('link', {
      name: 'Reset your password',
    })
    expect(link.getAttribute('href')).toMatch(
      /^\/patient\/reset-password\?token=/,
    )
    // It says plainly what this page is.
    expect(screen.getByText(/no real email/i)).toBeInTheDocument()
  })

  it('says so when there are no emails', async () => {
    openAt('/patient/demo-inbox')
    expect(await screen.findByText('No emails yet.')).toBeInTheDocument()
  })
})

describe('choosing a new password', () => {
  it('changes the password, then the patient signs in with it', async () => {
    const path = await resetPath()
    const first = openAt(path)
    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument()
    const password = screen.getByLabelText('New password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    expect(password).toHaveAttribute('minlength', '8')
    await first.user.type(password, 'brand new pass')
    await first.user.type(
      screen.getByLabelText('Type it again'),
      'brand new pass',
    )
    await first.user.click(
      screen.getByRole('button', { name: 'Change password' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Password changed' }),
    ).toHaveFocus()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/patient',
    )
    first.unmount()

    const second = openAt('/patient')
    await signInWithForm(second.user, 'owen.hart@example.com', 'brand new pass')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()
  })

  it("says so when the two passwords don't match, and sends nothing", async () => {
    const path = await resetPath()
    const { user } = openAt(path)
    await user.type(
      await screen.findByLabelText('New password'),
      'brand new pass',
    )
    await user.type(screen.getByLabelText('Type it again'), 'brand new pas')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The two passwords don't match.",
    )
    expect(
      screen.queryByRole('heading', { name: 'Password changed' }),
    ).not.toBeInTheDocument()
  })

  it('says so when the link was already used, with a way to get a new one', async () => {
    const path = await resetPath()
    const first = openAt(path)
    await first.user.type(
      await screen.findByLabelText('New password'),
      'brand new pass',
    )
    await first.user.type(
      screen.getByLabelText('Type it again'),
      'brand new pass',
    )
    await first.user.click(
      screen.getByRole('button', { name: 'Change password' }),
    )
    await screen.findByRole('heading', { name: 'Password changed' })
    first.unmount()

    const second = openAt(path)
    await second.user.type(
      await screen.findByLabelText('New password'),
      'another pass',
    )
    await second.user.type(
      screen.getByLabelText('Type it again'),
      'another pass',
    )
    await second.user.click(
      screen.getByRole('button', { name: 'Change password' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link has expired or was already used. Ask for a new one.',
    )
    expect(
      screen.getByRole('link', { name: 'Ask for a new link' }),
    ).toHaveAttribute('href', '/patient/forgot-password')
  })

  it('says so when the link has no token', async () => {
    openAt('/patient/reset-password')
    expect(
      await screen.findByRole('heading', {
        name: 'This reset link is incomplete',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ask for a new link' }),
    ).toHaveAttribute('href', '/patient/forgot-password')
  })
})
