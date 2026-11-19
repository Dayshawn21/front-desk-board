import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { MOCK_DB_KEY, updateAppointment } from './api/schedule'
import { renderWithQuery } from './test/render'

// Another tab changing data: the change goes through the mock API (as the
// other tab's save would), then the browser's "storage" event tells this tab.
async function changeInAnotherTab(save: () => Promise<unknown>) {
  await save()
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: MOCK_DB_KEY }))
  })
}

const lenaCard = () => screen.getByRole('button', { name: /^Lena Ortiz,/ })

describe('live updates between tabs', () => {
  it('shows a change made in another tab without a reload', async () => {
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^Lena Ortiz,.*Confirmed/ })

    await changeInAnotherTab(() =>
      updateAppointment('maple', 'a-07', { status: 'arrived' }),
    )

    expect(
      await screen.findByRole('button', { name: /^Lena Ortiz,.*Arrived/ }),
    ).toBeInTheDocument()
  })
})

describe('reset demo data', () => {
  async function openMenu() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /account menu/i }))
    return user
  }

  it('is in the account menu and puts the demo back to its start', async () => {
    await updateAppointment('maple', 'a-07', { status: 'arrived' })
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^Lena Ortiz,.*Arrived/ })

    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }))

    expect(
      await screen.findByRole('button', { name: /^Lena Ortiz,.*Confirmed/ }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Demo data reset')).toBeInTheDocument()
    // The menu closes and focus goes back to its button.
    expect(
      screen.queryByRole('group', { name: /account details/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveFocus()
  })

  it('says it affects every open tab', async () => {
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^Lena Ortiz,/ })

    await openMenu()

    const panel = screen.getByRole('group', { name: /account details/i })
    expect(
      within(panel).getByRole('button', { name: 'Reset demo data' }),
    ).toHaveAccessibleDescription(/every open tab/i)
    expect(lenaCard()).toBeInTheDocument()
  })
})
