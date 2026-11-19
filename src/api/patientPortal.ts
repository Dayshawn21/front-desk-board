import { DEMO_NOW } from '../config'
import { PATIENT_VISITS, patientTimes } from '../lib/patientBooking'
import { patientEmail, patientLogins } from '../mocks/patientLogins'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  Practice,
  ScheduleDay,
} from '../types'
import {
  ApiError,
  type Db,
  insertAppointment,
  LATENCY_MS,
  loadDb,
  saveDb,
  shouldFail,
  sleep,
} from './schedule'

// The patient side of the mock API. A patient signs in with an email and
// password and gets a session token; every other call takes that token,
// and the server, not the page, decides whose data comes back. Pages only
// ever get the signed-in patient's own details and visits: never the
// practice's patient list or anyone else's visit. Someone else's visit is
// "not found", the same as one that doesn't exist, so ids can't be probed.

const SIGNED_OUT = 'Please sign in again.'

export type MyVisit = {
  id: string
  type: AppointmentType
  start: string
  end: string
  status: AppointmentStatus
  provider: string | null
  // Only the boxes the patient ticks themselves; insurance and the copay
  // stay with the front desk.
  checklist: { formsComplete: boolean; medicalHistoryReviewed: boolean }
}

export type MyAccount = {
  patient: {
    firstName: string
    lastName: string
    email: string
    phone: string
    insuranceProvider: string | null
  }
  practice: Practice
  visits: MyVisit[] // today's, in time order
}

export type OpenTimes = {
  practice: Practice
  times: { start: string; end: string }[]
}

function newToken(): string {
  // 122 random bits; a real server would set an HttpOnly cookie instead.
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
}

// The patient a token belongs to, or a 401.
function patientFor(db: Db, token: string) {
  const patientId = Object.hasOwn(db.patientSessions, token)
    ? db.patientSessions[token]
    : undefined
  const patient = db.patients.find((p) => p.id === patientId)
  if (!patient) throw new ApiError(SIGNED_OUT, 401)
  return patient
}

function toMyVisit(db: Db, a: Appointment): MyVisit {
  return {
    id: a.id,
    type: a.type,
    start: a.start,
    end: a.end,
    status: a.status,
    provider: db.chairs.find((c) => c.id === a.chairId)?.provider ?? null,
    checklist: {
      formsComplete: a.checklist.formsComplete,
      medicalHistoryReviewed: a.checklist.medicalHistoryReviewed,
    },
  }
}

export async function patientSignIn(
  email: string,
  password: string,
): Promise<{ token: string }> {
  await sleep(LATENCY_MS)
  const wanted = email.trim().toLowerCase()
  const login = patientLogins.find(
    (l) => l.email === wanted && l.password === password,
  )
  // One message for a wrong password and an unknown email, so the form
  // doesn't tell anyone which emails have accounts.
  if (!login) throw new ApiError("That email and password don't match.", 401)

  const db = loadDb()
  const token = newToken()
  db.patientSessions[token] = login.patientId
  saveDb(db)
  return { token }
}

export async function patientSignOut(token: string): Promise<void> {
  await sleep(LATENCY_MS)
  const db = loadDb()
  if (Object.hasOwn(db.patientSessions, token)) {
    delete db.patientSessions[token]
    saveDb(db)
  }
}

export async function fetchMyAccount(
  token: string,
  date: string,
): Promise<MyAccount> {
  await sleep(LATENCY_MS)
  if (shouldFail('fail')) {
    throw new ApiError('Could not load your visits (simulated failure).', 503)
  }
  const db = loadDb()
  const patient = patientFor(db, token)
  const practice = db.practices.find((p) => p.id === patient.practiceId)
  if (!practice) throw new ApiError(SIGNED_OUT, 401)

  const visits = db.appointments
    .filter((a) => a.patientId === patient.id && a.start.startsWith(date))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((a) => toMyVisit(db, a))

  return structuredClone({
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patientEmail(patient),
      phone: patient.phone,
      insuranceProvider: patient.insuranceProvider,
    },
    practice,
    visits,
  })
}

