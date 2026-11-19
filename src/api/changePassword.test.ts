import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_DATE } from '../config'
import { DEMO_PATIENT_PASSWORD } from '../mocks/patientLogins'
import {
  changeMyPassword,
  fetchMyAccount,
  patientSignIn,
} from './patientPortal'
import { ApiError, MOCK_DB_KEY } from './schedule'

// A signed-in patient changes their password: they must know the current
// one, the new one is stored as a salted hash, and every other session for
// them ends (this one stays signed in).

const OWEN = 'owen.hart@example.com'

async function signIn(password = DEMO_PATIENT_PASSWORD) {
  return (await patientSignIn(OWEN, password)).token
}

async function apiError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('changing the password while signed in', () => {
  it('changes it: the new one works, the old one stops', async () => {
    const token = await signIn()
    await changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass')

    await expect(signIn('brand new pass')).resolves.toEqual(expect.any(String))
    expect((await apiError(signIn())).status).toBe(401)
    expect(localStorage.getItem(MOCK_DB_KEY)).not.toContain('brand new pass')
  })

  it('keeps this session, and signs out every other one', async () => {
    const here = await signIn()
    const elsewhere = await signIn()
    await changeMyPassword(here, DEMO_PATIENT_PASSWORD, 'brand new pass')

    await expect(fetchMyAccount(here, DEMO_DATE)).resolves.toBeDefined()
    expect((await apiError(fetchMyAccount(elsewhere, DEMO_DATE))).status).toBe(
      401,
    )
  })

  it('needs the current password', async () => {
    const token = await signIn()
    const wrong = await apiError(
      changeMyPassword(token, 'not my password', 'brand new pass'),
    )
    expect(wrong.status).toBe(400)
    expect(wrong.message).toBe("Your current password isn't right.")
    // Nothing changed.
    await expect(signIn()).resolves.toEqual(expect.any(String))
  })

  it('needs a new password of at least 8 characters', async () => {
    const token = await signIn()
    const short = await apiError(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'short'),
    )
    expect(short.message).toBe('Use a password of at least 8 characters.')
  })

  it('needs the new password to be different', async () => {
    const token = await signIn()
    const same = await apiError(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, DEMO_PATIENT_PASSWORD),
    )
    expect(same.message).toBe(
      'Choose a new password that is different from the current one.',
    )
  })

  it('needs a signed-in session', async () => {
    expect(
      (
        await apiError(
          changeMyPassword('not-a-token', DEMO_PATIENT_PASSWORD, 'brand new'),
        )
      ).status,
    ).toBe(401)
  })
})

describe('the change-password rate limit', () => {
  // 5 wrong current passwords per patient in 15 minutes, then a lock.
  afterEach(() => {
    vi.useRealTimers()
  })

  async function wrongTries(token: string, times: number) {
    for (let i = 0; i < times; i++) {
      expect(
        (await apiError(changeMyPassword(token, 'guess', 'brand new pass')))
          .status,
      ).toBe(400)
    }
  }

  it('locks after 5 wrong tries, even with the right password', async () => {
    const token = await signIn()
    await wrongTries(token, 5)

    const locked = await apiError(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass'),
    )
    expect(locked.status).toBe(429)
    expect(locked.message).toBe(
      'Too many tries. Try again in 15 minutes, or reset your password.',
    )
    // Nothing changed.
    await expect(signIn()).resolves.toEqual(expect.any(String))
  })

  it('says how long is left, and unlocks after 15 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    const token = await signIn()
    await wrongTries(token, 5)

    vi.setSystemTime(new Date('2026-11-17T10:05:30Z'))
    expect(
      (await apiError(changeMyPassword(token, 'guess', 'brand new pass')))
        .message,
    ).toMatch(/Try again in 10 minutes/)

    vi.setSystemTime(new Date('2026-11-17T10:15:01Z'))
    await expect(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass'),
    ).resolves.toBeUndefined()
  })

  it("doesn't count tries made while locked", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    const token = await signIn()
    await wrongTries(token, 5)
    vi.setSystemTime(new Date('2026-11-17T10:10:00Z'))
    await apiError(changeMyPassword(token, 'guess', 'brand new pass')) // 429
    // The lock still ends 15 minutes after the 5th wrong try.
    vi.setSystemTime(new Date('2026-11-17T10:15:01Z'))
    await expect(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass'),
    ).resolves.toBeUndefined()
  })

  it('counts per patient, not per session', async () => {
    const first = await signIn()
    await wrongTries(first, 5)
    // Signing in again doesn't start a fresh count.
    const second = await signIn()
    expect(
      (
        await apiError(
          changeMyPassword(second, DEMO_PATIENT_PASSWORD, 'brand new pass'),
        )
      ).status,
    ).toBe(429)
    // Another patient isn't affected.
    const ravi = (
      await patientSignIn('ravi.menon@example.com', DEMO_PATIENT_PASSWORD)
    ).token
    await expect(
      changeMyPassword(ravi, DEMO_PATIENT_PASSWORD, 'brand new pass'),
    ).resolves.toBeUndefined()
  })

  it('a successful change clears the count', async () => {
    const token = await signIn()
    await wrongTries(token, 4)
    await changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass')
    await wrongTries(token, 4)
    await expect(
      changeMyPassword(token, 'brand new pass', 'another new pass'),
    ).resolves.toBeUndefined()
  })

  it("doesn't count a refused new password as a wrong guess", async () => {
    const token = await signIn()
    for (let i = 0; i < 6; i++) {
      await apiError(changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'short'))
    }
    await expect(
      changeMyPassword(token, DEMO_PATIENT_PASSWORD, 'brand new pass'),
    ).resolves.toBeUndefined()
  })
})
