import { screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createAppointment } from './api/schedule'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

// Fake data only. In the seed, Lena Ortiz (confirmed, 9:45) is double-booked
// with Jon Kim (arrived) in Chair 2. The demo clock is 9:40, and the first
// free 45 minutes after that are 11:30 in Chair 2.

async function renderAs(role: Role = 'front-desk') {
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /^jon kim,/i }) // schedule loaded
}

async function openDrawer(user: UserEvent, name: string) {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`) }),
  )
  return screen.getByRole('dialog', { name })
}

const moveButton = (drawer: HTMLElement) =>
  within(drawer).queryByRole('button', { name: 'Move to…' })

const timesIn = (drawer: HTMLElement) =>
  within(drawer).getByRole('group', { name: 'Pick a new time' })

describe('moving a visit', () => {
  it("is offered for visits that haven't checked in, to the front desk and office manager", async () => {
    const user = userEvent.setup()
    await renderAs()
    expect(moveButton(await openDrawer(user, 'Lena Ortiz'))).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // Jon Kim has arrived: his visit is under way.
    expect(
      moveButton(await openDrawer(user, 'Jon Kim')),
    ).not.toBeInTheDocument()
  })

  it('is not offered to a provider', async () => {
    const user = userEvent.setup()
    await renderAs('provider')
    expect(
      moveButton(await openDrawer(user, 'Lena Ortiz')),
    ).not.toBeInTheDocument()
  })

  it('offers later open times today, the same length, and moves the visit', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Lena Ortiz')
    expect(within(drawer).getByText(/overlaps jon kim/i)).toBeInTheDocument()

    await user.click(moveButton(drawer)!)
    const times = timesIn(drawer)
    const options = within(times).getAllByRole('radio')
    // Her own provider's times first; another provider is named.
    expect(options.map((o) => o.closest('label')?.textContent)).toEqual([
      '11:30 AM – 12:15 PM, Chair 2',
      '11:45 AM – 12:30 PM, Chair 2',
      '12:00 PM – 12:45 PM, Chair 2',
      '11:45 AM – 12:30 PM, Chair 3, with Dr. Lindqvist',
      '12:00 PM – 12:45 PM, Chair 1, with Dr. Okafor',
    ])
    expect(options[0]).toHaveFocus()

    await user.click(options[0])
    await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))

    expect(
      await screen.findByText('Lena Ortiz: moved to 11:30 AM, Chair 2'),
    ).toBeInTheDocument()
    expect(
      within(drawer).getByText(/Exam · Chair 2 · 11:30 AM – 12:15 PM/),
    ).toBeInTheDocument()
    // No longer double-booked. Move to… goes back below the status, and
    // focus is on the line that says what happened, next to its Undo.
    expect(
      within(drawer).queryByText(/overlaps jon kim/i),
    ).not.toBeInTheDocument()
    expect(
      within(drawer).getByText('Last change: moved to 11:30 AM, Chair 2'),
    ).toHaveFocus()
  })

  it('asks for a time before moving, and Keep time backs out', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Lena Ortiz')

    await user.click(moveButton(drawer)!)
    await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))
    expect(timesIn(drawer)).toHaveAccessibleDescription('Choose a time.')

    await user.click(within(drawer).getByRole('button', { name: 'Keep time' }))
    expect(
      within(drawer).queryByRole('group', { name: 'Pick a new time' }),
    ).not.toBeInTheDocument()
    expect(moveButton(drawer)).toHaveFocus()
    expect(
      within(drawer).getByText(/Exam · Chair 2 · 9:45 AM – 10:30 AM/),
    ).toBeInTheDocument()
  })

  it('Undo in the toast puts the visit back', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Lena Ortiz')
    await user.click(moveButton(drawer)!)
    await user.click(within(timesIn(drawer)).getAllByRole('radio')[0])
    await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))
    await screen.findByText('Lena Ortiz: moved to 11:30 AM, Chair 2')

    await user.click(
      screen.getByRole('button', { name: 'Undo move for Lena Ortiz' }),
    )
    expect(
      await screen.findByText(
        'Lena Ortiz: move undone, back at 9:45 AM, Chair 2',
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(drawer).getByText(/Exam · Chair 2 · 9:45 AM – 10:30 AM/),
      ).toBeInTheDocument(),
    )
  })

  it('says so when someone else just took the time', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Lena Ortiz')
    await user.click(moveButton(drawer)!)
    await user.click(within(timesIn(drawer)).getAllByRole('radio')[0])

    // Meanwhile, another tab books 11:30 in Chair 2.
    await createAppointment('maple', {
      patientId: 'p-owen',
      chairId: 'maple-c2',
      start: '2026-11-17T11:30:00',
      end: '2026-11-17T12:00:00',
      type: 'exam',
    })
    await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'That time was just booked in Chair 2. Pick another time.',
    )
    // The times refresh without it: her provider's next time is 12:00.
    await waitFor(() =>
      expect(
        within(timesIn(drawer))
          .getAllByRole('radio')
          .map((o) => o.closest('label')?.textContent)[0],
      ).toBe('12:00 PM – 12:45 PM, Chair 2'),
    )
  })

  it('shows an error when saving fails', async () => {
    window.history.replaceState(null, '', '/?failSave')
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Lena Ortiz')
    await user.click(moveButton(drawer)!)
    await user.click(within(timesIn(drawer)).getAllByRole('radio')[0])
    await user.click(within(drawer).getByRole('button', { name: 'Move visit' }))

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      /could not move the visit/i,
    )
  })
})
