import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createAppointment, fetchSchedule } from './api/schedule'
import { DEMO_DATE, DEMO_NOW } from './config'
import { patientTimes } from './lib/patientBooking'
import { renderWithQuery } from './test/render'

// The patient's page is public: no staff sign-in. The patient signs in
// first (the demo patient sign-in), then sees the booking form.
function openSignedOut(path = '/book/maple') {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  const view = renderWithQuery(<App />, { signedOut: true })
  return { user, ...view }
}

async function openBookingPage(path = '/book/maple', patient = 'Ana Diaz') {
  const { user } = openSignedOut(path)
  await screen.findByRole('heading', { name: 'Sign in to book' })
  await user.click(screen.getByRole('button', { name: patient }))
  await screen.findByRole('heading', { name: 'Book a visit' })
  return user
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  visit: RegExp = /^Cleaning/,
) {
  await user.click(screen.getByRole('radio', { name: visit }))
}

const timeGroup = () => screen.getByRole('group', { name: 'Pick a time' })

describe('book a visit (patient page)', () => {
  it('asks the patient to sign in first, not the staff sign-in', async () => {
    openSignedOut()

    expect(
      await screen.findByRole('heading', { name: 'Sign in to book' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Maple Street Dental')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Sign in' }),
    ).not.toBeInTheDocument()
    // It says the patient list is pretend.
    expect(screen.getByText(/made-up patients/i)).toBeInTheDocument()
  })

  it('books for whoever signed in, with no patient list on the form', async () => {
    await openBookingPage()

    expect(screen.getByRole('heading', { name: 'Book a visit' })).toHaveFocus()
    expect(
      within(screen.getByRole('banner')).getByText('Ana Diaz'),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Who is the visit for?'),
    ).not.toBeInTheDocument()
  })

  it('goes straight to the form when already signed in', async () => {
    const first = openSignedOut()
    await screen.findByRole('heading', { name: 'Sign in to book' })
    await first.user.click(screen.getByRole('button', { name: 'Ana Diaz' }))
    await screen.findByRole('heading', { name: 'Book a visit' })
    first.unmount()

    // Like a reload: the same tab, a fresh app.
    openSignedOut()
    expect(
      await screen.findByRole('heading', { name: 'Book a visit' }),
    ).toBeInTheDocument()
  })

  it('signing out goes back to the sign-in step', async () => {
    const user = await openBookingPage()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(
      screen.getByRole('heading', { name: 'Sign in to book' }),
    ).toHaveFocus()
  })

  it('opens the other practice from its own link', async () => {
    openSignedOut('/book/riverbend')
    await screen.findByRole('heading', { name: 'Sign in to book' })
    expect(screen.getByText('Riverbend Family Dental')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Hana Sato' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ana Diaz' }),
    ).not.toBeInTheDocument()
  })

  it("says so when the practice doesn't exist", async () => {
    window.history.pushState(null, '', '/book/nowhere')
    renderWithQuery(<App />, { signedOut: true })
    expect(
      await screen.findByRole('heading', {
        name: "We couldn't find that practice",
      }),
    ).toBeInTheDocument()
  })

  it('offers visit types with how long each takes', async () => {
    await openBookingPage()
    const visits = screen.getByRole('group', { name: 'What do you need?' })
    expect(
      within(visits).getByRole('radio', { name: /^Cleaning.*1 hour/ }),
    ).toBeInTheDocument()
    expect(
      within(visits).getByRole('radio', { name: /^Checkup.*30 minutes/ }),
    ).toBeInTheDocument()
    expect(
      within(visits).getByRole('radio', { name: /^Tooth pain/ }),
    ).toBeInTheDocument()
    expect(within(visits).getAllByRole('radio')).toHaveLength(4)
  })

  it("shows today's real open times, none before now", async () => {
    const user = await openBookingPage()
    await choose(user)

    const day = await fetchSchedule('maple', DEMO_DATE)
    const expected = patientTimes(day, 60, DEMO_NOW)
    const radios = within(timeGroup()).getAllByRole('radio')
    expect(radios).toHaveLength(expected.length)
    expect(radios[0]).toHaveAccessibleName('11:30 AM')
    // Nothing before the demo clock (9:40 AM).
    expect(
      within(timeGroup()).queryByRole('radio', { name: /^(8|9):\d\d AM/ }),
    ).not.toBeInTheDocument()
  })

  it('books the visit, says when, and moves focus to the confirmation', async () => {
    const user = await openBookingPage()
    await choose(user)
    await user.click(
      within(timeGroup()).getByRole('radio', { name: '11:30 AM' }),
    )

    await user.click(screen.getByRole('button', { name: 'Book 11:30 AM' }))

    const done = await screen.findByRole('heading', { name: "You're booked" })
    expect(done).toHaveFocus()
    expect(
      screen.getByText(/Tuesday, Nov 17, 11:30 AM – 12:30 PM/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cleaning for Ana Diaz/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'See your visits' }),
    ).toHaveAttribute('href', '/patient/maple')

    // It's on the practice's schedule, waiting for the desk to confirm.
    const day = await fetchSchedule('maple', DEMO_DATE)
    const booked = day.appointments.find(
      (a) => a.patientId === 'p-ana' && a.start === `${DEMO_DATE}T11:30:00`,
    )
    expect(booked).toMatchObject({ type: 'cleaning', status: 'scheduled' })
  })

  it("can't book until a time is picked", async () => {
    const user = await openBookingPage()
    await choose(user)
    expect(
      screen.getByRole('button', { name: 'Pick a time to book' }),
    ).toBeDisabled()
  })

  it('asks for another time when someone else just took it', async () => {
    const user = await openBookingPage()
    await choose(user, /^Checkup/)
    const day = await fetchSchedule('maple', DEMO_DATE)
    const [first] = patientTimes(day, 30, DEMO_NOW)
    await user.click(
      within(timeGroup()).getByRole('radio', { name: '11:30 AM' }),
    )

    // Meanwhile, the front desk books that exact chair and time.
    await createAppointment('maple', {
      patientId: 'p-grace',
      chairId: first.chairId,
      start: first.start,
      end: first.end,
      type: 'exam',
    })
    await user.click(screen.getByRole('button', { name: 'Book 11:30 AM' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sorry, that time was just taken. Please pick another time.',
    )
    expect(
      screen.queryByRole('heading', { name: "You're booked" }),
    ).not.toBeInTheDocument()
    // The choice is cleared; the patient and visit type are kept.
    expect(
      screen.getByRole('button', { name: 'Pick a time to book' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Checkup/ })).toBeChecked()
  })

  it('can start over to book another visit', async () => {
    const user = await openBookingPage()
    await choose(user)
    await user.click(
      within(timeGroup()).getByRole('radio', { name: '11:30 AM' }),
    )
    await user.click(screen.getByRole('button', { name: 'Book 11:30 AM' }))
    await screen.findByRole('heading', { name: "You're booked" })

    await user.click(screen.getByRole('button', { name: 'Book another visit' }))

    expect(screen.getByRole('heading', { name: 'Book a visit' })).toHaveFocus()
    // The time just booked is gone (no other chair is free then).
    await choose(user)
    expect(
      within(timeGroup()).queryByRole('radio', { name: '11:30 AM' }),
    ).not.toBeInTheDocument()
  })
})

