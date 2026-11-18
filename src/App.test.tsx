import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

describe('App', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('shows a loading state, then the schedule', async () => {
    renderWithQuery(<App />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading schedule/i)
    expect(
      await screen.findByRole('button', { name: /jon kim, filling/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Chair 2')).toBeInTheDocument()
  })

  it('shows an error with a retry button when the API fails', async () => {
    window.history.replaceState(null, '', '/?fail')
    renderWithQuery(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load the schedule/i,
    )
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument()
  })

  it("switching practice shows only that practice's patients", async () => {
    const user = userEvent.setup()
    // Only the office manager may switch practices.
    renderWithQuery(<App />, { role: 'office-manager' })
    await screen.findByRole('button', { name: /jon kim/i })

    const practiceSelect = screen.getByLabelText(/practice/i)
    await waitFor(() => expect(practiceSelect).toBeEnabled())
    await user.selectOptions(practiceSelect, 'riverbend')

    expect(
      await screen.findByRole('button', { name: /hana sato/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /jon kim/i }),
    ).not.toBeInTheDocument()
  })

  it('flags overlapping appointments in the same chair', async () => {
    renderWithQuery(<App />)

    expect(
      await screen.findByRole('button', {
        name: /jon kim.*overlaps another appointment/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /lena ortiz.*overlaps another appointment/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 scheduling conflict/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /ana diaz.*overlaps/i }),
    ).not.toBeInTheDocument()
  })
})
