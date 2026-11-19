import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { fetchSchedule, updateAppointment } from './api/schedule'
import { DEMO_DATE } from './config'
import { renderWithQuery } from './test/render'

// The patient's phone: a public page per visit, no staff sign-in.
// a-11 is Ravi Menon's cleaning, 10:15 AM in Chair 3 (Dr. Lindqvist),
// Scheduled, with only "Insurance verified" ticked.
function openCheckIn(path = '/check-in/maple/a-11') {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  renderWithQuery(<App />, { signedOut: true })
  return user
}

async function visit(id: string) {
  const day = await fetchSchedule('maple', DEMO_DATE)
  return day.appointments.find((a) => a.id === id)
}

describe('patient check-in from a phone', () => {
  it('shows the visit and the details on file', async () => {
    openCheckIn()

    expect(
      await screen.findByRole('heading', { name: 'Check in' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Hi Ravi/)).toBeInTheDocument()
    expect(screen.getByText('Cleaning')).toBeInTheDocument()
    expect(screen.getByText(/10:15 AM – 11:00 AM/)).toBeInTheDocument()
    expect(screen.getByText(/Dr\. Lindqvist/)).toBeInTheDocument()

    const details = screen.getByRole('region', { name: 'Your details' })
    expect(details).toHaveTextContent('Ravi Menon')
    expect(details).toHaveTextContent('555-0111')
    expect(details).toHaveTextContent('Bluebird Dental')
    // A way to fix details without a form the desk can't see.
    expect(details).toHaveTextContent(/tell the front desk/i)
  })

  it('says when there is no insurance on file', async () => {
    openCheckIn('/check-in/maple/a-07') // Lena Ortiz, self-pay
    const details = await screen.findByRole('region', { name: 'Your details' })
    expect(details).toHaveTextContent('None on file')
  })

  it('lets the patient tick their forms, and saves each tick right away', async () => {
    const user = openCheckIn()
    const forms = await screen.findByRole('checkbox', {
      name: "I've filled in my visit forms",
    })
    const history = screen.getByRole('checkbox', {
      name: /I've reviewed my health history/,
    })
    expect(forms).not.toBeChecked()
    expect(history).not.toBeChecked()

    await user.click(forms)

    expect(forms).toBeChecked()
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect((await visit('a-11'))?.checklist).toMatchObject({
      formsComplete: true,
      medicalHistoryReviewed: false,
      insuranceVerified: true, // staff ticks are kept
    })
  })

  it('starts with the ticks already saved', async () => {
    openCheckIn('/check-in/maple/a-07') // forms and history already done
    expect(
      await screen.findByRole('checkbox', {
        name: "I've filled in my visit forms",
      }),
    ).toBeChecked()
  })

  it("only lets the patient tick their own items, not the desk's", async () => {
    openCheckIn()
    await screen.findByRole('heading', { name: 'Check in' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.queryByText(/copay/i)).not.toBeInTheDocument()
  })

  it('marks them Arrived on "I\'m here", and says so', async () => {
    const user = openCheckIn()
    await user.click(
      await screen.findByRole('checkbox', {
        name: /I've reviewed my health history/,
      }),
    )

    await user.click(screen.getByRole('button', { name: "I'm here" }))

    const done = await screen.findByRole('heading', {
      name: "You're checked in",
    })
    expect(done).toHaveFocus()
    expect(screen.getByText(/have a seat/i)).toBeInTheDocument()
    expect(await visit('a-11')).toMatchObject({
      status: 'arrived',
      checklist: { medicalHistoryReviewed: true, insuranceVerified: true },
    })
  })

  it('shows "checked in" for a patient who already arrived', async () => {
    await updateAppointment('maple', 'a-11', { status: 'arrived' })
    openCheckIn()
    expect(
      await screen.findByRole('heading', { name: "You're checked in" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: "I'm here" }),
    ).not.toBeInTheDocument()
  })

  it('says a cancelled visit was cancelled, with no way to check in', async () => {
    await updateAppointment('maple', 'a-11', {
      status: 'cancelled',
      cancelReason: 'patient-cancelled',
    })
    openCheckIn()
    expect(
      await screen.findByRole('heading', { name: 'This visit was cancelled' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: "I'm here" }),
    ).not.toBeInTheDocument()
  })

  it("says so when the visit or practice doesn't exist", async () => {
    openCheckIn('/check-in/maple/nope')
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't find that visit",
      }),
    ).toBeInTheDocument()
  })

  it("doesn't show another practice's visit", async () => {
    openCheckIn('/check-in/riverbend/a-11')
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't find that visit",
      }),
    ).toBeInTheDocument()
  })

  it('keeps the button and says what to do when the save fails', async () => {
    const user = openCheckIn('/check-in/maple/a-11?failSave')
    await user.click(await screen.findByRole('button', { name: "I'm here" }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't check you in. Please try again, or tell the front desk.",
    )
    expect(screen.getByRole('button', { name: "I'm here" })).toBeInTheDocument()
    expect((await visit('a-11'))?.status).toBe('scheduled')
  })
})

describe('getting the link to the patient', () => {
  it('shows a check-in link in the drawer of a visit that is expected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await user.click(
      await screen.findByRole('button', { name: /^Ravi Menon,/ }),
    )
    const drawer = screen.getByRole('dialog', { name: /Ravi Menon/ })
    const section = within(drawer).getByRole('region', {
      name: 'Patient check-in link',
    })

    expect(
      within(section).getByRole('link', { name: /open check-in page/i }),
    ).toHaveAttribute('href', '/check-in/maple/a-11')

    await user.click(within(section).getByRole('button', { name: 'Copy link' }))
    expect(await within(section).findByText('Link copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/check-in/maple/a-11`,
    )
  })

  it('has no link once the patient has arrived', async () => {
    const user = userEvent.setup()
    renderWithQuery(<App />)
    await user.click(await screen.findByRole('button', { name: /^Jon Kim,/ }))
    const drawer = screen.getByRole('dialog', { name: /Jon Kim/ })
    expect(
      within(drawer).queryByRole('region', { name: 'Patient check-in link' }),
    ).not.toBeInTheDocument()
  })

  it('links to check-in from the booking confirmation', async () => {
    window.history.pushState(null, '', '/book/maple')
    const user = userEvent.setup()
    renderWithQuery(<App />, { signedOut: true })
    await user.selectOptions(
      await screen.findByLabelText('Who is the visit for?'),
      'Ana Diaz',
    )
    await user.click(screen.getByRole('radio', { name: /^Checkup/ }))
    await user.click(screen.getByText('11:30 AM', { exact: true }))
    await user.click(screen.getByRole('button', { name: 'Book 11:30 AM' }))
    await screen.findByRole('heading', { name: "You're booked" })

    expect(
      screen.getByRole('link', { name: /check in from your phone/i }),
    ).toHaveAttribute('href', '/check-in/maple/b-1')
  })
})
