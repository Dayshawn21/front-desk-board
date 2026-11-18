import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

async function renderAs(role: Role = 'front-desk') {
  const user = userEvent.setup()
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
  return user
}

async function openVisit(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
) {
  await user.click(screen.getByRole('button', { name }))
  return screen.getByRole('dialog', { name })
}

const cancelButton = (dialog: HTMLElement) =>
  within(dialog).queryByRole('button', { name: /cancel visit/i })

describe('cancel visit', () => {
  it('is offered for scheduled and confirmed visits only', async () => {
    const user = await renderAs()

    // Owen Hart: scheduled
    expect(
      cancelButton(await openVisit(user, /owen hart/i)),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // Grace Liu: confirmed
    expect(
      cancelButton(await openVisit(user, /grace liu/i)),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')
    // Jon Kim: arrived, so the visit has started
    expect(
      cancelButton(await openVisit(user, /jon kim/i)),
    ).not.toBeInTheDocument()
  })

  it('is not offered to a provider', async () => {
    const user = await renderAs('provider')

    expect(
      cancelButton(await openVisit(user, /owen hart/i)),
    ).not.toBeInTheDocument()
  })

  it('cancels, confirms with Undo, and takes the visit off the schedule', async () => {
    const user = await renderAs()
    const dialog = await openVisit(user, /owen hart/i)

    await user.click(cancelButton(dialog)!)

    expect(await screen.findByText('Owen Hart: cancelled')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /undo cancel for owen hart/i }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { name: /status: cancelled/i }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('button', { name: /owen hart/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/cancelled today/i)).toHaveTextContent(
      /owen hart.*11:15 AM/i,
    )
    // Its card is gone, so focus goes to the page heading, not nowhere.
    expect(
      screen.getByRole('heading', { level: 1, name: /front desk board/i }),
    ).toHaveFocus()
  })

  it('Undo puts the visit back as it was', async () => {
    const user = await renderAs()
    const dialog = await openVisit(user, /grace liu/i)
    await user.click(cancelButton(dialog)!)
    await user.keyboard('{Escape}')

    await user.click(
      await screen.findByRole('button', { name: /undo cancel for grace liu/i }),
    )

    expect(
      await screen.findByRole('button', { name: /grace liu.*confirmed/i }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/grace liu: restored/i)).toBeInTheDocument()
  })

  it('frees the time for a new booking', async () => {
    const user = await renderAs()
    const dialog = await openVisit(user, /owen hart/i)
    await user.click(cancelButton(dialog)!)
    await user.keyboard('{Escape}')

    await user.click(screen.getByTestId('slot-maple-c1-11:15'))

    const booking = screen.getByRole('dialog', { name: /new appointment/i })
    expect(
      within(booking).getAllByRole('radio')[0].closest('label'),
    ).toHaveTextContent(/11:15 AM.*chair 1/i)
  })
})
