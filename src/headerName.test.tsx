import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { PatientShell } from './components/patient/PatientShell'
import { renderWithQuery } from './test/render'

// While a patient page is still loading its practice, the header shows no
// name at all, never the staff product's name first.

describe('the patient header while loading', () => {
  it('shows no name while the practice loads', () => {
    render(
      <PatientShell subtitle="Online booking" nameLoading>
        <p>Loading…</p>
      </PatientShell>,
    )
    expect(screen.getByRole('banner')).not.toHaveTextContent('Front Desk Board')
  })

  it('still says Front Desk Board on a page with no practice', () => {
    render(
      <PatientShell subtitle="Patient sign-in">
        <p>Sign in</p>
      </PatientShell>,
    )
    expect(screen.getByRole('banner')).toHaveTextContent('Front Desk Board')
  })

  it.each([['/book/maple'], ['/check-in/maple/a-11']])(
    '%s never flashes Front Desk Board before the practice name',
    async (path) => {
      window.history.pushState(null, '', path)
      renderWithQuery(<App />, { signedOut: true })
      // First render: the practice list is still loading.
      expect(screen.getByRole('banner')).not.toHaveTextContent(
        'Front Desk Board',
      )
      expect(await screen.findByText('Maple Street Dental')).toBeInTheDocument()
    },
  )
})

describe('the schedule time axis', () => {
  it('hides the half-hour label under the 9:40 now marker', async () => {
    renderWithQuery(<App />, { role: 'front-desk' })
    await screen.findByRole('button', { name: /^jon kim,/i })
    expect(screen.getByText('9:30 AM')).toHaveClass('invisible')
    expect(screen.getByText('9:00 AM')).not.toHaveClass('invisible')
    expect(screen.getByText('10:00 AM')).not.toHaveClass('invisible')
  })
})
