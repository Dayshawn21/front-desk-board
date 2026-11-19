import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fetchSchedule, MOCK_DB_KEY, updateAppointment } from './api/schedule'
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

describe('check-in drawer while another tab changes the visit', () => {
  // a-11: Ravi Menon, Scheduled, only "Insurance verified" ticked.
  const ravisChecklist = {
    insuranceVerified: true,
    formsComplete: false,
    medicalHistoryReviewed: false,
    copayCollected: false,
  }

  async function openRavi() {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await user.click(
      await screen.findByRole('button', { name: /^Ravi Menon,/ }),
    )
    const drawer = screen.getByRole('dialog', { name: /Ravi Menon/ })
    return { user, drawer }
  }

  it("shows the patient's tick from their phone while the drawer is open", async () => {
    const { drawer } = await openRavi()
    const forms = within(drawer).getByRole('checkbox', {
      name: 'Forms complete',
    })
    expect(forms).not.toBeChecked()

    await changeInAnotherTab(() =>
      updateAppointment('maple', 'a-11', {
        status: 'arrived',
        checklist: { ...ravisChecklist, formsComplete: true },
      }),
    )

    await waitFor(() => expect(forms).toBeChecked())
    expect(
      within(drawer).getByRole('heading', { name: 'Status: Arrived' }),
    ).toBeInTheDocument()
  })

  it("doesn't undo the patient's tick when the desk ticks another box", async () => {
    const { user, drawer } = await openRavi()

    // The patient ticks forms; this tab hasn't refetched yet.
    await updateAppointment('maple', 'a-11', {
      checklist: { ...ravisChecklist, formsComplete: true },
    })
    await user.click(
      within(drawer).getByRole('checkbox', { name: 'Copay collected' }),
    )

    await waitFor(async () => {
      const day = await fetchSchedule('maple', '2026-11-17')
      expect(day.appointments.find((a) => a.id === 'a-11')?.checklist).toEqual({
        ...ravisChecklist,
        formsComplete: true,
        copayCollected: true,
      })
    })
    expect(
      within(drawer).getByRole('checkbox', { name: 'Forms complete' }),
    ).toBeChecked()
  })

  it('puts a tick back when it could not be saved', async () => {
    window.history.replaceState(null, '', '/?failSave')
    const { user, drawer } = await openRavi()
    const copay = within(drawer).getByRole('checkbox', {
      name: 'Copay collected',
    })

    await user.click(copay)

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      /could not save/i,
    )
    expect(copay).not.toBeChecked()
  })
})
