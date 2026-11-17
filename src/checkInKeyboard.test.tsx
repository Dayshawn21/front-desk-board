import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

async function openJonKimWithKeyboard(user: UserEvent) {
  renderWithQuery(<App />)
  const card = await screen.findByRole('button', { name: /jon kim/i })
  card.focus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: /jon kim/i })
  return { card, dialog }
}

describe('check-in drawer keyboard support', () => {
  it('moves focus into the drawer when it opens', async () => {
    const user = userEvent.setup()
    const { dialog } = await openJonKimWithKeyboard(user)

    expect(
      within(dialog).getByRole('button', { name: /close check-in/i }),
    ).toHaveFocus()
  })

  it('closes on Escape and returns focus to the card', async () => {
    const user = userEvent.setup()
    const { card } = await openJonKimWithKeyboard(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(card).toHaveFocus()
  })

  it('returns focus to the card when closed with the close button', async () => {
    const user = userEvent.setup()
    const { card, dialog } = await openJonKimWithKeyboard(user)

    await user.click(
      within(dialog).getByRole('button', { name: /close check-in/i }),
    )

    expect(card).toHaveFocus()
  })

  it('wraps Tab from the last control back to the first', async () => {
    const user = userEvent.setup()
    const { dialog } = await openJonKimWithKeyboard(user)

    // The save button is disabled (no changes yet), so the notes box is the last control.
    within(dialog)
      .getByLabelText(/front desk notes/i)
      .focus()
    await user.tab()

    expect(
      within(dialog).getByRole('button', { name: /close check-in/i }),
    ).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    const user = userEvent.setup()
    const { dialog } = await openJonKimWithKeyboard(user)

    await user.tab({ shift: true })

    expect(within(dialog).getByLabelText(/front desk notes/i)).toHaveFocus()
  })

  it('keeps focus on the status button while it saves', async () => {
    const user = userEvent.setup()
    const { dialog } = await openJonKimWithKeyboard(user)

    const statusButton = within(dialog).getByRole('button', {
      name: /seat in chair/i,
    })
    statusButton.focus()
    await user.keyboard('{Enter}')

    expect(
      await within(dialog).findByRole('button', { name: /check out/i }),
    ).toHaveFocus()
  })
})
