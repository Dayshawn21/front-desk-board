import { describe, expect, it } from 'vitest'
import { DEMO_DATE } from '../config'
import { visitBilling } from '../lib/billing'
import {
  ApiError,
  fetchSchedule,
  recordPayment,
  updateAppointment,
  voidPayment,
} from './schedule'

// Pretend payments only: nothing is charged. In the seed, Ana Diaz (a-01,
// Maple) is checked out and owes $190.00: her cleaning is $250.00 and her
// plan has only $60.00 of benefit left this year.
const ANA_VISIT = 'a-01'
const ANA_SHARE = 19_000

async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  message?: RegExp,
) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect((error as ApiError).status).toBe(status)
  if (message) expect((error as ApiError).message).toMatch(message)
}

async function anaBilling() {
  const day = await fetchSchedule('maple', DEMO_DATE)
  const visit = day.appointments.find((a) => a.id === ANA_VISIT)!
  return { day, visit, billing: visitBilling(day, visit) }
}

describe('recordPayment', () => {
  it('starts with Ana owing her share, copay not collected', async () => {
    const { visit, billing } = await anaBilling()
    expect(billing.estimate.patientCents).toBe(ANA_SHARE)
    expect(billing.balanceCents).toBe(ANA_SHARE)
    expect(visit.checklist.copayCollected).toBe(false)
  })

  it('saves the payment, which the next fetch returns, and ticks "Copay collected"', async () => {
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 5_000,
      method: 'card',
    })
    expect(payment).toMatchObject({
      appointmentId: ANA_VISIT,
      practiceId: 'maple',
      cents: 5_000,
      method: 'card',
      voided: false,
      tickedCopay: true,
    })

    const { visit, billing } = await anaBilling()
    expect(billing.payments).toEqual([payment])
    expect(billing.balanceCents).toBe(ANA_SHARE - 5_000)
    expect(visit.checklist.copayCollected).toBe(true)
  })

  it('allows paying in parts, up to the balance and no more', async () => {
    await recordPayment('maple', ANA_VISIT, { cents: 10_000, method: 'cash' })
    await expectApiError(
      recordPayment('maple', ANA_VISIT, { cents: 9_001, method: 'card' }),
      400,
      /more than the \$90\.00 balance/,
    )
    await recordPayment('maple', ANA_VISIT, { cents: 9_000, method: 'card' })
    expect((await anaBilling()).billing.balanceCents).toBe(0)
  })

  it('does not say it ticked the copay box when it was already ticked', async () => {
    await updateAppointment('maple', ANA_VISIT, {
      checklist: { copayCollected: true },
    })
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 1_000,
      method: 'other',
    })
    expect(payment.tickedCopay).toBe(false)
  })

  // [what, amount in cents]
  it.each([
    ['zero', 0],
    ['negative', -500],
    ['a fraction of a cent', 10.5],
    ['not a number', Number.NaN],
  ])('refuses an amount that is %s', async (_what, cents) => {
    await expectApiError(
      recordPayment('maple', ANA_VISIT, { cents, method: 'card' }),
      400,
    )
  })

  it('refuses an unknown payment method', async () => {
    await expectApiError(
      recordPayment('maple', ANA_VISIT, {
        cents: 1_000,
        method: 'cheque' as 'card',
      }),
      400,
    )
  })

  it('refuses a visit with nothing to collect', async () => {
    // Tomás Reyes (a-09): a consult his plan pays in full.
    await expectApiError(
      recordPayment('maple', 'a-09', { cents: 100, method: 'card' }),
      400,
      /nothing to collect/i,
    )
  })

  it('only takes payment once the visit is checked out', async () => {
    // Marcus Bell (a-02) is still in the chair.
    await expectApiError(
      recordPayment('maple', 'a-02', { cents: 1_000, method: 'card' }),
      409,
    )
  })

  it("treats another practice's visit as not found (tenant check)", async () => {
    // a-16 is Riverbend's.
    await expectApiError(
      recordPayment('maple', 'a-16', { cents: 1_000, method: 'card' }),
      404,
    )
  })
})

describe('voidPayment (Undo)', () => {
  it('marks the payment voided, keeps the record, and unticks the copay it ticked', async () => {
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 5_000,
      method: 'card',
    })
    const voided = await voidPayment('maple', payment.id)
    expect(voided).toEqual({ ...payment, voided: true })

    const { visit, billing } = await anaBilling()
    expect(billing.payments).toEqual([voided]) // still there, for history
    expect(billing.balanceCents).toBe(ANA_SHARE)
    expect(visit.checklist.copayCollected).toBe(false)
  })

  it('leaves the copay ticked when the payment did not tick it', async () => {
    await updateAppointment('maple', ANA_VISIT, {
      checklist: { copayCollected: true },
    })
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 5_000,
      method: 'card',
    })
    await voidPayment('maple', payment.id)
    expect((await anaBilling()).visit.checklist.copayCollected).toBe(true)
  })

  it('refuses to void a payment twice', async () => {
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 5_000,
      method: 'card',
    })
    await voidPayment('maple', payment.id)
    await expectApiError(voidPayment('maple', payment.id), 409)
  })

  it("treats another practice's payment as not found (tenant check)", async () => {
    const payment = await recordPayment('maple', ANA_VISIT, {
      cents: 5_000,
      method: 'card',
    })
    await expectApiError(voidPayment('riverbend', payment.id), 404)
  })
})
