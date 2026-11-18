import { rangesOverlap } from '../lib/overlap'
import { toMinutes } from '../lib/time'
import * as seed from '../mocks/seed'
import type {
  Appointment,
  Chair,
  Patient,
  Practice,
  ScheduleDay,
} from '../types'

// Mock API. Simulates network latency and can be forced to fail.
// Components call these functions only, never the seed data directly.

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 400

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// The mock "database": a private copy of the seed, so saves never change the seed itself.
type Db = {
  practices: Practice[]
  chairs: Chair[]
  patients: Patient[]
  appointments: Appointment[]
}

function createDb(): Db {
  return structuredClone({
    practices: seed.practices,
    chairs: seed.chairs,
    patients: seed.patients,
    appointments: seed.appointments,
  })
}

let db = createDb()
let nextBookingId = 1

// Tests call this so every test starts from the same data.
export function resetMockDb() {
  db = createDb()
  nextBookingId = 1
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simulated failures for demos and tests:
//   ?fail      → loading the schedule fails
//   ?failSave  → saving a change fails
//   ?failBook  → booking a new visit fails
function shouldFail(flag: 'fail' | 'failSave' | 'failBook'): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has(flag)
  )
}

function forPractice<T extends { practiceId: string }>(
  rows: T[],
  practiceId: string,
): T[] {
  return rows.filter((row) => row.practiceId === practiceId)
}

export async function fetchPractices(): Promise<Practice[]> {
  await sleep(LATENCY_MS)
  return structuredClone(db.practices)
}

export async function fetchSchedule(
  practiceId: string,
  date: string,
): Promise<ScheduleDay> {
  await sleep(LATENCY_MS)

  if (shouldFail('fail')) {
    throw new ApiError('Could not load the schedule (simulated failure).', 503)
  }

  const practice = db.practices.find((p) => p.id === practiceId)
  if (!practice) {
    throw new ApiError(`Unknown practice: ${practiceId}`, 404)
  }

  return structuredClone({
    practice,
    date,
    chairs: forPractice(db.chairs, practiceId),
    patients: forPractice(db.patients, practiceId),
    appointments: forPractice(db.appointments, practiceId).filter((a) =>
      a.start.startsWith(date),
    ),
  })
}

export type AppointmentPatch = Partial<
  Pick<Appointment, 'status' | 'checklist' | 'notes'>
>

export async function updateAppointment(
  practiceId: string,
  appointmentId: string,
  patch: AppointmentPatch,
): Promise<Appointment> {
  await sleep(LATENCY_MS)

  if (shouldFail('failSave')) {
    throw new ApiError('Could not save changes (simulated failure).', 503)
  }

  // Tenant check: an appointment in another practice is treated as not found.
  const appt = db.appointments.find(
    (a) => a.id === appointmentId && a.practiceId === practiceId,
  )
  if (!appt) {
    throw new ApiError(`Appointment not found: ${appointmentId}`, 404)
  }

  // Restoring a cancelled visit: its time may have been booked since.
  const restoring =
    appt.status === 'cancelled' &&
    patch.status !== undefined &&
    patch.status !== 'cancelled'
  if (restoring) {
    const taken = db.appointments.some(
      (a) =>
        a.id !== appt.id &&
        a.practiceId === practiceId &&
        a.chairId === appt.chairId &&
        a.status !== 'cancelled' &&
        a.start.slice(0, 10) === appt.start.slice(0, 10) &&
        rangesOverlap(a, appt),
    )
    if (taken) {
      const chair = db.chairs.find((c) => c.id === appt.chairId)
      throw new ApiError(
        `That time is already booked in ${chair?.name ?? 'this chair'}, so the visit can't be restored.`,
        409,
      )
    }
  }

  Object.assign(appt, structuredClone(patch))
  return structuredClone(appt)
}

// What the booking form sends. The server fills in id, status and checklist.
export type NewAppointment = Pick<
  Appointment,
  'patientId' | 'chairId' | 'start' | 'end' | 'type'
>

export async function createAppointment(
  practiceId: string,
  input: NewAppointment,
): Promise<Appointment> {
  await sleep(LATENCY_MS)

  if (shouldFail('failBook')) {
    throw new ApiError('Could not book the visit (simulated failure).', 503)
  }

  // Tenant checks: the patient and chair must belong to this practice.
  const practice = db.practices.find((p) => p.id === practiceId)
  const patient = db.patients.find(
    (p) => p.id === input.patientId && p.practiceId === practiceId,
  )
  const chair = db.chairs.find(
    (c) => c.id === input.chairId && c.practiceId === practiceId,
  )
  if (!practice || !patient || !chair) {
    throw new ApiError('Patient or chair not found in this practice.', 404)
  }

  const start = toMinutes(input.start)
  const end = toMinutes(input.end)
  if (
    end <= start ||
    start < toMinutes(practice.openTime) ||
    end > toMinutes(practice.closeTime)
  ) {
    throw new ApiError('That time is outside opening hours.', 400)
  }

  // The server re-checks the slot: someone may have booked it since the
  // form showed it as free. Cancelled visits don't hold a chair.
  const taken = db.appointments.some(
    (a) =>
      a.practiceId === practiceId &&
      a.chairId === input.chairId &&
      a.status !== 'cancelled' &&
      a.start.slice(0, 10) === input.start.slice(0, 10) &&
      rangesOverlap(a, input),
  )
  if (taken) {
    throw new ApiError(
      `That time was just booked in ${chair.name}. Pick another time.`,
      409,
    )
  }

  const appointment: Appointment = {
    ...structuredClone(input),
    id: `b-${nextBookingId++}`,
    practiceId,
    status: 'scheduled',
    checklist: {
      insuranceVerified: false,
      formsComplete: false,
      medicalHistoryReviewed: false,
      copayCollected: false,
    },
    notes: '',
  }
  db.appointments.push(appointment)
  return structuredClone(appointment)
}
