import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fetchSchedule, updateAppointment } from './api/schedule'
import { DEMO_DATE } from './config'
import { renderWithQuery } from './test/render'

// Two people at once: this desk has a visit on screen, and someone else
// (another desk, or the patient's phone) changes it first. Their change is
// made through the API directly, as another tab would, so this tab doesn't
// know yet. Nobody's change may be silently overwritten.
const LENA = 'a-07' // Lena Ortiz, confirmed, Chair 2, 9:45

async function lena() {
  const day = await fetchSchedule('maple', DEMO_DATE)
  return day.appointments.find((a) => a.id === LENA)!
}

// Someone else saves, based on the visit as it is now.
async function someoneElseSaves(
  patch: Parameters<typeof updateAppointment>[2],
) {
  const { version } = await lena()
  await updateAppointment('maple', LENA, { ...patch, version })
}

async function openLena(user: UserEvent) {
  renderWithQuery(<App />) // front desk
  await user.click(await screen.findByRole('button', { name: /^Lena Ortiz,/ }))
  return screen.getByRole('dialog', { name: /Lena Ortiz/ })
}

const notesBox = (dialog: HTMLElement) =>
  within(dialog).getByLabelText(/front desk notes/i)

describe('when someone else changed the visit first', () => {
  it('refuses a status change and shows their change instead', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)
    await someoneElseSaves({ notes: 'Called: running 10 min late.' })

    await user.click(within(dialog).getByRole('button', { name: /check in/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /someone else changed this visit/i,
    )
    expect((await lena()).status).toBe('confirmed')
    // The drawer reloads the visit, so their note is there to read.
    expect(
      await within(dialog).findByDisplayValue('Called: running 10 min late.'),
    ).toBeInTheDocument()
  })

  it('keeps your notes when theirs changed while you typed, and Use theirs takes theirs', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)

    await user.type(notesBox(dialog), 'Mine.')
    await someoneElseSaves({ notes: 'Theirs.' })
    await user.tab() // leaving the box saves

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(/someone else changed these notes/i)
    expect(alert).toHaveTextContent('Theirs.')
    expect(notesBox(dialog)).toHaveValue('Mine.')
    expect((await lena()).notes).toBe('Theirs.')

    await user.click(within(alert).getByRole('button', { name: 'Use theirs' }))

    expect(notesBox(dialog)).toHaveValue('Theirs.')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect((await lena()).notes).toBe('Theirs.')
  })

  it('saves your notes over theirs only when you choose Save mine', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)

    await user.type(notesBox(dialog), 'Mine.')
    await someoneElseSaves({ notes: 'Theirs.' })
    await user.tab()

    const alert = await within(dialog).findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: 'Save mine' }))

    expect(await within(dialog).findByText('Saved')).toBeInTheDocument()
    expect((await lena()).notes).toBe('Mine.')
  })

  it('saves your notes when they changed something else, keeping their change', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)

    await user.type(notesBox(dialog), 'Mine.')
    await someoneElseSaves({ status: 'arrived' })
    await user.tab()

    expect(await within(dialog).findByText('Saved')).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    const saved = await lena()
    expect(saved.notes).toBe('Mine.')
    expect(saved.status).toBe('arrived')
  })

  it('shows notes someone else saved before you started typing', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)
    await someoneElseSaves({ notes: 'Theirs.' })

    // Any refetch (here: ticking a box) brings their notes into the box.
    await user.click(
      within(dialog).getByRole('checkbox', { name: /insurance verified/i }),
    )

    await waitFor(() => expect(notesBox(dialog)).toHaveValue('Theirs.'))
  })

  it('refuses Undo of a status change if the visit changed since', async () => {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^Lena Ortiz,/ })
    await user.click(screen.getByRole('tab', { name: /patient flow/i }))
    await user.click(
      screen.getByRole('button', { name: /check in lena ortiz/i }),
    )
    await screen.findByText('Lena Ortiz: Arrived')
    await someoneElseSaves({ notes: 'Seated early by Dr. Okafor.' })

    await user.click(
      screen.getByRole('button', { name: /undo check-in for lena ortiz/i }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /someone else changed this visit/i,
    )
    expect((await lena()).status).toBe('arrived')
  })

  it('refuses Undo of a move if the visit changed since', async () => {
    const user = userEvent.setup()
    const dialog = await openLena(user)
    await user.click(within(dialog).getByRole('button', { name: 'Move to…' }))
    await user.click(within(dialog).getAllByRole('radio')[0]) // 11:30, Chair 2
    await user.click(within(dialog).getByRole('button', { name: 'Move visit' }))
    await screen.findByText('Lena Ortiz: moved to 11:30 AM, Chair 2')
    await someoneElseSaves({ notes: 'Moved at her request.' })

    await user.click(
      screen.getByRole('button', { name: 'Undo move for Lena Ortiz' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /someone else changed this visit/i,
    )
    expect((await lena()).start).toBe(`${DEMO_DATE}T11:30:00`)
  })
})
