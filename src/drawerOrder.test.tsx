import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

// The check-in drawer puts the job of the moment first: billing for a
// checked-out visit, the fix next to a double-booking, and no-show next to
// check-in once a patient is late. (Demo clock: 9:40.)

async function openDrawer(user: UserEvent, name: string) {
  renderWithQuery(<App />, { role: 'front-desk' })
  await screen.findByRole('button', { name: /^jon kim,/i })
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`) }),
  )
  return screen.getByRole('dialog', { name })
}

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('check-in drawer order', () => {
  it('shows billing before the checklist for a checked-out visit', async () => {
    const drawer = await openDrawer(userEvent.setup(), 'Ana Diaz')
    const billing = within(drawer).getByRole('region', { name: 'Billing' })
    const checklist = within(drawer).getByRole('group', { name: /checklist/i })
    expect(before(billing, checklist)).toBe(true)
  })

  it('puts Move to… right under a double-booking, before the status', async () => {
    const drawer = await openDrawer(userEvent.setup(), 'Lena Ortiz')
    const alert = within(drawer).getByText(/overlaps jon kim/i)
    const move = within(drawer).getByRole('button', { name: 'Move to…' })
    const status = within(drawer).getByRole('heading', { name: /^status:/i })
    expect(before(alert, move)).toBe(true)
    expect(before(move, status)).toBe(true)
  })

  it('keeps Move to… after the status when nothing overlaps', async () => {
    const drawer = await openDrawer(userEvent.setup(), 'Owen Hart')
    const move = within(drawer).getByRole('button', { name: 'Move to…' })
    const status = within(drawer).getByRole('heading', { name: /^status:/i })
    expect(before(status, move)).toBe(true)
  })

  it('offers Mark no-show next to Check in once the patient is late', async () => {
    const drawer = await openDrawer(userEvent.setup(), 'Priya Shah')
    const checkIn = within(drawer).getByRole('button', { name: 'Check in' })
    const noShow = within(drawer).getByRole('button', { name: 'Mark no-show' })
    expect(noShow.parentElement).toBe(checkIn.parentElement)
  })
})
