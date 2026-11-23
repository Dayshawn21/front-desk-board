import { describe, expect, it } from 'vitest'
import { practices } from '../mocks/seed'
import type { Appointment, ScheduleDay } from '../types'
import { PATIENT_VISITS, patientTimes } from './patientBooking'

// A small practice day: two chairs, open 8:00 to 12:00.
function makeDay(appointments: Partial<Appointment>[] = []): ScheduleDay {
  return {
    practice: { ...practices[0], openTime: '08:00', closeTime: '12:00' },
    date: '2026-11-17',
    chairs: [
      { id: 'c1', practiceId: 'maple', name: 'Chair 1', provider: 'Dr. A' },
      { id: 'c2', practiceId: 'maple', name: 'Chair 2', provider: 'Dr. B' },
    ],
    patients: [],
    fees: [],
    payments: [],
    appointments: appointments.map((a, i) => ({
      id: `x-${i}`,
      practiceId: 'maple',
      patientId: 'p',
      chairId: 'c1',
      start: '2026-11-17T08:00:00',
      end: '2026-11-17T09:00:00',
      type: 'exam',
      status: 'scheduled',
      checklist: {
        insuranceVerified: false,
        formsComplete: false,
        medicalHistoryReviewed: false,
        copayCollected: false,
      },
      notes: '',
      version: 1,
      ...a,
    })),
  }
}

const starts = (slots: { start: string }[]) =>
  slots.map((s) => s.start.slice(11, 16))

describe('patientTimes', () => {
  it('offers nothing that starts before the clock, rounded up to the next 15 minutes', () => {
    const times = patientTimes(makeDay(), 30, '2026-11-17T10:40:00')
    expect(starts(times)).toEqual(['10:45', '11:00', '11:15', '11:30'])
  })

  it('lists each start time once, in the first free chair', () => {
    const day = makeDay([
      {
        chairId: 'c1',
        start: '2026-11-17T10:45:00',
        end: '2026-11-17T11:15:00',
      },
    ])
    const times = patientTimes(day, 30, '2026-11-17T10:40:00')

    expect(starts(times)).toEqual(['10:45', '11:00', '11:15', '11:30'])
    expect(times[0].chairId).toBe('c2') // c1 is busy at 10:45
    expect(times[2].chairId).toBe('c1') // free again at 11:15
  })

  it('leaves out a time when every chair is busy', () => {
    const busy = { start: '2026-11-17T11:00:00', end: '2026-11-17T11:30:00' }
    const day = makeDay([
      { chairId: 'c1', ...busy },
      { chairId: 'c2', ...busy },
    ])
    // 10:45, 11:00 and 11:15 would all run into the 11:00 visits.
    expect(starts(patientTimes(day, 30, '2026-11-17T10:40:00'))).toEqual([
      '11:30',
    ])
  })

  it('offers a cancelled visit time again', () => {
    const busy = { start: '2026-11-17T11:00:00', end: '2026-11-17T11:30:00' }
    const day = makeDay([
      { chairId: 'c1', ...busy, status: 'cancelled' },
      { chairId: 'c2', ...busy },
    ])
    expect(starts(patientTimes(day, 30, '2026-11-17T10:40:00'))).toContain(
      '11:00',
    )
  })

  it('offers nothing once the day is over, or on another day', () => {
    expect(patientTimes(makeDay(), 30, '2026-11-17T12:00:00')).toEqual([])
    expect(patientTimes(makeDay(), 30, '2026-11-18T08:00:00')).toEqual([])
  })

  it('offers the whole day before opening time', () => {
    const times = patientTimes(makeDay(), 60, '2026-11-17T07:00:00')
    expect(starts(times)[0]).toBe('08:00')
    expect(starts(times).at(-1)).toBe('11:00') // must end by closing
  })
})

describe('PATIENT_VISITS', () => {
  it('only offers visits a patient can book for themselves', () => {
    expect(PATIENT_VISITS.map((v) => v.type)).toEqual([
      'cleaning',
      'exam',
      'consult',
      'emergency',
    ])
    for (const visit of PATIENT_VISITS) {
      expect(visit.minutes).toBeGreaterThan(0)
      expect(visit.label).not.toBe('')
    }
  })
})
