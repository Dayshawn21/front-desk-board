import { describe, expect, it } from 'vitest'
import type { Appointment, ScheduleDay } from '../types'
import { findOpenSlots } from './slots'

const D = '2026-11-17'
const at = (time: string) => `${D}T${time}:00`

function appt(
  id: string,
  chairId: string,
  from: string,
  to: string,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id,
    practiceId: 'maple',
    patientId: `p-${id}`,
    chairId,
    start: at(from),
    end: at(to),
    type: 'exam',
    status: 'scheduled',
    checklist: {
      insuranceVerified: false,
      formsComplete: false,
      medicalHistoryReviewed: false,
      copayCollected: false,
    },
    notes: '',
    ...overrides,
  }
}

// A small practice day: open 08:00 to 12:00, two chairs.
function day(appointments: Appointment[] = []): ScheduleDay {
  return {
    practice: {
      id: 'maple',
      name: 'Maple Street Dental',
      openTime: '08:00',
      closeTime: '12:00',
    },
    date: D,
    chairs: [
      { id: 'c1', practiceId: 'maple', name: 'Chair 1', provider: 'Dr. A' },
      { id: 'c2', practiceId: 'maple', name: 'Chair 2', provider: 'Dr. B' },
    ],
    patients: [],
    fees: [],
    payments: [],
    appointments,
  }
}

const slot = (chairId: string, from: string, to: string) => ({
  chairId,
  start: at(from),
  end: at(to),
})

describe('findOpenSlots', () => {
  it('on an empty day, ranks by earliest start, then chair order, 3 by default', () => {
    expect(findOpenSlots(day(), { durationMinutes: 30 })).toEqual([
      slot('c1', '08:00', '08:30'),
      slot('c2', '08:00', '08:30'),
      slot('c1', '08:15', '08:45'),
    ])
  })

  it('returns as many slots as the limit asks for', () => {
    expect(findOpenSlots(day(), { durationMinutes: 30, limit: 1 })).toEqual([
      slot('c1', '08:00', '08:30'),
    ])
  })

  it('skips times that overlap a booked visit in that chair', () => {
    const result = findOpenSlots(day([appt('a', 'c1', '08:00', '09:00')]), {
      durationMinutes: 30,
      chairId: 'c1',
    })
    // Half-open ranges: a slot can start exactly when the visit ends.
    expect(result[0]).toEqual(slot('c1', '09:00', '09:30'))
  })

  it('does not offer a gap that is shorter than the requested duration', () => {
    const result = findOpenSlots(
      day([
        appt('a', 'c1', '08:00', '08:30'),
        appt('b', 'c1', '08:45', '10:00'),
      ]),
      { durationMinutes: 30, chairId: 'c1', limit: 1 },
    )
    expect(result).toEqual([slot('c1', '10:00', '10:30')])
  })

  it('ignores cancelled visits', () => {
    const result = findOpenSlots(
      day([appt('a', 'c1', '08:00', '09:00', { status: 'cancelled' })]),
      { durationMinutes: 30, chairId: 'c1', limit: 1 },
    )
    expect(result).toEqual([slot('c1', '08:00', '08:30')])
  })

  it('only looks at the requested chair', () => {
    const result = findOpenSlots(day(), { durationMinutes: 60, chairId: 'c2' })
    expect(result.map((s) => s.chairId)).toEqual(['c2', 'c2', 'c2'])
  })

  it('never runs past closing time', () => {
    const result = findOpenSlots(day(), {
      durationMinutes: 60,
      chairId: 'c1',
      earliest: '10:30',
      limit: 10,
    })
    expect(result).toEqual([
      slot('c1', '10:30', '11:30'),
      slot('c1', '10:45', '11:45'),
      slot('c1', '11:00', '12:00'),
    ])
  })

  it('keeps the whole visit inside the requested window', () => {
    const result = findOpenSlots(day(), {
      durationMinutes: 30,
      chairId: 'c1',
      earliest: '09:00',
      latest: '10:00',
      limit: 10,
    })
    expect(result).toEqual([
      slot('c1', '09:00', '09:30'),
      slot('c1', '09:15', '09:45'),
      slot('c1', '09:30', '10:00'),
    ])
  })

  it('clamps a window that reaches outside opening hours', () => {
    const result = findOpenSlots(day(), {
      durationMinutes: 60,
      chairId: 'c1',
      earliest: '06:00',
      latest: '20:00',
      limit: 50,
    })
    expect(result[0]).toEqual(slot('c1', '08:00', '09:00'))
    expect(result.at(-1)).toEqual(slot('c1', '11:00', '12:00'))
  })

  it('starts slots on the 15-minute grid', () => {
    const result = findOpenSlots(day(), {
      durationMinutes: 30,
      chairId: 'c1',
      earliest: '09:10',
      limit: 1,
    })
    expect(result).toEqual([slot('c1', '09:15', '09:45')])
  })

  it('returns an empty list when nothing fits', () => {
    const fullDay = day([
      appt('a', 'c1', '08:00', '12:00'),
      appt('b', 'c2', '08:00', '11:30'),
    ])
    expect(findOpenSlots(fullDay, { durationMinutes: 45 })).toEqual([])
  })

  it('returns an empty list for a window entirely outside opening hours', () => {
    expect(
      findOpenSlots(day(), {
        durationMinutes: 30,
        earliest: '06:00',
        latest: '07:00',
      }),
    ).toEqual([])
  })

  it('rejects a duration that is not a positive whole number of minutes', () => {
    expect(() => findOpenSlots(day(), { durationMinutes: 0 })).toThrow(
      /duration/i,
    )
    expect(() => findOpenSlots(day(), { durationMinutes: 22.5 })).toThrow(
      /duration/i,
    )
  })

  it('rejects a chair that is not in this practice', () => {
    expect(() =>
      findOpenSlots(day(), { durationMinutes: 30, chairId: 'river-c1' }),
    ).toThrow(/chair/i)
  })

  it('rejects a window that ends before it starts', () => {
    expect(() =>
      findOpenSlots(day(), {
        durationMinutes: 30,
        earliest: '11:00',
        latest: '09:00',
      }),
    ).toThrow(/window/i)
  })
})
