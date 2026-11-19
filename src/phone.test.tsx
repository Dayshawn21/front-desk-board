import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

// jsdom has no screen size, so pretend the screen is phone-width: every
// "(max-width: …)" media query matches, everything else (like the dark
// colour scheme) doesn't.
function pretendPhoneWidth() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

beforeEach(pretendPhoneWidth)
afterEach(() => vi.unstubAllGlobals())

async function renderBoard() {
  const user = userEvent.setup()
  renderWithQuery(<App />)
  await screen.findByText('1 scheduling conflict') // schedule loaded
  return user
}

const cardNamed = (name: string) =>
  screen.queryByRole('button', { name: new RegExp(`^${name},`, 'i') })

describe('schedule on a phone', () => {
  it('shows one chair at a time, starting with Chair 1', async () => {
    await renderBoard()

    const chairs = screen.getByRole('group', { name: 'Chair' })
    expect(
      within(chairs)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Chair 1', 'Chair 2', 'Chair 3'])
    expect(within(chairs).getByRole('radio', { name: 'Chair 1' })).toBeChecked()

    expect(cardNamed('Ana Diaz')).toBeInTheDocument() // Chair 1
    expect(cardNamed('Jon Kim')).not.toBeInTheDocument() // Chair 2
  })

  it('switches chairs', async () => {
    const user = await renderBoard()

    await user.click(screen.getByRole('radio', { name: 'Chair 2' }))

    expect(cardNamed('Jon Kim')).toBeInTheDocument()
    expect(cardNamed('Ana Diaz')).not.toBeInTheDocument()
  })
})

describe('patient flow on a phone', () => {
  it('shows one column at a time, starting with who is waiting', async () => {
    const user = await renderBoard()
    await user.click(screen.getByRole('tab', { name: /patient flow/i }))

    const columns = screen.getByRole('group', { name: 'Column' })
    expect(
      within(columns)
        .getAllByRole('radio')
        .map((r) => r.closest('label')?.textContent),
    ).toEqual(['Expected 10', 'Arrived 1', 'In chair 2', 'Checked out 2'])
    expect(
      within(columns).getByRole('radio', { name: 'Arrived 1' }),
    ).toBeChecked()
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('region', { name: /^arrived/i })).toHaveTextContent(
      'Jon Kim',
    )

    await user.click(
      within(columns).getByRole('radio', { name: 'Expected 10' }),
    )
    expect(
      screen.getByRole('region', { name: /^expected/i }),
    ).toHaveTextContent('Priya Shah')
  })
})
