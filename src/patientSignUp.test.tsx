import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import { signInWithForm } from './test/patient'

// /patient/sign-up: a new patient creates an account, and lands on their
// (empty) "Your visits", signed in.
function openAt(path: string) {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

async function fillIn(
  user: ReturnType<typeof userEvent.setup>,
  { email = 'zoe.quill@example.com', password = 'correct horse' } = {},
) {
  await user.click(
    await screen.findByRole('radio', { name: /Riverbend Family Dental/ }),
  )
  await user.type(screen.getByLabelText('First name'), 'Zoe')
  await user.type(screen.getByLabelText('Last name'), 'Quill')
  await user.type(screen.getByLabelText('Phone'), '555-0199')
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
}

describe('patient sign-up', () => {
  it('is a proper sign-up form', async () => {
    openAt('/patient/sign-up')
    expect(
      await screen.findByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    const offices = screen.getByRole('radiogroup', {
      name: 'Your dental office',
    })
    expect(within(offices).getAllByRole('radio')).toHaveLength(2)
    expect(screen.getByLabelText('First name')).toHaveAttribute(
      'autocomplete',
      'given-name',
    )
    expect(screen.getByLabelText('Last name')).toHaveAttribute(
      'autocomplete',
      'family-name',
    )
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    expect(password).toHaveAttribute('autocomplete', 'new-password')
    expect(password).toHaveAttribute('minlength', '8')
    expect(password).toHaveAccessibleDescription(/at least 8 characters/i)
    // A demo: it asks for made-up details.
    expect(screen.getByText(/made-up name/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/patient',
    )
  })

  it('creates the account and signs the patient in', async () => {
    const { user } = openAt('/patient/sign-up')
    await fillIn(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const heading = await screen.findByRole('heading', { name: 'Your visits' })
    expect(heading).toHaveFocus()
    expect(screen.getByText(/Hi Zoe/)).toBeInTheDocument()
    expect(screen.getByText('Riverbend Family Dental')).toBeInTheDocument()
    expect(screen.getByText('You have no visits today.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Book a visit' })).toHaveAttribute(
      'href',
      '/book/riverbend',
    )
    expect(window.location.pathname).toBe('/patient')
  })

  it('can sign in with the new account later', async () => {
    const first = openAt('/patient/sign-up')
    await fillIn(first.user)
    await first.user.click(
      screen.getByRole('button', { name: 'Create account' }),
    )
    await screen.findByRole('heading', { name: 'Your visits' })
    await first.user.click(screen.getByRole('button', { name: 'Sign out' }))
    first.unmount()

    const second = openAt('/patient')
    await signInWithForm(second.user, 'zoe.quill@example.com', 'correct horse')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()
  })

  it('says so when the email already has an account', async () => {
    const { user } = openAt('/patient/sign-up')
    await fillIn(user, { email: 'owen.hart@example.com' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with that email already exists. Sign in instead.',
    )
    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    // What was typed is kept, except the password.
    expect(screen.getByLabelText('First name')).toHaveValue('Zoe')
  })

  it('says what to fix when the server refuses a field', async () => {
    const { user } = openAt('/patient/sign-up')
    // Long enough for the browser's own check, but the server checks too.
    await fillIn(user, { email: 'zoe@nodot' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter an email like name@example.com.',
    )
  })

  it('is linked from the sign-in form', async () => {
    openAt('/patient')
    expect(
      await screen.findByRole('link', { name: /create an account/i }),
    ).toHaveAttribute('href', '/patient/sign-up')
  })

  it('says so when already signed in', async () => {
    const first = openAt('/patient')
    await signInWithForm(first.user, 'owen.hart@example.com')
    await screen.findByRole('heading', { name: 'Your visits' })
    first.unmount()

    openAt('/patient/sign-up')
    expect(
      await screen.findByRole('heading', {
        name: "You're signed in as Owen Hart",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'See your visits' }),
    ).toHaveAttribute('href', '/patient')
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })
})
