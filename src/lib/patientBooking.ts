import type { AppointmentType, ScheduleDay } from '../types'
import type { OpenSlot } from './slots'

// Stub; implemented in the next commit.
export type PatientVisit = {
  type: AppointmentType
  label: string
  minutes: number
  hint: string
}

export const PATIENT_VISITS: PatientVisit[] = []

export function patientTimes(
  day: ScheduleDay,
  durationMinutes: number,
  now: string,
): OpenSlot[] {
  void day
  void durationMinutes
  void now
  return []
}
