import { describe, expect, it } from 'vitest'
import { DEMO_DATE } from '../config'
import { findConflicts } from '../lib/overlap'
import {
  ApiError,
  fetchSchedule,
  moveAppointment,
  updateAppointment,
} from './schedule'

// In the seed (Maple Street, open 8:00 to 5:00): Lena Ortiz (a-07, confirmed)
// is double-booked with Jon Kim (a-06, arrived) in Chair 2 from 9:45. The
// first free 45 minutes after that are 11:30 in Chair 2.
const LENA = 'a-07'
const JON = 'a-06'
const OWEN = 'a-04' // scheduled, Chair 1, 11:15 to 12:00
const GRACE = 'a-03' // confirmed, Chair 1, 10:30 to 11:00
const at = (time: string) => `${DEMO_DATE}T${time}:00`

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

async function visit(id: string) {
  const day = await fetchSchedule('maple', DEMO_DATE)
  return { day, appt: day.appointments.find((a) => a.id === id)! }
}

describe('moveAppointment', () => {
  it('moves a visit to a free time and chair, keeping its length', async () => {
    const moved = await moveAppointment('maple', LENA, {
      chairId: 'maple-c2',
      start: at('11:30'),
    })
    expect(moved).toMatchObject({
      chairId: 'maple-c2',
      start: at('11:30'),
      end: at('12:15'),
      status: 'confirmed',
    })

    const { day, appt } = await visit(LENA)
    expect(appt.start).toBe(at('11:30'))
    expect(findConflicts(day.appointments).has(LENA)).toBe(false) // banner gone
  })

  it('may overlap its own old time', async () => {
    const moved = await moveAppointment('maple', OWEN, {
      chairId: 'maple-c1',
      start: at('11:30'),
    })
    expect(moved.end).toBe(at('12:15'))
  })

  it('refuses a time another visit holds (409)', async () => {
    await expectApiError(
      moveAppointment('maple', LENA, {
        chairId: 'maple-c1',
        start: at('10:30'),
      }),
      409,
      /just booked in Chair 1/,
    )
    expect((await visit(LENA)).appt.start).toBe(at('09:45')) // unchanged
  })

  it('lets a cancelled visit’s time be taken', async () => {
    await updateAppointment('maple', GRACE, {
      status: 'cancelled',
      cancelReason: 'patient-cancelled',
    })
    const moved = await moveAppointment('maple', LENA, {
      chairId: 'maple-c1',
      start: at('10:30'),
    })
    expect(moved.end).toBe(at('11:15'))
  })

  it('refuses a visit the patient has arrived for (409)', async () => {
    await expectApiError(
      moveAppointment('maple', JON, {
        chairId: 'maple-c3',
        start: at('15:00'),
      }),
      409,
      /hasn't checked in/,
    )
  })

  it('refuses a time outside opening hours (400)', async () => {
    await expectApiError(
      moveAppointment('maple', OWEN, {
        chairId: 'maple-c1',
        start: at('16:30'),
      }),
      400,
      /opening hours/,
    )
  })

  it('refuses another day (400)', async () => {
    await expectApiError(
      moveAppointment('maple', OWEN, {
        chairId: 'maple-c1',
        start: '2026-11-18T11:30:00',
      }),
      400,
      /same day/,
    )
  })

  it("treats another practice's visit as not found (404)", async () => {
    await expectApiError(
      moveAppointment('riverbend', LENA, {
        chairId: 'maple-c2',
        start: at('11:30'),
      }),
      404,
    )
  })

  it("refuses another practice's chair (404)", async () => {
    await expectApiError(
      moveAppointment('maple', LENA, {
        chairId: 'river-c1',
        start: at('11:30'),
      }),
      404,
    )
  })
})

describe('moveAppointment for Undo (restore: true)', () => {
  it('puts the visit back where it was, even into its old overlap', async () => {
    await moveAppointment('maple', LENA, {
      chairId: 'maple-c2',
      start: at('11:30'),
    })
    const back = await moveAppointment('maple', LENA, {
      chairId: 'maple-c2',
      start: at('09:45'),
      restore: true,
    })
    expect(back).toMatchObject({ start: at('09:45'), end: at('10:30') })
    // The double-booking is back, and the banner shows it again.
    const { day } = await visit(LENA)
    expect(findConflicts(day.appointments).get(LENA)).toEqual([JON])
  })

  it('still refuses a visit that has started since', async () => {
    await expectApiError(
      moveAppointment('maple', JON, {
        chairId: 'maple-c2',
        start: at('09:00'),
        restore: true,
      }),
      409,
    )
  })
})
