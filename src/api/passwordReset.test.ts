import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_DATE } from '../config'
import { DEMO_PATIENT_PASSWORD } from '../mocks/patientLogins'
import {
  fetchDemoInbox,
  fetchMyAccount,
  patientSignIn,
  patientSignUp,
  requestPasswordReset,
  resetPassword,
} from './patientPortal'
import { ApiError, MOCK_DB_KEY, resetDemoData } from './schedule'

// Forgot password: the server "emails" a single-use reset link that works
// for 30 minutes. There's no real email in the demo, so sent emails land
// in a demo inbox, like a developer's mail catcher.

afterEach(() => {
  vi.useRealTimers()
})

async function apiError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

async function resetLinkFor(email: string) {
  await requestPasswordReset(email)
  const [latest] = await fetchDemoInbox()
  expect(latest.to).toBe(email)
  const url = new URL(latest.link, 'https://example.test')
  expect(url.pathname).toBe('/patient/reset-password')
  return url.searchParams.get('token') ?? ''
}

describe('asking for a reset link', () => {
  it('emails a reset link to an account that exists', async () => {
    await requestPasswordReset('  Owen.Hart@example.com ')
    const inbox = await fetchDemoInbox()
    expect(inbox).toHaveLength(1)
    expect(inbox[0]).toMatchObject({
      to: 'owen.hart@example.com',
      subject: 'Reset your password',
    })
    expect(inbox[0].body).toMatch(/30 minutes/)
    expect(inbox[0].link).toMatch(/^\/patient\/reset-password\?token=\w{20,}/)
  })

  it('answers the same for an unknown email, and sends nothing', async () => {
    await expect(
      requestPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined()
    expect(await fetchDemoInbox()).toEqual([])
  })

  it('keeps only a hash of the reset token', async () => {
    const token = await resetLinkFor('owen.hart@example.com')
    const db = JSON.parse(localStorage.getItem(MOCK_DB_KEY) ?? '{}') as {
      passwordResets: unknown[]
    }
    expect(db.passwordResets).toHaveLength(1)
    expect(JSON.stringify(db.passwordResets)).not.toContain(token)
  })
})

describe('setting a new password', () => {
  it('changes the password: the new one works, the old one stops', async () => {
    const token = await resetLinkFor('owen.hart@example.com')
    await resetPassword(token, 'brand new pass')

    await expect(
      patientSignIn('owen.hart@example.com', 'brand new pass'),
    ).resolves.toHaveProperty('token')
    expect(
      (
        await apiError(
          patientSignIn('owen.hart@example.com', DEMO_PATIENT_PASSWORD),
        )
      ).status,
    ).toBe(401)
  })

  it('never stores the new password itself', async () => {
    const token = await resetLinkFor('owen.hart@example.com')
    await resetPassword(token, 'brand new pass')
    expect(localStorage.getItem(MOCK_DB_KEY)).not.toContain('brand new pass')
  })

  it('works for an account made on the sign-up page', async () => {
    await patientSignUp({
      practiceId: 'maple',
      firstName: 'Zoe',
      lastName: 'Quill',
      email: 'zoe.quill@example.com',
      phone: '555-0199',
      password: 'first password',
    })
    const token = await resetLinkFor('zoe.quill@example.com')
    await resetPassword(token, 'second password')
    await expect(
      patientSignIn('zoe.quill@example.com', 'second password'),
    ).resolves.toHaveProperty('token')
    expect(
      (await apiError(patientSignIn('zoe.quill@example.com', 'first password')))
        .status,
    ).toBe(401)
  })

  it('signs the patient out everywhere', async () => {
    const { token: session } = await patientSignIn(
      'owen.hart@example.com',
      DEMO_PATIENT_PASSWORD,
    )
    const token = await resetLinkFor('owen.hart@example.com')
    await resetPassword(token, 'brand new pass')
    expect((await apiError(fetchMyAccount(session, DEMO_DATE))).status).toBe(
      401,
    )
  })

  it('works once: a used link is refused', async () => {
    const token = await resetLinkFor('owen.hart@example.com')
    await resetPassword(token, 'brand new pass')
    const again = await apiError(resetPassword(token, 'another pass'))
    expect(again.status).toBe(400)
    expect(again.message).toBe(
      'This reset link has expired or was already used. Ask for a new one.',
    )
  })

  it('stops working after 30 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
    const token = await resetLinkFor('owen.hart@example.com')
    vi.setSystemTime(new Date('2026-11-17T10:31:00Z'))
    expect(
      (await apiError(resetPassword(token, 'brand new pass'))).status,
    ).toBe(400)
  })

  it('refuses a made-up token, and a short password', async () => {
    expect(
      (await apiError(resetPassword('not-a-token', 'brand new pass'))).message,
    ).toMatch(/expired or was already used/)

    const token = await resetLinkFor('owen.hart@example.com')
    const short = await apiError(resetPassword(token, 'short'))
    expect(short.message).toBe('Use a password of at least 8 characters.')
    // The link still works after a refused password.
    await expect(resetPassword(token, 'long enough')).resolves.toBeUndefined()
  })

  it('a newer link replaces older ones', async () => {
    const first = await resetLinkFor('owen.hart@example.com')
    const second = await resetLinkFor('owen.hart@example.com')
    await resetPassword(second, 'brand new pass')
    expect((await apiError(resetPassword(first, 'other pass'))).status).toBe(
      400,
    )
  })

  it('Reset demo data clears the inbox and changed passwords', async () => {
    const token = await resetLinkFor('owen.hart@example.com')
    await resetPassword(token, 'brand new pass')
    resetDemoData()
    expect(await fetchDemoInbox()).toEqual([])
    await expect(
      patientSignIn('owen.hart@example.com', DEMO_PATIENT_PASSWORD),
    ).resolves.toHaveProperty('token')
  })
})
