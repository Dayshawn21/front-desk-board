import type { AppointmentType, ScheduleDay } from '../types'
import { findOpenSlots, type OpenSlot } from './slots'

// What a patient can book for themselves online. Fillings and crowns are
// planned with the dentist, so they're booked by the front desk.
export type PatientVisit = {
  type: AppointmentType
  label: string // patient words, not the board's ("Checkup", not "Exam")
  minutes: number
  hint: string
}

export const PATIENT_VISITS: PatientVisit[] = [
  {
    type: 'cleaning',
    label: 'Cleaning',
    minutes: 60,
    hint: 'Cleaning, polish, and a quick check',
  },
  {
    type: 'exam',
    label: 'Checkup',
    minutes: 30,
    hint: 'An exam, with X-rays if you need them',
  },
  {
    type: 'consult',
    label: 'Consultation',
    minutes: 30,
    hint: 'Talk through a treatment plan or costs',
  },
  {
    type: 'emergency',
    label: 'Tooth pain',
    minutes: 30,
    hint: 'Something hurts, chipped, or came loose',
  },
]

// The times a patient can pick today: the slot finder's open slots that
// start at or after `now` (rounded up onto the 15-minute grid), one per
// start time. A patient doesn't choose a chair, so each time keeps the
// first free chair in the practice's order. Nothing for another day.
export function patientTimes(
  day: ScheduleDay,
  durationMinutes: number,
  now: string,
): OpenSlot[] {
  if (now.slice(0, 10) !== day.date) return []
  const slots = findOpenSlots(day, {
    durationMinutes,
    earliest: now.slice(11, 16),
    limit: Infinity,
  })
  const seen = new Set<string>()
  return slots.filter((slot) => {
    if (seen.has(slot.start)) return false
    seen.add(slot.start)
    return true
  })
}

// 60 -> "1 hour", 30 -> "30 minutes", 90 -> "1 hour 30 minutes".
export function spokenDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const parts = []
  if (hours) parts.push(hours === 1 ? '1 hour' : `${hours} hours`)
  if (rest) parts.push(`${rest} minutes`)
  return parts.join(' ')
}
