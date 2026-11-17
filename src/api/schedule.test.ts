import { describe, expect, it } from 'vitest'
import { fetchSchedule, updateAppointment } from './schedule'

const DATE = '2026-11-17'

describe('updateAppointment', () => {
  it('saves a status change that the next fetch returns', async () => {
    await updateAppointment('maple', 'a-07', { status: 'arrived' })

    const day = await fetchSchedule('maple', DATE)
    expect(day.appointments.find((a) => a.id === 'a-07')?.status).toBe(
      'arrived',
    )
  })

  it('saves checklist and notes together', async () => {
    const checklist = {
      insuranceVerified: true,
      formsComplete: true,
      medicalHistoryReviewed: false,
      copayCollected: false,
    }
    const saved = await updateAppointment('maple', 'a-12', {
      checklist,
      notes: 'Running 5 min late.',
    })

    expect(saved.checklist).toEqual(checklist)
    expect(saved.notes).toBe('Running 5 min late.')
  })

  it("refuses to update another practice's appointment", async () => {
    // a-16 belongs to Riverbend
    await expect(
      updateAppointment('maple', 'a-16', { status: 'arrived' }),
    ).rejects.toMatchObject({
      status: 404,
    })
  })

  it('returns a copy, not the stored record', async () => {
    const saved = await updateAppointment('maple', 'a-07', {
      notes: 'original',
    })
    saved.notes = 'changed by the caller'

    const day = await fetchSchedule('maple', DATE)
    expect(day.appointments.find((a) => a.id === 'a-07')?.notes).toBe(
      'original',
    )
  })

  it('starts each test from fresh data', async () => {
    // The first test set a-07 to "arrived"; resetMockDb() in setup.ts undoes it.
    const day = await fetchSchedule('maple', DATE)
    expect(day.appointments.find((a) => a.id === 'a-07')?.status).toBe(
      'confirmed',
    )
  })
})
