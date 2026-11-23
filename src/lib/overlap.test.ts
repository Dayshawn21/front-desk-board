import { describe, expect, it } from 'vitest'
import { appointments as seedAppointments } from '../mocks/seed'
import type { Appointment } from '../types'
import { findConflicts, rangesOverlap } from './overlap'

const D = '2026-11-17'
const range = (from: string, to: string) => ({
  start: `${D}T${from}:00`,
  end: `${D}T${to}:00`,
})

// Builds a valid Appointment with sensible defaults; each test overrides only what it cares about.
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
    ...range(from, to),
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
    ...overrides,
  }
}

describe('rangesOverlap', () => {
  it('detects a partial overlap', () => {
    expect(
      rangesOverlap(range('09:00', '10:00'), range('09:30', '10:30')),
    ).toBe(true)
  })

  it('treats back-to-back appointments as NOT overlapping', () => {
    expect(
      rangesOverlap(range('09:00', '10:00'), range('10:00', '10:30')),
    ).toBe(false)
  })

  it('treats back-to-back as not overlapping in either order', () => {
    expect(
      rangesOverlap(range('10:00', '10:30'), range('09:00', '10:00')),
    ).toBe(false)
  })

  it('detects two appointments with the same start time', () => {
    expect(
      rangesOverlap(range('09:00', '09:30'), range('09:00', '10:00')),
    ).toBe(true)
  })

  it('detects identical ranges', () => {
    expect(
      rangesOverlap(range('09:00', '10:00'), range('09:00', '10:00')),
    ).toBe(true)
  })

  it('detects a range fully contained in another', () => {
    expect(
      rangesOverlap(range('09:00', '11:00'), range('09:30', '10:00')),
    ).toBe(true)
  })

  it('detects containment in either order', () => {
    expect(
      rangesOverlap(range('09:30', '10:00'), range('09:00', '11:00')),
    ).toBe(true)
  })

  it('returns false for ranges far apart', () => {
    expect(
      rangesOverlap(range('08:00', '08:30'), range('13:00', '14:00')),
    ).toBe(false)
  })

  it('detects an overlap of a single minute', () => {
    expect(
      rangesOverlap(range('09:00', '10:00'), range('09:59', '10:30')),
    ).toBe(true)
  })

  it('throws on a range that ends before it starts', () => {
    expect(() =>
      rangesOverlap(range('10:00', '09:00'), range('09:00', '10:00')),
    ).toThrow('Invalid range')
  })

  it('throws on a zero-length range', () => {
    expect(() =>
      rangesOverlap(range('09:00', '09:00'), range('09:00', '10:00')),
    ).toThrow('Invalid range')
  })
})

describe('findConflicts', () => {
  it('returns an empty map when there are no appointments', () => {
    expect(findConflicts([]).size).toBe(0)
  })

  it('links two overlapping appointments in the same chair to each other', () => {
    const result = findConflicts([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '09:30', '10:30'),
    ])
    expect(result.get('a')).toEqual(['b'])
    expect(result.get('b')).toEqual(['a'])
  })

  it('ignores overlaps in different chairs', () => {
    const result = findConflicts([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c2', '09:00', '10:00'),
    ])
    expect(result.size).toBe(0)
  })

  it('ignores cancelled appointments', () => {
    const result = findConflicts([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '09:30', '10:30', { status: 'cancelled' }),
    ])
    expect(result.size).toBe(0)
  })

  it('does not flag back-to-back appointments in the same chair', () => {
    const result = findConflicts([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '10:00', '10:30'),
    ])
    expect(result.size).toBe(0)
  })

  it('lists every conflict when one appointment overlaps two others', () => {
    const result = findConflicts([
      appt('long', 'c1', '09:00', '11:00'),
      appt('x', 'c1', '09:15', '09:45'),
      appt('y', 'c1', '10:00', '10:30'),
    ])
    expect(result.get('long')).toEqual(['x', 'y'])
    expect(result.get('x')).toEqual(['long'])
    expect(result.get('y')).toEqual(['long'])
  })

  it('finds exactly the one deliberate conflict in the seed data', () => {
    const result = findConflicts(
      seedAppointments.filter((a) => a.practiceId === 'maple'),
    )
    expect([...result.keys()].sort()).toEqual(['a-06', 'a-07'])
  })
})
