import { describe, expect, it } from 'vitest'
import { DEMO_DATE, DEMO_NOW } from '../config'
import { DEMO_PATIENT_PASSWORD, patientEmail } from '../mocks/patientLogins'
import {
  bookMyVisit,
  checkInMyVisit,
  fetchMyAccount,
  fetchOpenTimes,
  patientSignIn,
  patientSignOut,
} from './patientPortal'
import { ApiError, fetchSchedule, resetDemoData } from './schedule'

// The patient side of the mock server. A patient signs in with an email and
// password and gets a session token; every patient call takes the token and
// only ever sees or changes that patient's own visits.

async function signInAs(email: string, password = DEMO_PATIENT_PASSWORD) {
  const { token } = await patientSignIn(email, password)
  return token
}

async function expectApiError(promise: Promise<unknown>, status: number) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(status)
}

describe('demo patient logins', () => {
  it('gives each made-up patient an email from their name', () => {
    expect(patientEmail({ firstName: 'Owen', lastName: 'Hart' })).toBe(
      'owen.hart@example.com',
    )
    // Accents are dropped so the email is easy to type.
    expect(patientEmail({ firstName: 'Tomás', lastName: 'Reyes' })).toBe(
      'tomas.reyes@example.com',
    )
  })
})

describe('patient sign-in', () => {
  it('signs in with the right email and password', async () => {
    const token = await signInAs('owen.hart@example.com')
    expect(token).toEqual(expect.any(String))
    expect(token.length).toBeGreaterThan(20)
  })

  it('ignores case and spaces around the email', async () => {
    await expect(
      patientSignIn('  Owen.Hart@Example.com ', DEMO_PATIENT_PASSWORD),
    ).resolves.toHaveProperty('token')
  })

  it('refuses a wrong password, or an unknown email, the same way', async () => {
    await expectApiError(
      patientSignIn('owen.hart@example.com', 'wrong-password'),
      401,
    )
    await expectApiError(
      patientSignIn('nobody@example.com', DEMO_PATIENT_PASSWORD),
      401,
    )
    const wrong = await patientSignIn('owen.hart@example.com', 'nope').catch(
      (e: Error) => e.message,
    )
    const unknown = await patientSignIn(
      'nobody@example.com',
      DEMO_PATIENT_PASSWORD,
    ).catch((e: Error) => e.message)
    // Same message, so the form doesn't reveal which emails exist.
    expect(wrong).toBe(unknown)
  })

  it('refuses a made-up or signed-out token', async () => {
    await expectApiError(fetchMyAccount('not-a-token', DEMO_DATE), 401)

    const token = await signInAs('owen.hart@example.com')
    await patientSignOut(token)
    await expectApiError(fetchMyAccount(token, DEMO_DATE), 401)
  })

  it('signs everyone out when the demo data is reset', async () => {
    const token = await signInAs('owen.hart@example.com')
    resetDemoData()
    await expectApiError(fetchMyAccount(token, DEMO_DATE), 401)
  })
})

describe("a patient's own account", () => {
  it('returns only their details and their visits', async () => {
    const token = await signInAs('owen.hart@example.com')
    const account = await fetchMyAccount(token, DEMO_DATE)

    expect(account.patient).toMatchObject({
      firstName: 'Owen',
      lastName: 'Hart',
      email: 'owen.hart@example.com',
    })
    expect(account.practice.id).toBe('maple')
    expect(account.visits.map((v) => v.id)).toEqual(['a-04'])
    expect(account.visits[0]).toMatchObject({
      status: 'scheduled',
      provider: expect.any(String),
    })
    // Nothing about anyone else: no patient list, no other visits.
    expect(JSON.stringify(account)).not.toContain('Ana')
    expect(account).not.toHaveProperty('patients')
  })
})

