import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

// What a visitor sees first: the sign-in page and the top of the board.

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

async function renderBoard() {
  const user = userEvent.setup()
  renderWithQuery(<App />)
  await screen.findByRole('button', { name: /^jon kim,/i }) // schedule loaded
  return user
}

describe('sign-in page', () => {
  it('says what each demo role can do', () => {
    renderWithQuery(<App />, { signedOut: true })

    expect(
      screen.getByRole('button', { name: /rosa jimenez/i }),
    ).toHaveAccessibleName(
      /checks patients in, books, moves and cancels visits/i,
    )
    expect(
      screen.getByRole('button', { name: /amara okafor/i }),
    ).toHaveAccessibleName(/seats patients; the checklist is read-only/i)
    expect(
      screen.getByRole('button', { name: /theo grant/i }),
    ).toHaveAccessibleName(/everything, plus switching practices/i)
  })
})

describe('top of the board', () => {
  it('puts New appointment on the same row as the view tabs', async () => {
    await renderBoard()

    const tabRow = screen.getByRole('tablist', { name: 'Views' }).parentElement!
    expect(
      within(tabRow).getByRole('button', { name: 'New appointment' }),
    ).toBeInTheDocument()
  })

  it('opens a visit from its name in the conflict banner', async () => {
    const user = await renderBoard()

    const banner = screen.getByText('1 scheduling conflict').parentElement!
    await user.click(within(banner).getByRole('button', { name: 'Lena Ortiz' }))

    expect(
      screen.getByRole('dialog', { name: 'Lena Ortiz' }),
    ).toBeInTheDocument()
  })

  it('opens a cancelled visit from the Cancelled today list', async () => {
    const user = await renderBoard()
    await user.click(screen.getByRole('button', { name: /^owen hart,/i }))
    await user.click(screen.getByRole('button', { name: 'Cancel visit…' }))
    await user.click(screen.getByRole('radio', { name: 'Late cancel' }))
    await user.click(screen.getByRole('button', { name: /^cancel visit$/i }))
    await screen.findByText('Owen Hart: cancelled, late cancel')
    await user.keyboard('{Escape}')

    await user.click(
      screen.getByRole('button', { name: 'Owen Hart (11:15 AM, late cancel)' }),
    )

    expect(
      within(screen.getByRole('dialog', { name: 'Owen Hart' })).getByRole(
        'heading',
        { name: 'Status: Cancelled' },
      ),
    ).toBeInTheDocument()
  })

  it('has a status key for the schedule colours', async () => {
    await renderBoard()

    const key = screen.getByRole('list', { name: 'Status key' })
    expect(
      within(key)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Scheduled',
      'Confirmed',
      'Arrived',
      'In chair',
      'Checked out',
      'No-show',
    ])
  })
})

describe('error screen', () => {
  it('offers a way back to sign-in', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.history.replaceState(null, '', '/?crash')
    const user = userEvent.setup()
    renderWithQuery(<App />)

    await user.click(
      await screen.findByRole('button', { name: 'Back to sign-in' }),
    )

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
