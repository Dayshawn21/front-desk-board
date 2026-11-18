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

// Tests call this so every test starts from the same data.
export function resetMockDb() {
  db = createDb()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simulated failures for demos and tests:
//   ?fail      → loading the schedule fails
//   ?failSave  → saving a change fails
function shouldFail(flag: 'fail' | 'failSave'): boolean {
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

  Object.assign(appt, structuredClone(patch))
  return structuredClone(appt)
}

// What the booking form sends. The server fills in id, status and checklist.
export type NewAppointment = Pick<
  Appointment,
  'patientId' | 'chairId' | 'start' | 'end' | 'type'
>

export async function createAppointment(
  _practiceId: string,
  _input: NewAppointment,
): Promise<Appointment> {
  throw new Error('createAppointment: not implemented')
}
