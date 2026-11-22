import type {
  Appointment,
  AppointmentType,
  Fee,
  InsuranceCoverage,
  Payment,
  PaymentMethod,
  ScheduleDay,
} from '../types'

// Checkout billing rules, kept apart from React so they're easy to read and
// test. All fees and plans are made up. Money is integer cents everywhere:
// floating-point dollars can't hold amounts like $0.10 exactly.

// What each visit type bills, by made-up procedure key. Each practice sets
// its own price for each key in its fee list. Fixed per type for now;
// editing a visit's line items is in docs/NEXT.md.
const visitProcedures: Record<AppointmentType, string[]> = {
  cleaning: ['routine-cleaning', 'periodic-exam', 'bitewing-xrays'],
  exam: ['comprehensive-exam', 'full-mouth-xrays'],
  filling: ['tooth-colored-filling'],
  crown: ['porcelain-crown', 'core-buildup'],
  consult: ['treatment-consult'],
  emergency: ['limited-exam', 'single-xray', 'pain-relief-visit'],
}

export function lineItemsFor(type: AppointmentType, fees: Fee[]): Fee[] {
  return visitProcedures[type].flatMap((procedure) =>
    fees.filter((f) => f.procedure === procedure),
  )
}

export type Estimate = {
  totalCents: number
  coveredCents: number // what the plan would pay before its annual maximum
  insuranceCents: number // after the maximum
  patientCents: number
  maximumReached: boolean // the plan pays less than its share this visit
}

// The rounding rule: each line's insurance share is rounded DOWN to a whole
// cent, and the patient pays the rest of that line. So the two shares always
// add up to the total, and a fraction of a cent always lands on the
// patient's side. Then the plan pays no more than its remaining benefit.
// (A real estimate also has deductibles, frequency limits and waiting
// periods; see docs/NEXT.md.)
export function estimateVisit(
  items: Pick<Fee, 'category' | 'cents'>[],
  insurance: InsuranceCoverage | null,
): Estimate {
  const totalCents = items.reduce((sum, item) => sum + item.cents, 0)
  const coveredCents = insurance
    ? items.reduce(
        (sum, item) =>
          sum +
          Math.floor((item.cents * insurance.percent[item.category]) / 100),
        0,
      )
    : 0
  const remaining = Math.max(0, insurance?.remainingCents ?? 0)
  const insuranceCents = Math.min(coveredCents, remaining)
  return {
    totalCents,
    coveredCents,
    insuranceCents,
    patientCents: totalCents - insuranceCents,
    maximumReached: insuranceCents < coveredCents,
  }
}

// Voided payments (undone) don't count. Never below zero.
export function balanceDue(patientCents: number, payments: Payment[]): number {
  return Math.max(0, patientCents - paidCents(payments))
}

function paidCents(payments: Payment[]): number {
  return payments.filter((p) => !p.voided).reduce((sum, p) => sum + p.cents, 0)
}

// "45", "45.5", "$1,234.56" -> cents. Null if it isn't a plain amount
// (negative, more than two decimals, letters…).
export function parseDollars(text: string): number | null {
  const plain = text.trim().replace(/^\$/, '').replace(/,/g, '')
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(plain)
  if (!match || (match[1] === '' && !match[2])) return null
  const dollars = Number(match[1] || '0')
  const cents = Number((match[2] ?? '').padEnd(2, '0'))
  return dollars * 100 + cents
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatCents(cents: number): string {
  return usd.format(cents / 100)
}

export type VisitBilling = {
  items: Fee[]
  estimate: Estimate
  payments: Payment[] // this visit's, voided ones included
  paidCents: number
  balanceCents: number
}

// Everything the drawer's Billing section shows for one visit.
export function visitBilling(
  day: ScheduleDay,
  appointment: Appointment,
): VisitBilling {
  const items = lineItemsFor(appointment.type, day.fees)
  const patient = day.patients.find((p) => p.id === appointment.patientId)
  const estimate = estimateVisit(items, patient?.insurance ?? null)
  const payments = day.payments.filter(
    (p) => p.appointmentId === appointment.id,
  )
  return {
    items,
    estimate,
    payments,
    paidCents: paidCents(payments),
    balanceCents: balanceDue(estimate.patientCents, payments),
  }
}

export type DaySummary = {
  billedCents: number // patient shares of checked-out visits
  collectedCents: number
  outstandingCents: number
  insuranceEstimateCents: number // claims are out of scope; shown as an estimate
  visits: number // checked-out visits counted
}

// The office manager's Today totals. Only checked-out visits are billed.
export function daySummary(day: ScheduleDay): DaySummary {
  const summary: DaySummary = {
    billedCents: 0,
    collectedCents: 0,
    outstandingCents: 0,
    insuranceEstimateCents: 0,
    visits: 0,
  }
  for (const appointment of day.appointments) {
    if (appointment.status !== 'completed') continue
    const billing = visitBilling(day, appointment)
    summary.billedCents += billing.estimate.patientCents
    summary.collectedCents += billing.paidCents
    summary.outstandingCents += billing.balanceCents
    summary.insuranceEstimateCents += billing.estimate.insuranceCents
    summary.visits += 1
  }
  return summary
}

const paidHow: Record<PaymentMethod, string> = {
  card: 'by card',
  cash: 'in cash',
  other: '(other)',
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
}

export function paymentToastText({
  name,
  cents,
  method,
}: {
  name: string
  cents: number
  method: PaymentMethod
}): string {
  return `${name}: ${formatCents(cents)} paid ${paidHow[method]}`
}

export function paymentUndoneText({
  name,
  cents,
}: {
  name: string
  cents: number
}): string {
  return `${name}: payment of ${formatCents(cents)} undone`
}

// Cents as the amount field shows it: 14000 -> "140.00" (no $ or commas).
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
