import { describe, expect, it } from 'vitest'
import { DEMO_DATE } from '../config'
import { DEMO_PATIENT_PASSWORD } from '../mocks/patientLogins'
import { checkInMyVisit, patientSignIn } from './patientPortal'
import {
  ApiError,
  createAppointment,
  fetchSchedule,
  moveAppointment,
  recordPayment,
  updateAppointment,
} from './schedule'

// Each visit has a version. It goes up with every change to a field a save
// overwrites (status, notes, cancel reason, chair and time). A save that
// says which version it was based on is refused with a 409 if the visit has
// changed since, so nobody silently overwrites someone else's change.
// Checklist ticks merge box by box, so they neither need a version nor
// change it.
const LENA = 'a-07' // confirmed, Chair 2, 9:45
const ANA = 'a-01' // checked out (completed), owes a balance
const RAVI = 'a-11' // Ravi Menon, not yet arrived
const at = (time: string) => `${DEMO_DATE}T${time}:00`

async function visit(id: string) {
  const day = await fetchSchedule('maple', DEMO_DATE)
  return day.appointments.find((a) => a.id === id)!
}

async function apiError(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('appointment versions', () => {
  it('starts every visit at version 1', async () => {
    const day = await fetchSchedule('maple', DEMO_DATE)
    expect(day.appointments.every((a) => a.version === 1)).toBe(true)
  })

  it('goes up with a status, notes or move change', async () => {
    let saved = await updateAppointment('maple', LENA, {
      status: 'arrived',
      version: 1,
    })
    expect(saved.version).toBe(2)
    saved = await updateAppointment('maple', LENA, {
      notes: 'Running late',
      version: 2,
    })
    expect(saved.version).toBe(3)
    await updateAppointment('maple', LENA, { status: 'confirmed', version: 3 })
    const moved = await moveAppointment('maple', LENA, {
      chairId: 'maple-c2',
      start: at('11:30'),
      version: 4,
    })
    expect(moved.version).toBe(5)
    expect((await visit(LENA)).version).toBe(5)
  })

  it('refuses a save based on an old version, and changes nothing', async () => {
    // Someone else checks Lena in first...
    await updateAppointment('maple', LENA, { status: 'arrived', version: 1 })
    // ...then this desk, still looking at version 1, writes a note.
    const error = await apiError(
      updateAppointment('maple', LENA, { notes: 'Mine', version: 1 }),
    )
    expect(error.status).toBe(409)
    expect(error.message).toMatch(/someone else changed this visit/i)

    const lena = await visit(LENA)
    expect(lena.notes).toBe('')
    expect(lena.status).toBe('arrived')
    expect(lena.version).toBe(2)
  })

  it('refuses a move based on an old version', async () => {
    await updateAppointment('maple', LENA, { notes: 'Call first', version: 1 })
    const error = await apiError(
      moveAppointment('maple', LENA, {
        chairId: 'maple-c2',
        start: at('11:30'),
        version: 1,
      }),
    )
    expect(error.status).toBe(409)
    expect((await visit(LENA)).start).toBe(at('09:45'))
  })

  it('lets checklist ticks through without a version, and leaves it alone', async () => {
    await updateAppointment('maple', LENA, { status: 'arrived', version: 1 })
    const ticked = await updateAppointment('maple', LENA, {
      checklist: { formsComplete: true },
    })
    expect(ticked.checklist.formsComplete).toBe(true)
    expect(ticked.version).toBe(2)
  })

  it('leaves it alone when a payment ticks Copay collected', async () => {
    await recordPayment('maple', ANA, { cents: 1000, method: 'cash' })
    const ana = await visit(ANA)
    expect(ana.checklist.copayCollected).toBe(true)
    expect(ana.version).toBe(1)
  })

  it('goes up when the patient checks in from their phone', async () => {
    const { token } = await patientSignIn(
      'ravi.menon@example.com',
      DEMO_PATIENT_PASSWORD,
    )
    await checkInMyVisit(token, RAVI, { arrived: true })
    expect((await visit(RAVI)).version).toBe(2)
  })

  it('starts a new booking at version 1', async () => {
    const booked = await createAppointment('maple', {
      patientId: 'p-ana',
      chairId: 'maple-c3',
      start: at('15:00'),
      end: at('15:30'),
      type: 'exam',
    })
    expect(booked.version).toBe(1)
  })
})
