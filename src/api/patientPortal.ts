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
  type DemoEmail,
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

// Passwords from the sign-up page are stored as a salted PBKDF2 hash, the
// way a real server would (with a dedicated library, and more iterations).
const PBKDF2_ITERATIONS = 100_000

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromHex(saltHex),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

const normalEmail = (email: string) => email.trim().toLowerCase()

// The patient id for an email and password, or null. An account in the db
// (a sign-up, or a demo patient who reset their password) wins over the
// seed's demo login, so a reset password replaces the demo one.
async function checkLogin(db: Db, email: string, password: string) {
  const account = db.patientAccounts.find((a) => a.email === email)
  if (account) {
    const hash = await hashPassword(password, account.salt)
    return hash === account.passwordHash ? account.patientId : null
  }
  const demo = patientLogins.find(
    (l) => l.email === email && l.password === password,
  )
  return demo?.patientId ?? null
}

// The patient id that signs in with this email, or null.
function patientIdForEmail(db: Db, email: string): string | null {
  return (
    db.patientAccounts.find((a) => a.email === email)?.patientId ??
    patientLogins.find((l) => l.email === email)?.patientId ??
    null
  )
}

function emailForPatient(db: Db, patientId: string): string | null {
  return (
    db.patientAccounts.find((a) => a.patientId === patientId)?.email ??
    patientLogins.find((l) => l.patientId === patientId)?.email ??
    null
  )
}

function startSession(db: Db, patientId: string): string {
  const token = newToken()
  db.patientSessions[token] = patientId
  return token
}

export async function patientSignIn(
  email: string,
  password: string,
): Promise<{ token: string }> {
  await sleep(LATENCY_MS)
  const db = loadDb()
  const patientId = await checkLogin(db, normalEmail(email), password)
  // One message for a wrong password and an unknown email, so the form
  // doesn't tell anyone which emails have accounts.
  if (!patientId) {
    throw new ApiError("That email and password don't match.", 401)
  }
  // Fresh read: hashing was async, and another tab may have saved since.
  const fresh = loadDb()
  const token = startSession(fresh, patientId)
  saveDb(fresh)
  return { token }
}

export type NewPatientAccount = {
  practiceId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Creates an account for a new patient, adds them to their office's
// patient list (so the desk sees them), and signs them in.
export async function patientSignUp(
  input: NewPatientAccount,
): Promise<{ token: string }> {
  await sleep(LATENCY_MS)
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = normalEmail(input.email)
  const phone = input.phone.trim()

  const db = loadDb()
  if (!db.practices.some((p) => p.id === input.practiceId)) {
    throw new ApiError('Choose your dental office.', 400)
  }
  if (
    !firstName ||
    !lastName ||
    firstName.length > 50 ||
    lastName.length > 50
  ) {
    throw new ApiError('Enter your first and last name.', 400)
  }
  if ((phone.match(/\d/g) ?? []).length < 7 || phone.length > 30) {
    throw new ApiError('Enter a phone number we can reach you on.', 400)
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new ApiError('Enter an email like name@example.com.', 400)
  }
  if (input.password.length < 8) {
    throw new ApiError('Use a password of at least 8 characters.', 400)
  }

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const passwordHash = await hashPassword(input.password, salt)

  // Fresh read after the async hash, so the email check and the save
  // happen together and two tabs can't both take one email.
  const fresh = loadDb()
  const taken =
    patientLogins.some((l) => l.email === email) ||
    fresh.patientAccounts.some((a) => a.email === email)
  if (taken) {
    throw new ApiError(
      'An account with that email already exists. Sign in instead.',
      409,
    )
  }

  const patientId = `p-new-${fresh.nextPatientId++}`
  fresh.patients.push({
    id: patientId,
    practiceId: input.practiceId,
    firstName,
    lastName,
    phone,
    insuranceProvider: null, // the desk adds it at the first visit
  })
  fresh.patientAccounts.push({ email, patientId, salt, passwordHash })
  const token = startSession(fresh, patientId)
  saveDb(fresh)
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
      email:
        db.patientAccounts.find((a) => a.patientId === patient.id)?.email ??
        patientEmail(patient),
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

// --- Forgot password ---------------------------------------------------

const RESET_MINUTES = 30
const RESET_REFUSED =
  'This reset link has expired or was already used. Ask for a new one.'
const SHORT_PASSWORD = 'Use a password of at least 8 characters.'

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return toHex(new Uint8Array(digest))
}

// "Emails" a single-use reset link that works for 30 minutes. It resolves
// the same way whether or not the email has an account, so the page can't
// be used to find out who is a patient. A newer link replaces older ones.
export async function requestPasswordReset(email: string): Promise<void> {
  await sleep(LATENCY_MS)
  const to = normalEmail(email)
  const token = newToken()
  const tokenHash = await sha256(token)

  const db = loadDb()
  const patientId = patientIdForEmail(db, to)
  if (!patientId) return
  const practiceName =
    db.practices.find(
      (p) => p.id === db.patients.find((x) => x.id === patientId)?.practiceId,
    )?.name ?? 'your dental office'

  db.passwordResets = db.passwordResets.filter((r) => r.patientId !== patientId)
  db.passwordResets.push({
    tokenHash,
    patientId,
    expiresAt: Date.now() + RESET_MINUTES * 60_000,
  })
  db.outbox.push({
    id: crypto.randomUUID(),
    to,
    subject: 'Reset your password',
    body: `Someone asked to reset the password for your ${practiceName} patient account. The link works once, for ${RESET_MINUTES} minutes. If it wasn't you, you can ignore this email.`,
    link: `/patient/reset-password?token=${token}`,
    sentAt: new Date().toISOString(),
  })
  saveDb(db)
}

// The demo inbox: every email "sent" in this browser, newest first. A real
// site has no such page; the email goes to the patient.
export async function fetchDemoInbox(): Promise<DemoEmail[]> {
  await sleep(LATENCY_MS)
  return structuredClone(loadDb().outbox).reverse()
}

function findReset(db: Db, tokenHash: string) {
  return db.passwordResets.find(
    (r) => r.tokenHash === tokenHash && r.expiresAt > Date.now(),
  )
}

// Sets a new password from a reset link. The link works once; the new
// password is stored as a salted hash; every session for the patient ends,
// so anyone signed in with the old password is signed out.
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await sleep(LATENCY_MS)
  const tokenHash = await sha256(token)
  if (!findReset(loadDb(), tokenHash)) {
    throw new ApiError(RESET_REFUSED, 400)
  }
  if (password.length < 8) throw new ApiError(SHORT_PASSWORD, 400)

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const passwordHash = await hashPassword(password, salt)

  // Fresh read after the async hash: check the link again, then save.
  const db = loadDb()
  const reset = findReset(db, tokenHash)
  const email = reset && emailForPatient(db, reset.patientId)
  if (!reset || !email) throw new ApiError(RESET_REFUSED, 400)
  storePassword(db, reset.patientId, email, salt, passwordHash)
  endSessions(db, reset.patientId)
  saveDb(db)
}

