import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

async function renderAs(role: Role) {
  const user = userEvent.setup()
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /jon kim/i }) // schedule loaded
  const button = screen.getByRole('button', { name: /account menu/i })
  return { user, button }
}

const panel = () => screen.queryByRole('group', { name: /account details/i })

describe('account menu', () => {
  it('shows who is signed in on a closed menu button', async () => {
    const { button } = await renderAs('front-desk')

    expect(button).toHaveAccessibleName(/rosa jimenez/i)
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('RJ') // initials avatar
    expect(panel()).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /sign out/i }),
    ).not.toBeInTheDocument()
  })

  it('opens to show name, job title, practice and Sign out', async () => {
    const { user, button } = await renderAs('front-desk')

    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(button).toHaveAttribute('aria-controls', panel()?.id)
    expect(panel()).toHaveTextContent(/rosa jimenez/i)
    expect(panel()).toHaveTextContent(/front desk coordinator/i)
    expect(panel()).toHaveTextContent(/maple street dental/i)
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  it("shows each user's own job title", async () => {
    const { user, button } = await renderAs('provider')

    await user.click(button)

    expect(panel()).toHaveTextContent(/general dentist/i)
    expect(button).toHaveTextContent('AO') // "Dr." is not an initial
  })

  it('closes on a second click', async () => {
    const { user, button } = await renderAs('front-desk')

    await user.click(button)
    await user.click(button)

    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(panel()).not.toBeInTheDocument()
  })

  it('closes on Escape and puts focus back on the button', async () => {
    const { user, button } = await renderAs('front-desk')
    await user.click(button)
    await user.tab() // into the panel: the checked theme option
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus()
    await user.tab() // Sign out
    expect(screen.getByRole('button', { name: /sign out/i })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(panel()).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('closes when clicking elsewhere on the page', async () => {
    const { user, button } = await renderAs('front-desk')
    await user.click(button)

    await user.click(screen.getByRole('heading', { name: /front desk board/i }))

    expect(panel()).not.toBeInTheDocument()
  })

  it('closes when keyboard focus leaves it', async () => {
    const { user, button } = await renderAs('front-desk')
    await user.click(button)
    await user.tab() // the checked theme option
    await user.tab() // Sign out
    await user.tab() // past the menu, into the page

    expect(panel()).not.toBeInTheDocument()
  })

  it('signs out from the menu', async () => {
    const { user, button } = await renderAs('front-desk')
    await user.click(button)

    await user.click(screen.getByRole('button', { name: /sign out/i }))

    expect(screen.getByRole('heading', { name: /sign in/i })).toHaveFocus()
  })

  it('switches between light, dark, and the device setting, and remembers it', async () => {
    const { user, button } = await renderAs('front-desk')
    await user.click(button)

    const theme = screen.getByRole('group', { name: 'Theme' })
    const option = (name: string) => within(theme).getByRole('radio', { name })
    expect(option('System')).toBeChecked()

    await user.click(option('Dark'))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('front-desk-board.theme')).toBe('dark')

    await user.click(option('Light'))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('front-desk-board.theme')).toBe('light')
  })
})
