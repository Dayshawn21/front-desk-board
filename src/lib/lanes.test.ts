import { describe, expect, it } from 'vitest'
import { appointments as seedAppointments } from '../mocks/seed'
import type { Appointment } from '../types'
import { assignLanes } from './lanes'

function appt(
  id: string,
  chairId: string,
  from: string,
  to: string,
): Appointment {
  return {
    id,
    practiceId: 'maple',
    patientId: `p-${id}`,
    chairId,
    start: `2026-11-17T${from}:00`,
    end: `2026-11-17T${to}:00`,
    type: 'exam',
    status: 'scheduled',
    checklist: {
      insuranceVerified: false,
      formsComplete: false,
      medicalHistoryReviewed: false,
      copayCollected: false,
    },
    notes: '',
  }
}

describe('assignLanes', () => {
  it('gives a lone visit the full width', () => {
    expect(assignLanes([appt('a', 'c1', '09:00', '10:00')]).get('a')).toEqual({
      lane: 0,
      laneCount: 1,
    })
  })

  it('keeps back-to-back visits full width', () => {
    const lanes = assignLanes([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '10:00', '10:30'),
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 1 })
    expect(lanes.get('b')).toEqual({ lane: 0, laneCount: 1 })
  })

  it('puts two overlapping visits side by side', () => {
    const lanes = assignLanes([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '09:30', '10:30'),
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 2 })
    expect(lanes.get('b')).toEqual({ lane: 1, laneCount: 2 })
  })

  it('reuses a lane once it is free', () => {
    const lanes = assignLanes([
      appt('long', 'c1', '09:00', '11:00'),
      appt('x', 'c1', '09:15', '09:45'),
      appt('y', 'c1', '10:00', '10:30'),
    ])
    expect(lanes.get('long')).toEqual({ lane: 0, laneCount: 2 })
    expect(lanes.get('x')).toEqual({ lane: 1, laneCount: 2 })
    expect(lanes.get('y')).toEqual({ lane: 1, laneCount: 2 })
  })

  it('lays out separate clusters independently', () => {
    const lanes = assignLanes([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c1', '09:30', '10:30'),
      appt('later', 'c1', '13:00', '14:00'),
    ])
    expect(lanes.get('later')).toEqual({ lane: 0, laneCount: 1 })
  })

  it('does not split columns for visits in different chairs', () => {
    const lanes = assignLanes([
      appt('a', 'c1', '09:00', '10:00'),
      appt('b', 'c2', '09:00', '10:00'),
    ])
    expect(lanes.get('a')).toEqual({ lane: 0, laneCount: 1 })
    expect(lanes.get('b')).toEqual({ lane: 0, laneCount: 1 })
  })

  it('splits only the conflicting pair in the seed data', () => {
    const lanes = assignLanes(
      seedAppointments.filter((a) => a.practiceId === 'maple'),
    )
    expect(lanes.get('a-06')).toEqual({ lane: 0, laneCount: 2 })
    expect(lanes.get('a-07')).toEqual({ lane: 1, laneCount: 2 })
    expect(lanes.get('a-08')).toEqual({ lane: 0, laneCount: 1 })
  })
})
