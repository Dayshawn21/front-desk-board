import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

const STORAGE_KEY = 'front-desk-board.userId'

async function signInAs(name: RegExp) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name }))
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
  return user
}

describe('sign in', () => {
  it('starts on a sign-in page listing the three demo users', () => {
    renderWithQuery(<App />, { signedOut: true })

    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/demo sign-in/i)).toBeInTheDocument()
    for (const name of [/rosa jimenez/i, /amara okafor/i, /theo grant/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('shows each user with their role and practice', () => {
    renderWithQuery(<App />, { signedOut: true })

    expect(
      screen.getByRole('button', { name: /rosa jimenez.*front desk/i }),
    ).toHaveAccessibleName(/maple street dental/i)
    expect(
      screen.getByRole('button', { name: /theo grant.*office manager/i }),
    ).toBeInTheDocument()
  })

  it('signs in as the picked user and shows who is signed in', async () => {
    renderWithQuery(<App />, { signedOut: true })
    await signInAs(/rosa jimenez/i)

    expect(screen.getByText(/signed in as/i)).toHaveTextContent(
      /rosa jimenez.*front desk/i,
    )
    expect(screen.getByLabelText(/^practice/i)).toBeDisabled()
    expect(
      screen.getByRole('heading', { level: 1, name: /front desk board/i }),
    ).toHaveFocus()
  })

  it('no longer has an "Acting as" role switcher', async () => {
    renderWithQuery(<App />, { signedOut: true })
    await signInAs(/rosa jimenez/i)

    expect(screen.queryByLabelText(/acting as/i)).not.toBeInTheDocument()
  })

  it('lets the office manager switch practices', async () => {
    renderWithQuery(<App />, { signedOut: true })
    await signInAs(/theo grant/i)

    expect(screen.getByLabelText(/^practice/i)).toBeEnabled()
  })

  it('gives a provider the provider actions', async () => {
    renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/amara okafor/i)

    await user.click(screen.getByRole('tab', { name: /patient flow/i }))
    expect(
      screen.getByRole('button', { name: /seat in chair jon kim/i }),
    ).toBeInTheDocument()
  })
})

describe('sign out', () => {
  it('returns to the sign-in page and moves focus to its heading', async () => {
    renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/rosa jimenez/i)

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(screen.getByRole('heading', { name: /sign in/i })).toHaveFocus()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  it('lets a different user sign in afterwards', async () => {
    renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/rosa jimenez/i)
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await signInAs(/theo grant/i)

    expect(screen.getByText(/signed in as/i)).toHaveTextContent(/theo grant/i)
    expect(screen.getByLabelText(/^practice/i)).toBeEnabled()
  })

  it('starts the next user back at their home practice', async () => {
    renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/theo grant/i)
    await user.selectOptions(screen.getByLabelText(/^practice/i), 'riverbend')
    await user.click(screen.getByRole('button', { name: /sign out/i }))

    await signInAs(/rosa jimenez/i)

    expect(screen.getByLabelText(/^practice/i)).toHaveValue('maple')
  })

  it("drops the cached schedule so the next user can't see stale data", async () => {
    const { client } = renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/rosa jimenez/i)
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(client.getQueryCache().getAll()).toHaveLength(0)
  })
})

describe('remembered sign-in (this tab only)', () => {
  it('stays signed in after a reload', async () => {
    const first = renderWithQuery(<App />, { signedOut: true })
    await signInAs(/theo grant/i)
    first.unmount()

    renderWithQuery(<App />, { restoreSession: true })

    expect(await screen.findByText(/signed in as/i)).toHaveTextContent(
      /theo grant/i,
    )
  })

  it('forgets the user after sign out', async () => {
    renderWithQuery(<App />, { signedOut: true })
    const user = await signInAs(/rosa jimenez/i)
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('u-rosa')

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores a remembered id that is not a demo user', () => {
    sessionStorage.setItem(STORAGE_KEY, 'u-made-up')
    renderWithQuery(<App />, { restoreSession: true })

    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument()
  })

  it('still signs in when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    renderWithQuery(<App />, { signedOut: true })

    await signInAs(/rosa jimenez/i)

    await waitFor(() =>
      expect(screen.getByText(/signed in as/i)).toBeInTheDocument(),
    )
  })
})
