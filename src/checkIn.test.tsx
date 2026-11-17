import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

async function openJonKim(user: UserEvent) {
  renderWithQuery(<App />)
  await user.click(await screen.findByRole('button', { name: /jon kim/i }))
  return screen.getByRole('dialog', { name: /jon kim/i })
}

describe('check-in drawer', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('opens with the visit details, checklist and conflict', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    expect(within(dialog).getByText(/checklist · 2 of 4/i)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('checkbox', { name: /insurance verified/i }),
    ).toBeChecked()
    expect(
      within(dialog).getByRole('checkbox', { name: /copay collected/i }),
    ).not.toBeChecked()
    expect(within(dialog).getByText(/overlaps lena ortiz/i)).toBeInTheDocument()
  })

  it('advances the status, and the grid updates', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.click(
      within(dialog).getByRole('button', { name: /seat in chair/i }),
    )

    expect(
      await screen.findByRole('button', { name: /jon kim.*in chair/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /check out/i }),
    ).toBeInTheDocument()
  })

  it('saves the checklist and notes so they are there when reopened', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.click(
      within(dialog).getByRole('checkbox', { name: /copay collected/i }),
    )
    await user.type(
      within(dialog).getByLabelText(/front desk notes/i),
      ' Paid at desk.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: /save checklist and notes/i }),
    )
    // Saved once the button is disabled again (no unsaved changes left).
    await expect
      .poll(() =>
        within(dialog).getByRole('button', { name: /save checklist/i }),
      )
      .toBeDisabled()

    await user.click(
      within(dialog).getByRole('button', { name: /close check-in/i }),
    )
    await user.click(screen.getByRole('button', { name: /jon kim/i }))

    const reopened = screen.getByRole('dialog', { name: /jon kim/i })
    expect(
      within(reopened).getByRole('checkbox', { name: /copay collected/i }),
    ).toBeChecked()
    expect(within(reopened).getByLabelText(/front desk notes/i)).toHaveValue(
      'Asked to confirm copay amount before visit. Paid at desk.',
    )
  })

  it('shows an error when saving fails', async () => {
    window.history.replaceState(null, '', '/?failSave')
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.click(
      within(dialog).getByRole('button', { name: /seat in chair/i }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /could not save/i,
    )
  })

  it('closes with the close button', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.click(
      within(dialog).getByRole('button', { name: /close check-in/i }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
