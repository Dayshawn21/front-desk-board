import type { Appointment, AppointmentStatus, ScheduleDay } from '../types'
import { findOpenSlots, type OpenSlot } from './slots'
import { formatTime, toMinutes } from './time'

// Moving a visit to another time or chair today. Only before the patient
// arrives: once they're here, the visit is under way where it is.
export function canMoveVisit(status: AppointmentStatus): boolean {
  return status === 'scheduled' || status === 'confirmed'
}

const DEFAULT_OPTIONS = 5
const SAME_PROVIDER_FIRST = 3

// The times offered in "Move to…": open slots from now on today, the same
// length as the visit, never where it already is. The visit itself doesn't
// block a new time (it can shift 15 minutes into its own). The same slot
// finder as booking, so the same rules decide what's free.
//
// Ranking: up to three times with the visit's own provider (patients book
// a hygienist or a dentist, not a chair), then the earliest others.
export function moveOptions(
  day: ScheduleDay,
  visit: Appointment,
  now: string,
  limit = DEFAULT_OPTIONS,
): OpenSlot[] {
  const providerOf = (chairId: string) =>
    day.chairs.find((c) => c.id === chairId)?.provider
  const provider = providerOf(visit.chairId)

  const open = findOpenSlots(day, {
    durationMinutes: toMinutes(visit.end) - toMinutes(visit.start),
    earliest: now.slice(11, 16),
    ignoreId: visit.id,
    // Enough to find this provider's times among every chair's.
    limit: limit * day.chairs.length + 1,
  }).filter(
    (slot) => !(slot.chairId === visit.chairId && slot.start === visit.start),
  )

  const same = open
    .filter((slot) => providerOf(slot.chairId) === provider)
    .slice(0, SAME_PROVIDER_FIRST)
  const rest = open.filter((slot) => !same.includes(slot))
  return [...same, ...rest].slice(0, limit)
}

type MovedTo = { name: string; start: string; chairName: string }

export function moveToastText({ name, start, chairName }: MovedTo): string {
  return `${name}: moved to ${formatTime(start)}, ${chairName}`
}

export function moveUndoneText({ name, start, chairName }: MovedTo): string {
  return `${name}: move undone, back at ${formatTime(start)}, ${chairName}`
}