// Saves a patient's new password hash (a demo patient gets an account,
// which then wins over the demo password), and drops any pending reset.
function storePassword(
  db: Db,
  patientId: string,
  email: string,
  salt: string,
  passwordHash: string,
) {
  const account = db.patientAccounts.find((a) => a.patientId === patientId)
  if (account) {
    account.salt = salt
    account.passwordHash = passwordHash
  } else {
    db.patientAccounts.push({ email, patientId, salt, passwordHash })
  }
  db.passwordResets = db.passwordResets.filter((r) => r.patientId !== patientId)
}

// Signs the patient out everywhere, except the session `keep`.
function endSessions(db: Db, patientId: string, keep?: string) {
  for (const [token, id] of Object.entries(db.patientSessions)) {
    if (id === patientId && token !== keep) delete db.patientSessions[token]
  }
}

// --- Change password (signed in) ---------------------------------------

// Rate limit: 5 wrong current passwords per patient in 15 minutes. Then
// the form is locked until the oldest of those tries is 15 minutes old.
// While locked, the password isn't even checked, so guessing gets nowhere.
// Counted per patient, not per session, so signing in again doesn't reset
// it. (A real server would also limit by IP address.)
const CHANGE_PASSWORD_TRIES = 5
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60_000

function recentFailures(db: Db, key: string, now: number): number[] {
  return (Object.hasOwn(db.failedTries, key) ? db.failedTries[key] : []).filter(
    (t) => t > now - CHANGE_PASSWORD_WINDOW_MS,
  )
}

function throwIfLocked(db: Db, key: string) {
  const now = Date.now()
  const recent = recentFailures(db, key, now)
  if (recent.length < CHANGE_PASSWORD_TRIES) return
  const unlocksAt =
    recent[recent.length - CHANGE_PASSWORD_TRIES] + CHANGE_PASSWORD_WINDOW_MS
  const minutes = Math.max(1, Math.ceil((unlocksAt - now) / 60_000))
  throw new ApiError(
    `Too many tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
    429,
  )
}

function recordFailure(db: Db, key: string) {
  const now = Date.now()
  db.failedTries[key] = [...recentFailures(db, key, now), now]
}

// Changes the signed-in patient's password. They must give the current
// one (so someone at an unlocked phone can't take over the account). Every
// other session ends; this one stays signed in.
export async function changeMyPassword(
  token: string,
  current: string,
  next: string,
): Promise<void> {
  await sleep(LATENCY_MS)
  const db = loadDb()
  const patient = patientFor(db, token)
  const email = emailForPatient(db, patient.id)
  if (!email) throw new ApiError(SIGNED_OUT, 401)

  const limitKey = `change-password:${patient.id}`
  throwIfLocked(db, limitKey)

  if ((await checkLogin(db, email, current)) !== patient.id) {
    // Fresh read after the async check, so tries from two tabs both count.
    const fresh = loadDb()
    recordFailure(fresh, limitKey)
    saveDb(fresh)
    throw new ApiError("Your current password isn't right.", 400)
  }
  if (next.length < 8) throw new ApiError(SHORT_PASSWORD, 400)
  if (next === current) {
    throw new ApiError(
      'Choose a new password that is different from the current one.',
      400,
    )
  }

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const passwordHash = await hashPassword(next, salt)

  // Fresh read after the async hashing; the session must still be live.
  const fresh = loadDb()
  if (patientFor(fresh, token).id !== patient.id) {
    throw new ApiError(SIGNED_OUT, 401)
  }
  storePassword(fresh, patient.id, email, salt, passwordHash)
  endSessions(fresh, patient.id, token)
  delete fresh.failedTries[limitKey] // a successful change clears the count
  saveDb(fresh)
}
