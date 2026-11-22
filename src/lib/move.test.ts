import { describe, expect, it } from 'vitest'
import type { Appointment, AppointmentStatus, ScheduleDay } from '../types'
import {
  canMoveVisit,
  moveOptions,
  moveToastText,
  moveUndoneText,
} from './move'

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

// Open 08:00 to 12:00, two chairs.
function day(appointments: Appointment[]): ScheduleDay {
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

describe('canMoveVisit', () => {
  // Only before the patient arrives: after that the visit is under way.
  it.each<[AppointmentStatus, boolean]>([
    ['scheduled', true],
    ['confirmed', true],
    ['arrived', false],
    ['in-chair', false],
    ['completed', false],
    ['cancelled', false],
    ['no-show', false],
  ])('%s → %s', (status, expected) => {
    expect(canMoveVisit(status)).toBe(expected)
  })
})

describe('moveOptions', () => {
  it('offers later times today, same length, from the next 15 minutes after now', () => {
    const visit = appt('v', 'c1', '09:00', '09:45')
    expect(moveOptions(day([visit]), visit, at('09:40'), 3)).toEqual([
      slot('c1', '09:45', '10:30'),
      slot('c2', '09:45', '10:30'),
      slot('c1', '10:00', '10:45'),
    ])
  })

  it('never offers where the visit already is', () => {
    const visit = appt('v', 'c1', '10:00', '10:30')
    const options = moveOptions(day([visit]), visit, at('09:50'), 3)
    expect(options).toEqual([
      slot('c2', '10:00', '10:30'),
      slot('c1', '10:15', '10:45'), // overlaps its own old time: that's fine
      slot('c2', '10:15', '10:45'),
    ])
  })

  it('skips times other visits hold, but not cancelled ones', () => {
    const visit = appt('v', 'c1', '09:00', '10:00')
    const others = [
      appt('x', 'c2', '08:00', '12:00'),
      appt('y', 'c1', '10:00', '11:00'),
      appt('z', 'c1', '11:00', '12:00', { status: 'cancelled' }),
    ]
    expect(moveOptions(day([visit, ...others]), visit, at('09:30'), 3)).toEqual(
      [slot('c1', '11:00', '12:00')],
    )
  })

  it('gives five options by default', () => {
    const visit = appt('v', 'c1', '08:00', '08:30')
    expect(moveOptions(day([visit]), visit, at('08:00'))).toHaveLength(5)
  })

  it('is empty when nothing is left today', () => {
    const visit = appt('v', 'c1', '09:00', '10:00')
    expect(moveOptions(day([visit]), visit, at('11:30'))).toEqual([])
  })
})

describe('toast text', () => {
  it('says where the visit went', () => {
    expect(
      moveToastText({
        name: 'Lena Ortiz',
        start: at('11:30'),
        chairName: 'Chair 2',
      }),
    ).toBe('Lena Ortiz: moved to 11:30 AM, Chair 2')
  })

  it('says where Undo put it back', () => {
    expect(
      moveUndoneText({
        name: 'Lena Ortiz',
        start: at('09:45'),
        chairName: 'Chair 2',
      }),
    ).toBe('Lena Ortiz: move undone, back at 9:45 AM, Chair 2')
  })
})
