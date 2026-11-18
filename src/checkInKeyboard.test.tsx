import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

async function openWithKeyboard(user: UserEvent, name: RegExp, role?: Role) {
  renderWithQuery(<App />, { role })
  const card = await screen.findByRole('button', { name })
  card.focus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name })
  return { card, dialog }
}

const openJonKimWithKeyboard = (user: UserEvent, role?: Role) =>
  openWithKeyboard(user, /jon kim/i, role)

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
    // Office manager can take every step, so the button stays after the save.
    const { dialog } = await openJonKimWithKeyboard(user, 'office-manager')

    const statusButton = within(dialog).getByRole('button', {
      name: /seat in chair/i,
    })
    statusButton.focus()
    await user.keyboard('{Enter}')

    expect(
      await within(dialog).findByRole('button', { name: /check out/i }),
    ).toHaveFocus()
  })

  it('moves focus to the status heading when the next step is not allowed', async () => {
    const user = userEvent.setup()
    const { dialog } = await openWithKeyboard(user, /lena ortiz/i) // front desk

    within(dialog)
      .getByRole('button', { name: /check in/i })
      .focus()
    await user.keyboard('{Enter}')

    // Front desk can't seat, so the button is gone; focus must not fall out of the drawer.
    expect(
      await within(dialog).findByRole('heading', { name: /status: arrived/i }),
    ).toHaveFocus()
  })
})
