import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

async function renderAs(role: Role = 'front-desk') {
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
}

async function openFlowTab(user: UserEvent) {
  await user.click(screen.getByRole('tab', { name: /patient flow/i }))
}

const column = (label: RegExp) => screen.getByRole('region', { name: label })

describe('undo', () => {
  it('offers Undo in a toast after a status change, and undoing restores it', async () => {
    const user = userEvent.setup()
    await renderAs()
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check in lena ortiz/i }),
    )
    expect(await screen.findByText('Lena Ortiz: Arrived')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /undo check-in for lena ortiz/i }),
    )

    expect(
      await screen.findByText('Lena Ortiz: moved back to Confirmed'),
    ).toBeInTheDocument()
    expect(
      within(column(/^expected/i)).getByText('Lena Ortiz'),
    ).toBeInTheDocument()
    // No "undo the undo": the follow-up toast has no Undo button.
    expect(
      screen.queryByRole('button', { name: /^undo/i }),
    ).not.toBeInTheDocument()
  })

  it('does not offer Undo for a checkout to front desk (reopening is manager-only)', async () => {
    const user = userEvent.setup()
    await renderAs('front-desk')
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check out marcus bell/i }),
    )

    expect(
      await screen.findByText('Marcus Bell: Checked out'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /reopen visit/i }),
    ).not.toBeInTheDocument()
  })

  it('offers Reopen visit in the toast to the office manager', async () => {
    const user = userEvent.setup()
    await renderAs('office-manager')
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check out marcus bell/i }),
    )

    expect(
      await screen.findByRole('button', {
        name: /reopen visit for marcus bell/i,
      }),
    ).toBeInTheDocument()
  })

  it('moves a visit back from the drawer', async () => {
    const user = userEvent.setup()
    await renderAs('front-desk')

    await user.click(screen.getByRole('button', { name: /jon kim/i }))
    const dialog = screen.getByRole('dialog', { name: /jon kim/i })
    await user.click(
      within(dialog).getByRole('button', { name: /undo check-in/i }),
    )

    expect(
      await screen.findByRole('button', { name: /jon kim.*confirmed/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: /status: confirmed/i }),
    ).toBeInTheDocument()
  })

  it('hides Reopen visit in the drawer unless you are the office manager', async () => {
    const user = userEvent.setup()
    await renderAs('front-desk')

    await user.click(screen.getByRole('button', { name: /ana diaz/i })) // checked out
    const dialog = screen.getByRole('dialog', { name: /ana diaz/i })

    expect(
      within(dialog).queryByRole('button', { name: /reopen visit/i }),
    ).not.toBeInTheDocument()
  })

  it('closes the toast with Dismiss', async () => {
    const user = userEvent.setup()
    await renderAs()
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check in lena ortiz/i }),
    )
    await screen.findByText('Lena Ortiz: Arrived')
    await user.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(screen.queryByText('Lena Ortiz: Arrived')).not.toBeInTheDocument()
  })
})
