import { describe, expect, it } from 'vitest'
import type {
  Appointment,
  Fee,
  FeeCategory,
  InsuranceCoverage,
  Payment,
  ScheduleDay,
} from '../types'
import {
  balanceDue,
  daySummary,
  estimateVisit,
  formatCents,
  lineItemsFor,
  parseDollars,
  paymentToastText,
  visitBilling,
} from './billing'

// Fake fees and plans, made up for these tests. Money is integer cents.

const fee = (category: FeeCategory, cents: number, name = 'Item'): Fee => ({
  id: `f-${name}-${cents}`,
  practiceId: 'maple',
  procedure: name,
  name,
  category,
  cents,
})

const plan = (
  percent: Partial<Record<FeeCategory, number>> = {},
  remainingCents = 150_000,
): InsuranceCoverage => ({
  percent: { preventive: 100, basic: 80, major: 50, ...percent },
  annualMaxCents: 150_000,
  remainingCents,
})

describe('estimateVisit', () => {
  // [what, line items, plan, insurance pays, patient pays]
  it.each([
    [
      'no insurance: the patient pays it all',
      [fee('basic', 18_000)],
      null,
      0,
      18_000,
    ],
    ['preventive at 100%', [fee('preventive', 9_500)], plan(), 9_500, 0],
    ['basic at 80%', [fee('basic', 19_500)], plan(), 15_600, 3_900],
    ['major at 50%', [fee('major', 110_000)], plan(), 55_000, 55_000],
    [
      'mixed categories add up line by line',
      [fee('preventive', 4_000), fee('basic', 15_000), fee('major', 90_000)],
      plan(),
      61_000, // 4,000 + 12,000 + 45,000
      48_000,
    ],
    ['nothing to bill', [], plan(), 0, 0],
    [
      'a plan that pays 0% for a category',
      [fee('major', 50_000)],
      plan({ major: 0 }),
      0,
      50_000,
    ],
  ] as const)('%s', (_what, items, coverage, insurance, patient) => {
    const estimate = estimateVisit([...items], coverage)
    expect(estimate.insuranceCents).toBe(insurance)
    expect(estimate.patientCents).toBe(patient)
    expect(estimate.insuranceCents + estimate.patientCents).toBe(
      estimate.totalCents,
    )
  })

  // The rounding rule: each line's insurance share is rounded DOWN to a
  // whole cent; the patient pays the rest. So the shares always add up to
  // the total, and a fraction of a cent always lands on the patient's side.
  it.each([
    [
      '70% of $123.45 is $86.415',
      [fee('basic', 12_345)],
      { basic: 70 },
      8_641,
      3_704,
    ],
    ['50% of 99¢ is 49.5¢', [fee('major', 99)], {}, 49, 50],
    [
      'rounded per line, not on the total',
      [fee('major', 99, 'a'), fee('major', 99, 'b')],
      {},
      98, // 49 + 49, not floor(99)
      100,
    ],
    [
      'an exact share is not rounded',
      [fee('basic', 12_500)],
      {},
      10_000,
      2_500,
    ],
  ] as const)('rounding: %s', (_what, items, percent, insurance, patient) => {
    const estimate = estimateVisit([...items], plan(percent))
    expect(estimate.insuranceCents).toBe(insurance)
    expect(estimate.patientCents).toBe(patient)
  })

  // [what, remaining benefit, insurance pays, patient pays, maximum reached]
  it.each([
    ['plenty of benefit left', 150_000, 61_000, 48_000, false],
    ['exactly enough left', 61_000, 61_000, 48_000, false],
    [
      'partly used up: insurance pays what is left',
      20_000,
      20_000,
      89_000,
      true,
    ],
    ['maximum already reached', 0, 0, 109_000, true],
  ] as const)(
    'annual maximum: %s',
    (_what, remaining, insurance, patient, maximumReached) => {
      const items = [
        fee('preventive', 4_000),
        fee('basic', 15_000),
        fee('major', 90_000),
      ]
      const estimate = estimateVisit(items, plan({}, remaining))
      expect(estimate.totalCents).toBe(109_000)
      expect(estimate.coveredCents).toBe(61_000) // before the maximum
      expect(estimate.insuranceCents).toBe(insurance)
      expect(estimate.patientCents).toBe(patient)
      expect(estimate.maximumReached).toBe(maximumReached)
    },
  )
})

const payment = (cents: number, overrides: Partial<Payment> = {}): Payment => ({
  id: `pay-${cents}`,
  practiceId: 'maple',
  appointmentId: 'a-01',
  cents,
  method: 'card',
  recordedAt: '2026-11-17T09:41:00',
  voided: false,
  tickedCopay: false,
  ...overrides,
})

describe('balanceDue', () => {
  it.each([
    ['nothing paid yet', 3_900, [], 3_900],
    ['paid in part', 3_900, [payment(2_000)], 1_900],
    ['paid in full', 3_900, [payment(2_000), payment(1_900)], 0],
    [
      'voided payments do not count',
      3_900,
      [payment(3_900, { voided: true })],
      3_900,
    ],
    ['never below zero', 0, [payment(500)], 0],
  ] as const)('%s', (_what, share, payments, expected) => {
    expect(balanceDue(share, [...payments])).toBe(expected)
  })
})

