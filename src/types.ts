// All data in this app is fake. No real patient or health information.

export type Role = 'front-desk' | 'provider' | 'office-manager'

// A staff member who can sign in. Demo users only; see src/mocks/users.ts.
export type StaffUser = {
  id: string
  name: string
  title: string // job title shown to people, e.g. "Front Desk Coordinator"
  role: Role // what they're allowed to do (see src/lib/permissions.ts)
  practiceId: string // home practice; only the office manager can switch away
}

export type Practice = {
  id: string
  name: string
  openTime: string // "08:00", 24h local time
  closeTime: string // "17:00"
}

export type Chair = {
  id: string
  practiceId: string
  name: string // e.g. "Chair 1"
  provider: string // fake provider name
}

export type Patient = {
  id: string
  practiceId: string
  firstName: string
  lastName: string
  phone: string // fake 555 numbers only
  insuranceProvider: string | null // null = self-pay / not on file
  insurance: InsuranceCoverage | null // the plan's made-up terms; null = self-pay
}

// ── Billing (all made up: no real fee schedules, plans or procedure codes) ──

// Plans pay a different share for each kind of work.
export type FeeCategory = 'preventive' | 'basic' | 'major'

// One line of a practice's fee list. Money is always integer cents.
export type Fee = {
  id: string
  practiceId: string
  procedure: string // a made-up key shared across practices, e.g. "routine-cleaning"
  name: string // made-up plain-language name, never a CDT code
  category: FeeCategory
  cents: number
}

// A patient's fake dental plan: what share it pays per category, and how
// much of this year's maximum is left.
export type InsuranceCoverage = {
  percent: Record<FeeCategory, number> // 0-100, e.g. { preventive: 100, … }
  annualMaxCents: number
  remainingCents: number
}

export type PaymentMethod = 'card' | 'cash' | 'other'

// A payment recorded at checkout. Pretend only: no card is charged.
// Undo marks it voided rather than deleting it, so the record stays.
export type Payment = {
  id: string
  practiceId: string
  appointmentId: string
  cents: number
  method: PaymentMethod
  recordedAt: string // ISO time
  voided: boolean
  // True if this payment is what ticked "Copay collected", so voiding it
  // unticks the box only then.
  tickedCopay: boolean
}

export type AppointmentType =
  'cleaning' | 'exam' | 'filling' | 'crown' | 'consult' | 'emergency'

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'arrived'
  | 'in-chair'
  | 'completed'
  | 'cancelled'
  | 'no-show' // never arrived; set after the start time has passed

// Why a visit was cancelled, for follow-up and reporting.
export type CancelReason =
  'patient-cancelled' | 'late-cancel' | 'office-rescheduled' | 'other'

export type CheckInChecklist = {
  insuranceVerified: boolean
  formsComplete: boolean
  medicalHistoryReviewed: boolean
  copayCollected: boolean
}

export type Appointment = {
  id: string
  practiceId: string
  patientId: string
  chairId: string
  start: string // ISO 8601 local time, e.g. "2026-11-17T09:00:00"
  end: string // ISO 8601 local time
  type: AppointmentType
  status: AppointmentStatus
  checklist: CheckInChecklist
  notes: string
  cancelReason?: CancelReason | null // set when cancelled, cleared on restore
}

// What the mock API returns for one practice on one day.
export type ScheduleDay = {
  practice: Practice
  date: string // "2026-11-17"
  chairs: Chair[]
  patients: Patient[]
  appointments: Appointment[]
  fees: Fee[] // this practice's fee list
  payments: Payment[] // payments for this day's visits, voided ones included
}