describe('the way in from the staff side', () => {
  it('links to the patient booking page from the sign-in page', () => {
    renderWithQuery(<App />, { signedOut: true })
    expect(
      screen.getByRole('link', { name: /book a visit online/i }),
    ).toHaveAttribute('href', '/book')
  })
})

describe('choosing a practice at /book', () => {
  it('lists every practice, each linking to its booking page', async () => {
    window.history.pushState(null, '', '/book')
    renderWithQuery(<App />, { signedOut: true })

    expect(
      await screen.findByRole('heading', { name: 'Choose your dental office' }),
    ).toBeInTheDocument()
    const maple = screen.getByRole('link', { name: /Maple Street Dental/ })
    const riverbend = screen.getByRole('link', {
      name: /Riverbend Family Dental/,
    })
    expect(maple).toHaveAttribute('href', '/book/maple')
    expect(riverbend).toHaveAttribute('href', '/book/riverbend')
    // Today's hours help a patient tell the offices apart.
    expect(maple).toHaveAccessibleName(/8:00 AM – 5:00 PM/)
    expect(riverbend).toHaveAccessibleName(/7:30 AM – 4:00 PM/)
    // Not a booking form yet, and not the staff sign-in.
    expect(
      screen.queryByLabelText('Who is the visit for?'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Sign in' }),
    ).not.toBeInTheDocument()
  })
})
