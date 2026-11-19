import { afterEach, describe, expect, it } from 'vitest'
import {
  createAppointment,
  fetchSchedule,
  type NewAppointment,
  updateAppointment,
} from './schedule'

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

  it('saves why a visit was cancelled, and clears it on restore', async () => {
    const cancelled = await updateAppointment('maple', 'a-04', {
      status: 'cancelled',
      cancelReason: 'late-cancel',
    })
    expect(cancelled.cancelReason).toBe('late-cancel')

    const restored = await updateAppointment('maple', 'a-04', {
      status: 'scheduled',
      cancelReason: null,
    })
    expect(restored.status).toBe('scheduled')
    expect(restored.cancelReason).toBeNull()
  })

  it('refuses to cancel without a reason', async () => {
    await expect(
      updateAppointment('maple', 'a-04', { status: 'cancelled' }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Choose a reason to cancel this visit.',
    })
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

describe('createAppointment', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  // Maple Chair 1 is free from 12:00 to 13:00.
  const visit = (overrides: Partial<NewAppointment> = {}): NewAppointment => ({
    patientId: 'p-ana',
    chairId: 'maple-c1',
    start: `${DATE}T12:00:00`,
    end: `${DATE}T12:30:00`,
    type: 'exam',
    ...overrides,
  })

  it('books a free slot that the next fetch returns', async () => {
    const created = await createAppointment('maple', visit())

    expect(created).toMatchObject({
      practiceId: 'maple',
      patientId: 'p-ana',
      chairId: 'maple-c1',
      status: 'scheduled',
      notes: '',
    })
    expect(Object.values(created.checklist).some(Boolean)).toBe(false)
    const day = await fetchSchedule('maple', DATE)
    expect(day.appointments.find((a) => a.id === created.id)).toEqual(created)
  })

  it('gives each new visit its own id', async () => {
    const first = await createAppointment('maple', visit())
    const second = await createAppointment(
      'maple',
      visit({ start: `${DATE}T12:30:00`, end: `${DATE}T13:00:00` }),
    )
    expect(first.id).not.toBe(second.id)
  })

  it('refuses a time that overlaps a visit in that chair (409)', async () => {
    // a-02 is in Chair 1 from 9:00 to 10:30
    await expect(
      createAppointment(
        'maple',
        visit({ start: `${DATE}T10:00:00`, end: `${DATE}T10:30:00` }),
      ),
    ).rejects.toMatchObject({ status: 409, message: /just booked/i })
  })

  it('allows a visit that starts exactly when another ends', async () => {
    // a-03 ends at 11:00, a-04 starts at 11:15
    await expect(
      createAppointment(
        'maple',
        visit({ start: `${DATE}T11:00:00`, end: `${DATE}T11:15:00` }),
      ),
    ).resolves.toMatchObject({ status: 'scheduled' })
  })

  it('allows booking over a cancelled visit', async () => {
    await updateAppointment('maple', 'a-04', { status: 'cancelled' })

    await expect(
      createAppointment(
        'maple',
        visit({ start: `${DATE}T11:15:00`, end: `${DATE}T12:00:00` }),
      ),
    ).resolves.toMatchObject({ status: 'scheduled' })
  })

  it("refuses another practice's patient or chair (404)", async () => {
    await expect(
      createAppointment('maple', visit({ patientId: 'p-hana' })),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      createAppointment('maple', visit({ chairId: 'river-c1' })),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('refuses times outside opening hours or that end before they start (400)', async () => {
    // Maple closes at 17:00
    await expect(
      createAppointment(
        'maple',
        visit({ start: `${DATE}T16:30:00`, end: `${DATE}T17:30:00` }),
      ),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      createAppointment(
        'maple',
        visit({ start: `${DATE}T12:30:00`, end: `${DATE}T12:00:00` }),
      ),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('can be forced to fail with ?failBook', async () => {
    window.history.replaceState(null, '', '/?failBook')

    await expect(createAppointment('maple', visit())).rejects.toMatchObject({
      status: 503,
    })
  })
})

describe('restoring a cancelled visit', () => {
  it('refuses if its time was booked in the meantime (409)', async () => {
    // a-04: Owen Hart, Chair 1, 11:15 to 12:00
    await updateAppointment('maple', 'a-04', { status: 'cancelled' })
    await createAppointment('maple', {
      patientId: 'p-ana',
      chairId: 'maple-c1',
      start: `${DATE}T11:15:00`,
      end: `${DATE}T11:45:00`,
      type: 'exam',
    })

    await expect(
      updateAppointment('maple', 'a-04', { status: 'scheduled' }),
    ).rejects.toMatchObject({ status: 409, message: /already booked/i })
  })

  it('restores it when the time is still free', async () => {
    await updateAppointment('maple', 'a-04', { status: 'cancelled' })

    await expect(
      updateAppointment('maple', 'a-04', { status: 'scheduled' }),
    ).resolves.toMatchObject({ status: 'scheduled' })
  })
})
