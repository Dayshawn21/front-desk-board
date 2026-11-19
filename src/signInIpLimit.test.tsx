import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import { signInWithForm } from './test/patient'

// Every patient sign-in try first asks our server route, which limits
// tries per IP address. Over the limit, the form says so and the password
// is never checked.

function openSignIn() {
  window.history.pushState(null, '', '/patient')
  const user = userEvent.setup()
  renderWithQuery(<App />, { signedOut: true })
  return user
}

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('the per-IP sign-in limit, on the form', () => {
  it('asks the server route before each try', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(204))
    const user = openSignIn()
    await signInWithForm(user, 'owen.hart@example.com')

    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/patient-sign-in')
    expect(init?.method).toBe('POST')
    // The route only counts tries: no email or password is sent to it.
    expect(init?.body).toBeUndefined()
  })

  it('shows the network limit and does not sign in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(429, {
        error:
          'Too many sign-in attempts from your network. Try again in 15 minutes.',
      }),
    )
    const user = openSignIn()
    await signInWithForm(user, 'owen.hart@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-in attempts from your network. Try again in 15 minutes.',
    )
    expect(
      screen.queryByRole('heading', { name: 'Your visits' }),
    ).not.toBeInTheDocument()
    // Not a password problem, so no reset link.
    expect(
      screen.queryByRole('link', { name: 'Reset your password' }),
    ).not.toBeInTheDocument()
  })

  it('uses a plain message if the 429 has no body (the firewall answers first)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(429))
    const user = openSignIn()
    await signInWithForm(user, 'owen.hart@example.com')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-in attempts from your network. Wait a few minutes and try again.',
    )
  })

  it('still signs in where the route is missing (a static preview)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(404))
    const user = openSignIn()
    await signInWithForm(user, 'owen.hart@example.com')
    expect(
      await screen.findByRole('heading', { name: 'Your visits' }),
    ).toBeInTheDocument()
  })
})
