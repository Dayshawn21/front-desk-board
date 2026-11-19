import { describe, expect, it } from 'vitest'
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
