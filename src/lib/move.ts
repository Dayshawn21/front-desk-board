import type { Appointment, AppointmentStatus, ScheduleDay } from '../types'
import { findOpenSlots, type OpenSlot } from './slots'
import { formatTime, toMinutes } from './time'

// Moving a visit to another time or chair today. Only before the patient
// arrives: once they're here, the visit is under way where it is.
export function canMoveVisit(status: AppointmentStatus): boolean {
  return status === 'scheduled' || status === 'confirmed'
}

const DEFAULT_OPTIONS = 5

// The times offered in "Move to…": open slots from now on today, the same
// length as the visit, in any chair, never where it already is. The visit
// itself doesn't block a new time (it can shift 15 minutes into its own).
// The same slot finder as booking, so the same rules decide what's free.
export function moveOptions(
  day: ScheduleDay,
  visit: Appointment,
  now: string,
  limit = DEFAULT_OPTIONS,
): OpenSlot[] {
  return findOpenSlots(day, {
    durationMinutes: toMinutes(visit.end) - toMinutes(visit.start),
    earliest: now.slice(11, 16),
    ignoreId: visit.id,
    limit: limit + 1, // one spare, in case its own place is among them
  })
    .filter(
      (slot) => !(slot.chairId === visit.chairId && slot.start === visit.start),
    )
    .slice(0, limit)
}

type MovedTo = { name: string; start: string; chairName: string }

export function moveToastText({ name, start, chairName }: MovedTo): string {
  return `${name}: moved to ${formatTime(start)}, ${chairName}`
}

export function moveUndoneText({ name, start, chairName }: MovedTo): string {
  return `${name}: move undone, back at ${formatTime(start)}, ${chairName}`
}
