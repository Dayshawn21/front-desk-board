import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

async function openPatient(user: UserEvent, name: RegExp) {
  renderWithQuery(<App />) // front desk, the default role
  await user.click(await screen.findByRole('button', { name }))
  return screen.getByRole('dialog', { name })
}

const openJonKim = (user: UserEvent) => openPatient(user, /jon kim/i)
const openLenaOrtiz = (user: UserEvent) => openPatient(user, /lena ortiz/i)

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
    const dialog = await openLenaOrtiz(user)

    await user.click(within(dialog).getByRole('button', { name: /check in/i }))

    expect(
      await screen.findByRole('button', { name: /lena ortiz.*arrived/i }),
    ).toBeInTheDocument()
    // Seating is a provider step, so front desk sees an explanation, not a button.
    expect(
      within(dialog).queryByRole('button', { name: /seat in chair/i }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText(/not available to front desk/i),
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
    const dialog = await openLenaOrtiz(user)

    await user.click(within(dialog).getByRole('button', { name: /check in/i }))

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
