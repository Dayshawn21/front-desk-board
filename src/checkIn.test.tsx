import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { fetchSchedule } from './api/schedule'
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

  it('saves a checklist tick right away, so closing never loses it', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.click(
      within(dialog).getByRole('checkbox', { name: /copay collected/i }),
    )
    expect(await within(dialog).findByText('Saved')).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: /save/i }),
    ).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /jon kim/i }))
    expect(
      within(screen.getByRole('dialog', { name: /jon kim/i })).getByRole(
        'checkbox',
        { name: /copay collected/i },
      ),
    ).toBeChecked()
  })

  it('saves notes when you leave the field', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.type(
      within(dialog).getByLabelText(/front desk notes/i),
      ' Paid at desk.',
    )
    expect(within(dialog).queryByText('Saved')).not.toBeInTheDocument()
    await user.tab()

    expect(await within(dialog).findByText('Saved')).toBeInTheDocument()
  })

  it('saves notes still being typed when the drawer closes', async () => {
    const user = userEvent.setup()
    const dialog = await openJonKim(user)

    await user.type(
      within(dialog).getByLabelText(/front desk notes/i),
      ' Paid at desk.',
    )
    await user.keyboard('{Escape}') // straight from the notes box

    await waitFor(async () => {
      const day = await fetchSchedule('maple', '2026-11-17')
      expect(day.appointments.find((a) => a.id === 'a-06')?.notes).toBe(
        'Asked to confirm copay amount before visit. Paid at desk.',
      )
    })
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
