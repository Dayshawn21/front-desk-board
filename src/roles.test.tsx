import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

async function renderAs(role: Role) {
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
}

describe('roles', () => {
  it('shows the practice as plain text for everyone but the office manager', async () => {
    await renderAs('front-desk')

    const header = screen.getByRole('banner')
    expect(within(header).getByText('Maple Street Dental')).toBeInTheDocument()
    expect(
      within(header).queryByRole('combobox', { name: /practice/i }),
    ).not.toBeInTheDocument()
  })

  it('front desk cannot seat a patient', async () => {
    const user = userEvent.setup()
    await renderAs('front-desk')

    await user.click(screen.getByRole('button', { name: /jon kim/i }))
    const dialog = screen.getByRole('dialog', { name: /jon kim/i })

    expect(
      within(dialog).queryByRole('button', { name: /seat in chair/i }),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).getByText(
        /next step: seat in chair\. not available to front desk/i,
      ),
    ).toBeInTheDocument()
  })

  it('a provider can seat a patient but not check one in', async () => {
    const user = userEvent.setup()
    await renderAs('provider')
    await user.click(screen.getByRole('tab', { name: /patient flow/i }))

    expect(
      screen.getByRole('button', { name: /seat in chair jon kim/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /check in lena ortiz/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByText(/next: check in \(not available to provider\)/i)
        .length,
    ).toBeGreaterThan(0)
  })

  it('shows a provider the checklist read only', async () => {
    const user = userEvent.setup()
    await renderAs('provider')

    await user.click(screen.getByRole('button', { name: /jon kim/i }))
    const dialog = screen.getByRole('dialog', { name: /jon kim/i })

    expect(
      within(dialog).getByText(/read only for provider/i),
    ).toBeInTheDocument()
    for (const box of within(dialog).getAllByRole('checkbox')) {
      expect(box).toBeDisabled()
    }
    expect(
      within(dialog).queryByRole('button', { name: /save checklist/i }),
    ).not.toBeInTheDocument()
  })
})
