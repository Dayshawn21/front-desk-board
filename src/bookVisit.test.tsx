import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { createAppointment, fetchSchedule } from './api/schedule'
import { DEMO_DATE, DEMO_NOW } from './config'
import { patientTimes } from './lib/patientBooking'
import { renderWithQuery } from './test/render'

// The patient's page is public: no staff sign-in.
async function openBookingPage(path = '/book/maple') {
  window.history.pushState(null, '', path)
  const user = userEvent.setup()
  renderWithQuery(<App />, { signedOut: true })
  await screen.findByRole('heading', { name: 'Book a visit' })
  return user
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  patient = 'Ana Diaz',
  visit: RegExp = /^Cleaning/,
) {
  await user.selectOptions(
    await screen.findByLabelText('Who is the visit for?'),
    patient,
  )
  await user.click(screen.getByRole('radio', { name: visit }))
}

const timeGroup = () => screen.getByRole('group', { name: 'Pick a time' })

describe('book a visit (patient page)', () => {
  it("shows the practice's booking page, not the staff sign-in", async () => {
    await openBookingPage()

    expect(screen.getByText('Maple Street Dental')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Sign in' }),
    ).not.toBeInTheDocument()
    // It says the patient list is pretend.
    expect(screen.getByText(/made-up patients/i)).toBeInTheDocument()
  })

  it('opens the other practice from its own link', async () => {
    await openBookingPage('/book/riverbend')
    expect(screen.getByText('Riverbend Family Dental')).toBeInTheDocument()
    const patient = screen.getByLabelText('Who is the visit for?')
    expect(
      within(patient).getByRole('option', { name: 'Hana Sato' }),
    ).toBeInTheDocument()
    expect(
      within(patient).queryByRole('option', { name: 'Ana Diaz' }),
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
    await choose(user, 'Ana Diaz', /^Checkup/)
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
    // The choice is cleared, and the patient and visit type are kept.
    expect(
      screen.getByRole('button', { name: 'Pick a time to book' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Who is the visit for?')).toHaveValue('p-ana')
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
    ).toHaveAttribute('href', '/book/maple')
  })
})
