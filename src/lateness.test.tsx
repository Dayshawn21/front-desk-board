import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

// The demo clock is 9:40. Priya Shah was due at 8:00 and hasn't arrived.

describe('late visits', () => {
  it('marks a late visit on the schedule, in its label too', async () => {
    renderWithQuery(<App />)

    const priya = await screen.findByRole('button', { name: /^priya shah,/i })
    expect(priya).toHaveAccessibleName(
      'Priya Shah, Confirmed, Cleaning, 8:00 AM to 9:00 AM, Late 1h 40m',
    )
    expect(priya).toHaveTextContent('Late 1h 40m')
    // Lena Ortiz is due at 9:45: not late. Jon Kim has arrived.
    expect(
      screen.getByRole('button', { name: /^lena ortiz,/i }),
    ).not.toHaveTextContent(/late/i)
    expect(
      screen.getByRole('button', { name: /^jon kim,/i }),
    ).not.toHaveTextContent(/late/i)
  })

  it('marks it on the patient flow board, at the top of Expected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^jon kim,/i })

    await user.click(screen.getByRole('tab', { name: /patient flow/i }))

    const expected = screen.getByRole('region', { name: /^expected/i })
    const first = within(expected).getAllByRole('article')[0]
    expect(first).toHaveTextContent('Priya Shah')
    expect(first).toHaveTextContent('Late 1h 40m')
  })
})
