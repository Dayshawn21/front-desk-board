import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

// The check-in drawer traps Tab, and the toast sits outside it. So while
// the drawer is open, the Undo for this visit's latest change is offered
// inside the drawer, where a keyboard user can reach it.

async function renderBoard() {
  renderWithQuery(<App />, { role: 'front-desk' })
  await screen.findByRole('button', { name: /^jon kim,/i })
}

async function openDrawer(user: UserEvent, name: string) {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`) }),
  )
  return screen.getByRole('dialog', { name })
}

async function moveLena(user: UserEvent) {
  const drawer = await openDrawer(user, 'Lena Ortiz')
  await user.click(within(drawer).getByRole('button', { name: 'Move to…' }))
  await user.click(
    within(drawer).getByRole('radio', { name: /^11:30 AM.*Chair 2$/ }),
  )
  await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))
  await within(drawer).findByText('Last change: moved to 11:30 AM, Chair 2')
  return drawer
}

describe('Undo inside the check-in drawer', () => {
  it('offers Undo for a move inside the drawer, and the keyboard reaches it', async () => {
    const user = userEvent.setup()
    await renderBoard()
    const drawer = await moveLena(user)

    const undo = within(drawer).getByRole('button', {
      name: 'Undo move for Lena Ortiz',
    })
    // Only one Undo: the toast's own button steps aside while the drawer has it.
    expect(
      screen.getAllByRole('button', { name: 'Undo move for Lena Ortiz' }),
    ).toHaveLength(1)

    undo.focus()
    await user.keyboard('{Enter}')

    const done = await within(drawer).findByText(
      'Last change: move undone, back at 9:45 AM, Chair 2',
    )
    // The button is gone, so focus lands on the line that says what happened.
    expect(done).toHaveFocus()
    expect(
      screen.queryByRole('button', { name: /undo move/i }),
    ).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(drawer).getByText(/Exam · Chair 2 · 9:45 AM – 10:30 AM/),
      ).toBeInTheDocument(),
    )
  })

  it('offers Undo for a payment inside the drawer', async () => {
    const user = userEvent.setup()
    await renderBoard()
    const drawer = await openDrawer(user, 'Ana Diaz')
    const billing = within(
      within(drawer).getByRole('region', { name: 'Billing' }),
    )
    await user.clear(billing.getByLabelText('Amount'))
    await user.type(billing.getByLabelText('Amount'), '50')
    await user.click(billing.getByRole('button', { name: 'Record payment' }))

    await within(drawer).findByText('Last change: $50.00 paid by card')
    await user.click(
      within(drawer).getByRole('button', { name: 'Undo payment for Ana Diaz' }),
    )
    expect(
      await within(drawer).findByText('Last change: payment of $50.00 undone'),
    ).toHaveFocus()
  })

  it('offers Undo for a cancel inside the drawer', async () => {
    const user = userEvent.setup()
    await renderBoard()
    const drawer = await openDrawer(user, 'Owen Hart')
    await user.click(
      within(drawer).getByRole('button', { name: 'Cancel visit…' }),
    )
    await user.click(
      within(drawer).getByRole('radio', { name: /late cancel/i }),
    )
    await user.click(
      within(drawer).getByRole('button', { name: /^cancel visit$/i }),
    )

    await within(drawer).findByText('Last change: cancelled, late cancel')
    await user.click(
      within(drawer).getByRole('button', { name: 'Undo cancel for Owen Hart' }),
    )
    expect(
      await within(drawer).findByRole('heading', {
        name: /status: scheduled/i,
      }),
    ).toBeInTheDocument()
  })

  it("doesn't show another visit's change", async () => {
    const user = userEvent.setup()
    await renderBoard()
    await moveLena(user)
    await user.keyboard('{Escape}')

    // Back on the board, the toast's Undo is there again.
    expect(
      screen.getByRole('button', { name: 'Undo move for Lena Ortiz' }),
    ).toBeInTheDocument()

    const jon = await openDrawer(user, 'Jon Kim')
    expect(within(jon).queryByText(/^Last change:/)).not.toBeInTheDocument()
  })
})
