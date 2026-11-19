import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

// The demo clock is 9:40. Priya Shah was confirmed for 8:00 and never came.

async function renderAs(role: Role = 'front-desk') {
  const user = userEvent.setup()
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
  return user
}

// Click the visit's card (its label starts "Name, …"), return its drawer.
async function openVisit(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`, 'i') }),
  )
  return screen.getByRole('dialog', { name })
}

const noShowButton = (dialog: HTMLElement) =>
  within(dialog).queryByRole('button', { name: 'Mark no-show' })

describe('no-show', () => {
  it('is offered for an expected visit whose start time has passed', async () => {
    const user = await renderAs()

    expect(
      noShowButton(await openVisit(user, 'Priya Shah')),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // Lena Ortiz is at 9:45: not late yet.
    expect(noShowButton(await openVisit(user, 'Lena Ortiz'))).toBeNull()
    await user.keyboard('{Escape}')
    // Jon Kim has arrived.
    expect(noShowButton(await openVisit(user, 'Jon Kim'))).toBeNull()
  })

  it('is not offered to a provider', async () => {
    const user = await renderAs('provider')
    expect(noShowButton(await openVisit(user, 'Priya Shah'))).toBeNull()
  })

  it('marks the visit, keeps it on the schedule, and Undo puts it back', async () => {
    const user = await renderAs()
    const dialog = await openVisit(user, 'Priya Shah')

    await user.click(noShowButton(dialog)!)

    expect(
      await screen.findByText('Priya Shah: marked no-show'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: 'Status: No-show' }),
    ).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('button', { name: /^priya shah, no-show,/i }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /undo no-show for priya shah/i }),
    )
    expect(
      await screen.findByRole('button', { name: /^priya shah, confirmed,/i }),
    ).toBeInTheDocument()
  })

  it('lists no-shows under the patient flow board', async () => {
    const user = await renderAs()
    const dialog = await openVisit(user, 'Priya Shah')
    await user.click(noShowButton(dialog)!)
    await screen.findByText('Priya Shah: marked no-show')
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('tab', { name: /patient flow/i }))

    expect(
      screen.getByRole('region', { name: /^expected/i }),
    ).not.toHaveTextContent('Priya Shah')
    expect(
      screen.getByText(/^no-shows today:/i).closest('p'),
    ).toHaveTextContent('No-shows today: Priya Shah (8:00 AM)')
  })
})