describe('checking in', () => {
  it('saves ticks and "I\'m here" on their own visit', async () => {
    const token = await signInAs('ravi.menon@example.com')
    await checkInMyVisit(token, 'a-11', { checklist: { formsComplete: true } })
    const visit = await checkInMyVisit(token, 'a-11', { arrived: true })
    expect(visit.status).toBe('arrived')

    const day = await fetchSchedule('maple', DEMO_DATE)
    expect(day.appointments.find((a) => a.id === 'a-11')).toMatchObject({
      status: 'arrived',
      checklist: { formsComplete: true, insuranceVerified: true },
    })
  })

  it("can't see or change another patient's visit", async () => {
    const token = await signInAs('owen.hart@example.com')
    // a-11 is Ravi's. Not found, the same as a visit that doesn't exist.
    await expectApiError(checkInMyVisit(token, 'a-11', { arrived: true }), 404)
    await expectApiError(
      checkInMyVisit(token, 'a-11', { checklist: { formsComplete: true } }),
      404,
    )
    const day = await fetchSchedule('maple', DEMO_DATE)
    expect(day.appointments.find((a) => a.id === 'a-11')?.status).toBe(
      'scheduled',
    )
  })

  it("can't check in a visit that's cancelled or already done", async () => {
    const token = await signInAs('ana.diaz@example.com') // a-01 is completed
    await expectApiError(checkInMyVisit(token, 'a-01', { arrived: true }), 409)
  })
})

describe('open times and booking', () => {
  it('shows open times with no patient details, signed in or not', async () => {
    const open = await fetchOpenTimes('maple', DEMO_DATE, 60, DEMO_NOW)
    expect(open.practice.name).toBe('Maple Street Dental')
    expect(open.times[0]).toEqual({
      start: `${DEMO_DATE}T11:30:00`,
      end: `${DEMO_DATE}T12:30:00`,
    })
    expect(JSON.stringify(open)).not.toMatch(/patient|Ravi|chair/i)
  })

  it('says so for an office that does not exist', async () => {
    await expectApiError(
      fetchOpenTimes('nowhere', DEMO_DATE, 60, DEMO_NOW),
      404,
    )
  })

  it('books for the signed-in patient, at their own office', async () => {
    const token = await signInAs('grace.liu@example.com')
    const visit = await bookMyVisit(token, {
      practiceId: 'maple',
      type: 'exam',
      start: `${DEMO_DATE}T11:30:00`,
    })
    expect(visit).toMatchObject({
      type: 'exam',
      status: 'scheduled',
      start: `${DEMO_DATE}T11:30:00`,
      end: `${DEMO_DATE}T12:00:00`,
    })
    const day = await fetchSchedule('maple', DEMO_DATE)
    expect(day.appointments.find((a) => a.id === visit.id)?.patientId).toBe(
      'p-grace',
    )
  })

  it("won't book at another office, or without signing in", async () => {
    const token = await signInAs('grace.liu@example.com')
    await expectApiError(
      bookMyVisit(token, {
        practiceId: 'riverbend',
        type: 'exam',
        start: `${DEMO_DATE}T11:30:00`,
      }),
      403,
    )
    await expectApiError(
      bookMyVisit('not-a-token', {
        practiceId: 'maple',
        type: 'exam',
        start: `${DEMO_DATE}T11:30:00`,
      }),
      401,
    )
  })

  it('says the time was taken when no chair is free then', async () => {
    const grace = await signInAs('grace.liu@example.com')
    const owen = await signInAs('owen.hart@example.com')
    const start = `${DEMO_DATE}T11:30:00`
    await bookMyVisit(grace, { practiceId: 'maple', type: 'cleaning', start })
    // 11:30 had one free chair; it's gone now.
    await expectApiError(
      bookMyVisit(owen, { practiceId: 'maple', type: 'cleaning', start }),
      409,
    )
  })

  it("won't book a visit type patients can't book themselves", async () => {
    const token = await signInAs('grace.liu@example.com')
    await expectApiError(
      bookMyVisit(token, {
        practiceId: 'maple',
        type: 'crown',
        start: `${DEMO_DATE}T11:30:00`,
      }),
      400,
    )
  })
})

describe('booking in the past', () => {
  it("won't book a time before the demo clock", async () => {
    const token = await signInAs('grace.liu@example.com')
    await expectApiError(
      bookMyVisit(token, {
        practiceId: 'maple',
        type: 'exam',
        start: `${DEMO_DATE}T08:00:00`,
      }),
      409,
    )
  })
})
