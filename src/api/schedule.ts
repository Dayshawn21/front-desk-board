import { rangesOverlap } from '../lib/overlap'
import { toMinutes } from '../lib/time'
import * as seed from '../mocks/seed'
import type {
  Appointment,
  Chair,
  CheckInChecklist,
  Patient,
  Practice,
  ScheduleDay,
} from '../types'

// Mock API. Simulates network latency and can be forced to fail.
// Components call these functions only, never the seed data directly.

export const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 400

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// The mock "database": a copy of the seed, so saves never change the seed.
//
// It lives in localStorage, so every tab of this site shares one db (a
// patient booking in one tab shows up on the board in another) and a reload
// keeps changes. Each call reads the db fresh, changes it, and writes it
// back in one synchronous step, so two tabs can't overwrite each other's
// saves. If storage is blocked or full, the db stays in this tab's memory.
export type Db = {
  practices: Practice[]
  chairs: Chair[]
  patients: Patient[]
  appointments: Appointment[]
  nextBookingId: number // in the db, so two tabs never hand out the same id
  // Signed-in patients: session token -> patient id. Reset demo data
  // empties it, which signs every patient out.
  patientSessions: Record<string, string>
}

// Versioned, so a change to the data's shape starts fresh (v2 added
// patient sessions).
export const MOCK_DB_KEY = 'front-desk-board.mock-db.v2'

function createDb(): Db {
  return structuredClone({
    practices: seed.practices,
    chairs: seed.chairs,
    patients: seed.patients,
    appointments: seed.appointments,
    nextBookingId: 1,
    patientSessions: {},
  })
}

let memoryDb = createDb() // used when localStorage can't be
let useStorage = true

function isDb(value: unknown): value is Db {
  const db = value as Db | null
  return (
    typeof db === 'object' &&
    db !== null &&
    Array.isArray(db.practices) &&
    Array.isArray(db.chairs) &&
    Array.isArray(db.patients) &&
    Array.isArray(db.appointments) &&
    typeof db.nextBookingId === 'number' &&
    typeof db.patientSessions === 'object' &&
    db.patientSessions !== null
  )
}

// loadDb and saveDb are shared with the patient side of the mock server
// (patientPortal.ts); components never call them.
export function loadDb(): Db {
  if (!useStorage) return memoryDb
  try {
    const raw = localStorage.getItem(MOCK_DB_KEY)
    if (raw === null) return createDb()
    const parsed: unknown = JSON.parse(raw)
    // Unreadable or old-shaped data: start from the seed again.
    return isDb(parsed) ? parsed : createDb()
  } catch (error) {
    if (error instanceof SyntaxError) return createDb() // bad JSON
    useStorage = false // storage itself is blocked
    return memoryDb
  }
}

export function saveDb(db: Db) {
  memoryDb = db
  if (!useStorage) return
  try {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db))
  } catch {
    // Full or blocked: keep working in this tab's memory from now on.
    useStorage = false
  }
}

// Puts the seed data back, for this tab and every other open tab (removing
// the key fires a "storage" event in the others).
export function resetDemoData() {
  memoryDb = createDb()
  try {
    localStorage.removeItem(MOCK_DB_KEY)
  } catch {
    // Storage blocked: this tab's memory was reset above.
  }
}

// Tests call this so every test starts from the same data.
export function resetMockDb() {
  useStorage = true
  resetDemoData()
}

// Calls onChange when ANOTHER tab changes the mock db: the browser fires a
// "storage" event in every other tab of the site when localStorage changes
// (never in the tab that made the change, which refetches on its own).
// key is null when the other tab cleared all of storage. Returns an
// unsubscribe function. A real server would push events (WebSocket or SSE).
export function subscribeToMockDb(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === MOCK_DB_KEY || event.key === null) onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Simulated failures for demos and tests:
//   ?fail      → loading the schedule fails
//   ?failSave  → saving a change fails
//   ?failBook  → booking a new visit fails
export function shouldFail(flag: 'fail' | 'failSave' | 'failBook'): boolean {
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
  return structuredClone(loadDb().practices)
}

export async function fetchSchedule(
  practiceId: string,
  date: string,
): Promise<ScheduleDay> {
  await sleep(LATENCY_MS)

  if (shouldFail('fail')) {
    throw new ApiError('Could not load the schedule (simulated failure).', 503)
  }

  const db = loadDb()
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

// A checklist patch names only the boxes it changes; the server merges them
// into the stored checklist. So two people ticking different boxes at once
// (the desk in the drawer, the patient on their phone) never undo each other.
export type AppointmentPatch = Partial<
  Pick<Appointment, 'status' | 'notes' | 'cancelReason'>
> & { checklist?: Partial<CheckInChecklist> }

export async function updateAppointment(
  practiceId: string,
  appointmentId: string,
  patch: AppointmentPatch,
): Promise<Appointment> {
  await sleep(LATENCY_MS)

  if (shouldFail('failSave')) {
    throw new ApiError('Could not save changes (simulated failure).', 503)
  }

  const db = loadDb()
  // Tenant check: an appointment in another practice is treated as not found.
  const appt = db.appointments.find(
    (a) => a.id === appointmentId && a.practiceId === practiceId,
  )
  if (!appt) {
    throw new ApiError(`Appointment not found: ${appointmentId}`, 404)
  }

  // A cancel must say why (for follow-up and reporting).
  if (patch.status === 'cancelled' && !patch.cancelReason) {
    throw new ApiError('Choose a reason to cancel this visit.', 400)
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

  const { checklist, ...rest } = structuredClone(patch)
  Object.assign(appt, rest)
  if (checklist) appt.checklist = { ...appt.checklist, ...checklist }
  saveDb(db)
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

  const db = loadDb()
  const appointment = insertAppointment(db, practiceId, input)
  saveDb(db)
  return structuredClone(appointment)
}

// Checks a new visit (tenant, opening hours, the chair is still free) and
// adds it to db. Throws ApiError if it can't be booked. Shared with the
// patient's own booking.
export function insertAppointment(
  db: Db,
  practiceId: string,
  input: NewAppointment,
): Appointment {
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
    id: `b-${db.nextBookingId++}`,
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
  return appointment
}