// The practice's day as the server sees it, for working out open times.
function serverDay(db: Db, practice: Practice, date: string): ScheduleDay {
  const mine = <T extends { practiceId: string }>(rows: T[]) =>
    rows.filter((r) => r.practiceId === practice.id)
  return {
    practice,
    date,
    chairs: mine(db.chairs),
    patients: mine(db.patients),
    appointments: mine(db.appointments).filter((a) => a.start.startsWith(date)),
  }
}

// Public: anyone can see when an office is free. Only start and end times
// come back, with no patients, visits, or chairs.
export async function fetchOpenTimes(
  practiceId: string,
  date: string,
  minutes: number,
  now: string,
): Promise<OpenTimes> {
  await sleep(LATENCY_MS)
  if (shouldFail('fail')) {
    throw new ApiError('Could not load open times (simulated failure).', 503)
  }
  const db = loadDb()
  const practice = db.practices.find((p) => p.id === practiceId)
  if (!practice) throw new ApiError(`Unknown practice: ${practiceId}`, 404)
  const times = patientTimes(serverDay(db, practice, date), minutes, now).map(
    (slot) => ({ start: slot.start, end: slot.end }),
  )
  return structuredClone({ practice, times })
}

export type MyBooking = {
  practiceId: string
  type: AppointmentType
  start: string
}

// Books for the signed-in patient only, at their own office. The server
// picks the chair (the first one free at that time) and the end time.
export async function bookMyVisit(
  token: string,
  booking: MyBooking,
): Promise<MyVisit> {
  await sleep(LATENCY_MS)
  if (shouldFail('failBook')) {
    throw new ApiError('Could not book the visit (simulated failure).', 503)
  }
  const db = loadDb()
  const patient = patientFor(db, token)
  if (patient.practiceId !== booking.practiceId) {
    throw new ApiError('You can only book at your own dental office.', 403)
  }
  const visit = PATIENT_VISITS.find((v) => v.type === booking.type)
  if (!visit) {
    throw new ApiError('Please call the office to book that visit.', 400)
  }
  const practice = db.practices.find((p) => p.id === patient.practiceId)
  if (!practice) throw new ApiError(SIGNED_OUT, 401)

  // Re-checked here: the time may have been taken since the page showed it.
  const slot = patientTimes(
    serverDay(db, practice, booking.start.slice(0, 10)),
    visit.minutes,
    DEMO_NOW, // never a time that has already passed
  ).find((t) => t.start === booking.start)
  if (!slot) {
    throw new ApiError('That time was just taken. Pick another time.', 409)
  }

  const appointment = insertAppointment(db, practice.id, {
    patientId: patient.id,
    chairId: slot.chairId,
    start: slot.start,
    end: slot.end,
    type: visit.type,
  })
  saveDb(db)
  return toMyVisit(db, appointment)
}

export type MyCheckIn = {
  checklist?: Partial<MyVisit['checklist']>
  arrived?: true // "I'm here"
}

export async function checkInMyVisit(
  token: string,
  visitId: string,
  change: MyCheckIn,
): Promise<MyVisit> {
  await sleep(LATENCY_MS)
  if (shouldFail('failSave')) {
    throw new ApiError('Could not save changes (simulated failure).', 503)
  }
  const db = loadDb()
  const patient = patientFor(db, token)
  const appt = db.appointments.find(
    (a) => a.id === visitId && a.patientId === patient.id,
  )
  if (!appt) throw new ApiError('Visit not found.', 404)

  if (change.arrived) {
    if (appt.status !== 'scheduled' && appt.status !== 'confirmed') {
      throw new ApiError("This visit can't be checked in.", 409)
    }
    appt.status = 'arrived'
  }
  // Only the patient's own boxes, merged into the stored checklist, so the
  // desk's ticks are never overwritten.
  const { formsComplete, medicalHistoryReviewed } = change.checklist ?? {}
  if (typeof formsComplete === 'boolean') {
    appt.checklist.formsComplete = formsComplete
  }
  if (typeof medicalHistoryReviewed === 'boolean') {
    appt.checklist.medicalHistoryReviewed = medicalHistoryReviewed
  }
  saveDb(db)
  return toMyVisit(db, appt)
}
