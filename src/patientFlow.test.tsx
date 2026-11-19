import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'

async function openFlowTab(user: UserEvent) {
  renderWithQuery(<App />)
  await screen.findByRole('button', { name: /^jon kim,/i }) // schedule loaded
  await user.click(screen.getByRole('tab', { name: /patient flow/i }))
}

const column = (label: RegExp) => screen.getByRole('region', { name: label })

describe('patient flow tab', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('groups visits into the four front-desk columns', async () => {
    const user = userEvent.setup()
    await openFlowTab(user)

    expect(screen.getByRole('tab', { name: /patient flow/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(column(/^expected/i)).toHaveTextContent('10 visits')
    expect(column(/^arrived/i)).toHaveTextContent('1 visit')
    expect(within(column(/^arrived/i)).getByText('Jon Kim')).toBeInTheDocument()
    expect(column(/^in chair/i)).toHaveTextContent('2 visits')
    expect(column(/^checked out/i)).toHaveTextContent('2 visits')
  })

  it('checking a patient in moves them to the Arrived column', async () => {
    const user = userEvent.setup()
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check in lena ortiz/i }),
    )

    expect(
      await within(column(/^arrived/i)).findByText('Lena Ortiz'),
    ).toBeInTheDocument()
    expect(
      within(column(/^expected/i)).queryByText('Lena Ortiz'),
    ).not.toBeInTheDocument()
  })

  it('opens the check-in drawer from a name and returns focus there', async () => {
    const user = userEvent.setup()
    await openFlowTab(user)

    const name = within(column(/^arrived/i)).getByRole('button', {
      name: 'Jon Kim',
    })
    await user.click(name)
    expect(screen.getByRole('dialog', { name: /jon kim/i })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(name).toHaveFocus()
  })

  it('shows an error when a board save fails', async () => {
    window.history.replaceState(null, '', '/?failSave')
    const user = userEvent.setup()
    await openFlowTab(user)

    await user.click(
      screen.getByRole('button', { name: /check in lena ortiz/i }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not save/i,
    )
  })

  it('switches tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await screen.findByRole('button', { name: /^jon kim,/i })

    screen.getByRole('tab', { name: /schedule/i }).focus()
    await user.keyboard('{ArrowRight}')

    const flowTab = screen.getByRole('tab', { name: /patient flow/i })
    expect(flowTab).toHaveFocus()
    expect(flowTab).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('tabpanel', { name: /patient flow/i }),
    ).toBeInTheDocument()
  })
})
