import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_PATIENT_PASSWORD } from '../mocks/patientLogins'
import {
  fetchDemoInbox,
  patientSignIn,
  requestPasswordReset,
} from './patientPortal'
import { ApiError } from './schedule'

// Rate limits on patient sign-in (5 wrong tries per email in 15 minutes)
// and on forgot password (3 emails per address in 15 minutes).

const OWEN = 'owen.hart@example.com'

afterEach(() => {
  vi.useRealTimers()
})

async function apiError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

async function wrongSignIns(email: string, times: number) {
  for (let i = 0; i < times; i++) {
    expect((await apiError(patientSignIn(email, 'guess'))).status).toBe(401)
  }
}

describe('the sign-in rate limit', () => {
  it('locks an email after 5 wrong tries, even with the right password', async () => {
    await wrongSignIns(OWEN, 5)
    const locked = await apiError(patientSignIn(OWEN, DEMO_PATIENT_PASSWORD))
    expect(locked.status).toBe(429)
    expect(locked.message).toBe(
      'Too many tries. Try again in 15 minutes, or reset your password.',
    )
  })

  it('counts by email, whatever its case', async () => {
    await wrongSignIns(' Owen.Hart@Example.com', 5)
    expect(
      (await apiError(patientSignIn(OWEN, DEMO_PATIENT_PASSWORD))).status,
    ).toBe(429)
    // Another patient can still sign in.
    await expect(
      patientSignIn('ravi.menon@example.com', DEMO_PATIENT_PASSWORD),
    ).resolves.toHaveProperty('token')
  })

  it('locks an unknown email the same way, so it reveals nothing', async () => {
    await wrongSignIns('nobody@example.com', 5)
    expect(
      (await apiError(patientSignIn('nobody@example.com', 'guess'))).status,
    ).toBe(429)
  })

  it('unlocks 15 minutes after the 5th wrong try', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    await wrongSignIns(OWEN, 5)
    vi.setSystemTime(new Date('2026-11-17T10:14:00Z'))
    expect(
      (await apiError(patientSignIn(OWEN, DEMO_PATIENT_PASSWORD))).message,
    ).toMatch(/Try again in 1 minute,/)
    vi.setSystemTime(new Date('2026-11-17T10:15:01Z'))
    await expect(
      patientSignIn(OWEN, DEMO_PATIENT_PASSWORD),
    ).resolves.toHaveProperty('token')
  })

  it('a successful sign-in clears the count', async () => {
    await wrongSignIns(OWEN, 4)
    await patientSignIn(OWEN, DEMO_PATIENT_PASSWORD)
    await wrongSignIns(OWEN, 4)
    await expect(
      patientSignIn(OWEN, DEMO_PATIENT_PASSWORD),
    ).resolves.toHaveProperty('token')
  })
})

describe('the forgot-password rate limit', () => {
  it('sends at most 3 emails per address in 15 minutes, answering the same', async () => {
    for (let i = 0; i < 5; i++) {
      // Every request gets the same answer, sent or not.
      await expect(requestPasswordReset(OWEN)).resolves.toBeUndefined()
    }
    expect(await fetchDemoInbox()).toHaveLength(3)
  })

  it('sends again once 15 minutes have passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    for (let i = 0; i < 4; i++) await requestPasswordReset(OWEN)
    expect(await fetchDemoInbox()).toHaveLength(3)

    vi.setSystemTime(new Date('2026-11-17T10:15:01Z'))
    await requestPasswordReset(OWEN)
    expect(await fetchDemoInbox()).toHaveLength(4)
  })

  it('counts each address on its own', async () => {
    for (let i = 0; i < 4; i++) await requestPasswordReset(OWEN)
    await requestPasswordReset('ravi.menon@example.com')
    const inbox = await fetchDemoInbox()
    expect(inbox.filter((e) => e.to === 'ravi.menon@example.com')).toHaveLength(
      1,
    )
  })
})