describe('parseDollars', () => {
  it.each([
    ['45', 4_500],
    ['45.5', 4_550],
    ['45.50', 4_550],
    ['$1,234.56', 123_456],
    [' 12.00 ', 1_200],
    ['0', 0],
    ['.75', 75],
  ])('%j is %d cents', (text, cents) => {
    expect(parseDollars(text)).toBe(cents)
  })

  it.each(['', 'abc', '1.234', '-5', '12.3.4', '$', '1e3'])(
    '%j is not an amount',
    (text) => {
      expect(parseDollars(text)).toBeNull()
    },
  )
})

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [3_900, '$39.00'],
    [123_456, '$1,234.56'],
  ])('%d cents is %s', (cents, text) => {
    expect(formatCents(cents)).toBe(text)
  })
})

describe('lineItemsFor', () => {
  const fees: Fee[] = [
    { ...fee('preventive', 9_500), procedure: 'routine-cleaning' },
    { ...fee('preventive', 6_000), procedure: 'periodic-exam' },
    { ...fee('preventive', 7_000), procedure: 'bitewing-xrays' },
    { ...fee('basic', 19_500), procedure: 'tooth-colored-filling' },
  ]

  it('bills each visit type from the practice fee list', () => {
    expect(lineItemsFor('cleaning', fees).map((f) => f.procedure)).toEqual([
      'routine-cleaning',
      'periodic-exam',
      'bitewing-xrays',
    ])
    expect(lineItemsFor('filling', fees).map((f) => f.procedure)).toEqual([
      'tooth-colored-filling',
    ])
  })

  it('leaves out a procedure the practice has no fee for', () => {
    expect(lineItemsFor('crown', fees)).toEqual([])
  })
})

// A tiny made-up day: one checked-out insured visit, one checked-out
// self-pay visit, one visit still in the chair (not billed yet).
function testDay(payments: Payment[] = []): ScheduleDay {
  const fees: Fee[] = [
    { ...fee('preventive', 10_000), procedure: 'routine-cleaning' },
    { ...fee('preventive', 5_000), procedure: 'periodic-exam' },
    { ...fee('preventive', 5_000), procedure: 'bitewing-xrays' },
    { ...fee('basic', 20_000), procedure: 'tooth-colored-filling' },
  ]
  const visit = (
    id: string,
    patientId: string,
    type: Appointment['type'],
    status: Appointment['status'],
  ): Appointment => ({
    id,
    practiceId: 'maple',
    patientId,
    chairId: 'maple-c1',
    start: '2026-11-17T08:00:00',
    end: '2026-11-17T09:00:00',
    type,
    status,
    checklist: {
      insuranceVerified: true,
      formsComplete: true,
      medicalHistoryReviewed: true,
      copayCollected: false,
    },
    notes: '',
  })
  return {
    practice: {
      id: 'maple',
      name: 'Maple Street Dental',
      openTime: '08:00',
      closeTime: '17:00',
    },
    date: '2026-11-17',
    chairs: [],
    patients: [
      {
        id: 'p-1',
        practiceId: 'maple',
        firstName: 'A',
        lastName: 'One',
        phone: '555-0100',
        insuranceProvider: 'Plan',
        insurance: plan(),
      },
      {
        id: 'p-2',
        practiceId: 'maple',
        firstName: 'B',
        lastName: 'Two',
        phone: '555-0101',
        insuranceProvider: null,
        insurance: null,
      },
    ],
    appointments: [
      visit('v-1', 'p-1', 'filling', 'completed'), // insurance 16,000; patient 4,000
      visit('v-2', 'p-2', 'cleaning', 'completed'), // patient 20,000
      visit('v-3', 'p-1', 'filling', 'in-chair'), // not billed yet
    ],
    fees,
    payments,
  }
}

describe('visitBilling', () => {
  it('puts line items, estimate, payments and balance together', () => {
    const day = testDay([
      payment(1_500, { appointmentId: 'v-1' }),
      payment(9_999, { appointmentId: 'v-2' }), // another visit's
    ])
    const billing = visitBilling(day, day.appointments[0])
    expect(billing.items.map((f) => f.procedure)).toEqual([
      'tooth-colored-filling',
    ])
    expect(billing.estimate.patientCents).toBe(4_000)
    expect(billing.paidCents).toBe(1_500)
    expect(billing.balanceCents).toBe(2_500)
  })
})

describe('daySummary', () => {
  it('totals checked-out visits only: billed, collected, outstanding', () => {
    const day = testDay([
      payment(4_000, { id: 'x', appointmentId: 'v-1' }),
      payment(5_000, { id: 'y', appointmentId: 'v-2' }),
      payment(7_000, { id: 'z', appointmentId: 'v-2', voided: true }),
    ])
    expect(daySummary(day)).toEqual({
      billedCents: 24_000, // patient shares: 4,000 + 20,000
      collectedCents: 9_000,
      outstandingCents: 15_000,
      insuranceEstimateCents: 16_000,
      visits: 2,
    })
  })

  it('is all zeros before anyone checks out', () => {
    const day = testDay()
    day.appointments = day.appointments.filter((a) => a.status !== 'completed')
    expect(daySummary(day)).toEqual({
      billedCents: 0,
      collectedCents: 0,
      outstandingCents: 0,
      insuranceEstimateCents: 0,
      visits: 0,
    })
  })
})

describe('paymentToastText', () => {
  it.each([
    ['card', 'Ana Diaz: $39.00 paid by card'],
    ['cash', 'Ana Diaz: $39.00 paid in cash'],
    ['other', 'Ana Diaz: $39.00 paid (other)'],
  ] as const)('%s', (method, text) => {
    expect(paymentToastText({ name: 'Ana Diaz', cents: 3_900, method })).toBe(
      text,
    )
  })
})
