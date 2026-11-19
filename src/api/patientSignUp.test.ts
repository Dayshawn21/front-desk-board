import { describe, expect, it } from 'vitest'
import { DEMO_DATE } from '../config'
import {
  bookMyVisit,
  fetchMyAccount,
  patientSignIn,
  patientSignUp,
  type NewPatientAccount,
} from './patientPortal'
import { ApiError, fetchSchedule, MOCK_DB_KEY, resetDemoData } from './schedule'

// A new patient creates an account: the mock server adds them to the
// practice, stores a salted hash of the password (never the password), and
// signs them in.

const zoe: NewPatientAccount = {
  practiceId: 'riverbend',
  firstName: 'Zoe',
  lastName: 'Quill',
  email: 'zoe.quill@example.com',
  phone: '555-0199',
  password: 'correct horse',
}

async function apiError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('patient sign-up', () => {
  it('creates the account and signs the new patient in', async () => {
    const { token } = await patientSignUp(zoe)
    const account = await fetchMyAccount(token, DEMO_DATE)
    expect(account.patient).toMatchObject({
      firstName: 'Zoe',
      lastName: 'Quill',
      email: 'zoe.quill@example.com',
      phone: '555-0199',
      insuranceProvider: null,
    })
    expect(account.practice.id).toBe('riverbend')
    expect(account.visits).toEqual([])
  })

  it('lets them sign in again with their password, and only that', async () => {
    await patientSignUp(zoe)
    await expect(
      patientSignIn('Zoe.Quill@example.com', 'correct horse'),
    ).resolves.toHaveProperty('token')
    expect((await apiError(patientSignIn(zoe.email, 'demo1234'))).status).toBe(
      401,
    )
  })

  it('never stores the password itself', async () => {
    await patientSignUp(zoe)
    const stored = localStorage.getItem(MOCK_DB_KEY) ?? ''
    expect(stored).toContain('zoe.quill@example.com')
    expect(stored).not.toContain('correct horse')
  })

  it('tidies what was typed', async () => {
    const { token } = await patientSignUp({
      ...zoe,
      firstName: '  Zoe ',
      email: ' ZOE.Quill@Example.com ',
    })
    const account = await fetchMyAccount(token, DEMO_DATE)
    expect(account.patient.firstName).toBe('Zoe')
    expect(account.patient.email).toBe('zoe.quill@example.com')
  })

  it('refuses an email that already has an account', async () => {
    const taken = await apiError(
      patientSignUp({ ...zoe, email: 'Owen.Hart@example.com' }),
    )
    expect(taken.status).toBe(409)
    expect(taken.message).toBe(
      'An account with that email already exists. Sign in instead.',
    )

    await patientSignUp(zoe)
    expect((await apiError(patientSignUp(zoe))).status).toBe(409)
  })

  it.each([
    [{ password: 'short' }, 'Use a password of at least 8 characters.'],
    [{ email: 'not-an-email' }, 'Enter an email like name@example.com.'],
    [{ firstName: '  ' }, 'Enter your first and last name.'],
    [{ phone: '12' }, 'Enter a phone number we can reach you on.'],
    [{ practiceId: 'nowhere' }, 'Choose your dental office.'],
  ])('checks what was typed: %o', async (change, message) => {
    const error = await apiError(patientSignUp({ ...zoe, ...change }))
    expect(error.status).toBe(400)
    expect(error.message).toBe(message)
  })

  it('puts the new patient on their office’s list, so they can book', async () => {
    const { token } = await patientSignUp(zoe)
    const day = await fetchSchedule('riverbend', DEMO_DATE)
    expect(
      day.patients.some((p) => p.firstName === 'Zoe' && p.lastName === 'Quill'),
    ).toBe(true)
    const maple = await fetchSchedule('maple', DEMO_DATE)
    expect(maple.patients.some((p) => p.firstName === 'Zoe')).toBe(false)

    const visit = await bookMyVisit(token, {
      practiceId: 'riverbend',
      type: 'exam',
      start: `${DEMO_DATE}T13:00:00`,
    })
    expect(visit.status).toBe('scheduled')
  })

  it('is removed by Reset demo data', async () => {
    await patientSignUp(zoe)
    resetDemoData()
    expect(
      (await apiError(patientSignIn(zoe.email, zoe.password))).status,
    ).toBe(401)
  })
})
