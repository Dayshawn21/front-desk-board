import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { createAppointment } from './api/schedule'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

const DATE = '2026-11-17'

afterEach(() => window.history.replaceState(null, '', '/'))

async function renderAs(role: Role = 'front-desk') {
  const user = userEvent.setup()
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
  return user
}

async function openBooking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /new appointment/i }))
  return screen.getByRole('dialog', { name: /new appointment/i })
}

const times = (dialog: HTMLElement) =>
  within(dialog)
    .queryAllByRole('radio')
    .map((radio) => radio.closest('label')?.textContent ?? '')

describe('booking a visit', () => {
  it('is offered to front desk but not to a provider', async () => {
    await renderAs('provider')
    expect(
      screen.queryByRole('button', { name: /new appointment/i }),
    ).not.toBeInTheDocument()
  })

  it('opens a dialog with focus on the patient field', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    expect(within(dialog).getByLabelText(/patient/i)).toHaveFocus()
  })

  it('closes on Escape and returns focus to the New appointment button', async () => {
    const user = await renderAs()
    await openBooking(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /new appointment/i }),
    ).toHaveFocus()
  })

  it('suggests the three earliest open times from now (9:40 AM)', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    expect(times(dialog)).toEqual([
      expect.stringMatching(/11:30 AM.*12:00 PM.*chair 2/i),
      expect.stringMatching(/11:45 AM.*12:15 PM.*chair 2/i),
      expect.stringMatching(/11:45 AM.*12:15 PM.*chair 3/i),
    ])
  })

  it('updates the suggestions for a chosen chair and time of day', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.selectOptions(within(dialog).getByLabelText(/^chair/i), [
      'maple-c1',
    ])
    await user.selectOptions(
      within(dialog).getByLabelText(/time of day/i),
      'afternoon',
    )

    expect(times(dialog)).toEqual([
      expect.stringMatching(/12:00 PM.*chair 1/i),
      expect.stringMatching(/12:15 PM.*chair 1/i),
      expect.stringMatching(/12:30 PM.*chair 1/i),
    ])
  })

  it('sets a typical length for the visit type', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.selectOptions(
      within(dialog).getByLabelText(/visit type/i),
      'crown',
    )

    expect(within(dialog).getByLabelText(/length/i)).toHaveValue('90')
  })

  it('says so when nothing fits', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.selectOptions(
      within(dialog).getByLabelText(/^chair/i),
      'maple-c1',
    )
    await user.selectOptions(
      within(dialog).getByLabelText(/time of day/i),
      'morning',
    )
    await user.selectOptions(within(dialog).getByLabelText(/length/i), '90')

    expect(times(dialog)).toEqual([])
    expect(within(dialog).getByText(/no open times match/i)).toBeInTheDocument()
  })

  it('asks for a patient and a time before booking', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.click(within(dialog).getByRole('button', { name: /^book/i }))

    expect(within(dialog).getByText(/choose a patient/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/choose a time/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('books the visit, closes, confirms, and shows it on the schedule', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.selectOptions(within(dialog).getByLabelText(/patient/i), 'p-ana')
    await user.click(
      within(dialog).getByRole('radio', { name: /11:30 AM.*chair 2/i }),
    )
    await user.click(within(dialog).getByRole('button', { name: /^book/i }))

    expect(await screen.findByText(/booked ana diaz/i)).toHaveTextContent(
      /exam.*11:30 AM.*chair 2/i,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      await screen.findAllByRole('button', { name: /ana diaz/i }),
    ).toHaveLength(2) // her 8:00 cleaning and the new exam
  })

  it('keeps the form and shows the error when booking fails', async () => {
    window.history.replaceState(null, '', '/?failBook')
    const user = await renderAs()
    const dialog = await openBooking(user)

    await user.selectOptions(within(dialog).getByLabelText(/patient/i), 'p-ana')
    await user.click(
      within(dialog).getByRole('radio', { name: /11:30 AM.*chair 2/i }),
    )
    await user.click(within(dialog).getByRole('button', { name: /^book/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /could not book/i,
    )
    expect(within(dialog).getByLabelText(/patient/i)).toHaveValue('p-ana')
  })

  it('refreshes the times when someone else just took the slot', async () => {
    const user = await renderAs()
    const dialog = await openBooking(user)
    await user.selectOptions(within(dialog).getByLabelText(/patient/i), 'p-ana')
    await user.click(
      within(dialog).getByRole('radio', { name: /11:30 AM.*chair 2/i }),
    )

    // Another front desk screen books 11:30 in Chair 2 first.
    await createAppointment('maple', {
      patientId: 'p-owen',
      chairId: 'maple-c2',
      start: `${DATE}T11:30:00`,
      end: `${DATE}T12:00:00`,
      type: 'consult',
    })
    await user.click(within(dialog).getByRole('button', { name: /^book/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /just booked in chair 2/i,
    )
    expect(
      within(dialog).queryByRole('radio', { name: /11:30 AM.*chair 2/i }),
    ).not.toBeInTheDocument()
  })
})

describe('booking from the schedule (click an empty spot)', () => {
  const slotCell = (chairId: string, time: string) =>
    screen.queryByTestId(`slot-${chairId}-${time}`)

  it('opens New appointment with that chair and start time filled in', async () => {
    const user = await renderAs()

    await user.click(slotCell('maple-c1', '14:15')!)

    const dialog = screen.getByRole('dialog', { name: /new appointment/i })
    expect(within(dialog).getByLabelText(/^chair/i)).toHaveValue('maple-c1')
    expect(within(dialog).getByLabelText(/time of day/i)).toHaveDisplayValue(
      /from 2:15 PM/i,
    )
    expect(times(dialog)).toEqual([
      expect.stringMatching(/2:15 PM.*2:45 PM.*chair 1/i),
      expect.stringMatching(/2:30 PM.*chair 1/i),
      expect.stringMatching(/2:45 PM.*chair 1/i),
    ])
    expect(within(dialog).getByLabelText(/patient/i)).toHaveFocus()
  })

  it('suggests the next times that fit when the clicked spot is too short', async () => {
    const user = await renderAs()

    // Chair 1 has a visit at 1:00 PM, so a 30-minute exam can't start at 12:45.
    await user.click(slotCell('maple-c1', '12:45')!)

    const dialog = screen.getByRole('dialog', { name: /new appointment/i })
    expect(times(dialog)[0]).toMatch(/1:45 PM.*chair 1/i)
  })

  it('has no clickable spots before now (9:40 AM)', async () => {
    await renderAs()

    expect(slotCell('maple-c3', '08:00')).not.toBeInTheDocument()
    expect(slotCell('maple-c3', '09:30')).not.toBeInTheDocument()
    expect(slotCell('maple-c3', '09:45')).toBeInTheDocument()
  })

  it('has no clickable spots for a role that cannot book', async () => {
    await renderAs('provider')

    expect(screen.queryAllByTestId(/^slot-/)).toHaveLength(0)
  })

  it('returns focus to the New appointment button when the panel closes', async () => {
    const user = await renderAs()
    await user.click(slotCell('maple-c1', '14:15')!)

    await user.keyboard('{Escape}')

    expect(
      screen.getByRole('button', { name: /new appointment/i }),
    ).toHaveFocus()
  })
})
