import type { Appointment, AppointmentStatus } from '../types'
import type { Permission } from './permissions'
import { toMinutes } from './time'

// The visit's path through the front desk, in order. "cancelled" is outside the path.
export const flowSteps: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrived',
  'in-chair',
  'completed',
]

// The next step for a visit, and the permission a role needs to take it.
export type NextAction = {
  label: string
  status: AppointmentStatus
  permission: Permission
}

export function nextAction(status: AppointmentStatus): NextAction | null {
  switch (status) {
    case 'scheduled':
      return {
        label: 'Mark confirmed',
        status: 'confirmed',
        permission: 'confirm',
      }
    case 'confirmed':
      return { label: 'Check in', status: 'arrived', permission: 'check-in' }
    case 'arrived':
      return { label: 'Seat in chair', status: 'in-chair', permission: 'seat' }
    case 'in-chair':
      return {
        label: 'Check out',
        status: 'completed',
        permission: 'check-out',
      }
    case 'completed':
    case 'cancelled':
    case 'no-show':
      return null
  }
}

// Moving a visit one step back, to fix a mistake.
// Undoing a step needs the same permission as taking it, except reopening a
// checked-out visit, which needs 'reopen-checkout' (billing may have started).
export type UndoAction = {
  label: string
  status: AppointmentStatus
  permission: Permission
}

export function previousAction(status: AppointmentStatus): UndoAction | null {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Undo confirm',
        status: 'scheduled',
        permission: 'confirm',
      }
    case 'arrived':
      return {
        label: 'Undo check-in',
        status: 'confirmed',
        permission: 'check-in',
      }
    case 'in-chair':
      return { label: 'Undo seating', status: 'arrived', permission: 'seat' }
    case 'completed':
      return {
        label: 'Reopen visit',
        status: 'in-chair',
        permission: 'reopen-checkout',
      }
    // A no-show goes back to expected. (It may have been only "scheduled";
    // the toast's Undo restores the exact earlier status.)
    case 'no-show':
      return {
        label: 'Undo no-show',
        status: 'confirmed',
        permission: 'no-show',
      }
    case 'scheduled':
    case 'cancelled':
      return null
  }
}

// Columns of the patient flow board. "Expected" covers scheduled and confirmed
// visits; cancelled visits are not on the board.
export type FlowColumnId = 'expected' | 'arrived' | 'in-chair' | 'checked-out'

export const flowColumns: {
  id: FlowColumnId
  label: string
  statuses: AppointmentStatus[]
}[] = [
  { id: 'expected', label: 'Expected', statuses: ['scheduled', 'confirmed'] },
  { id: 'arrived', label: 'Arrived', statuses: ['arrived'] },
  { id: 'in-chair', label: 'In chair', statuses: ['in-chair'] },
  { id: 'checked-out', label: 'Checked out', statuses: ['completed'] },
]

// Groups a day's visits into board columns, earliest start first.
export function groupByFlow(
  appointments: Appointment[],
): Record<FlowColumnId, Appointment[]> {
  const groups: Record<FlowColumnId, Appointment[]> = {
    expected: [],
    arrived: [],
    'in-chair': [],
    'checked-out': [],
  }
  // Same-day ISO strings with zero-padded hours sort correctly as text.
  const sorted = [...appointments].sort((a, b) =>
    a.start.localeCompare(b.start),
  )
  for (const appt of sorted) {
    const column = flowColumns.find((c) => c.statuses.includes(appt.status))
    if (column) groups[column.id].push(appt)
  }
  return groups
}

// Cancelling is only for visits that haven't started (the patient hasn't
// arrived). It's a status, not a delete: the record stays for history.
export function cancelAction(status: AppointmentStatus): NextAction | null {
  return status === 'scheduled' || status === 'confirmed'
    ? { label: 'Cancel visit', status: 'cancelled', permission: 'cancel' }
    : null
}

// Marking a no-show: for a visit that was expected (scheduled or confirmed)
// once its start time has passed. Late patients can still be checked in;
// the desk decides when someone isn't coming.
export function noShowAction(
  status: AppointmentStatus,
  start: string,
  now: string,
): NextAction | null {
  const expected = status === 'scheduled' || status === 'confirmed'
  // Same-day ISO strings sort correctly as text.
  return expected && start < now
    ? { label: 'Mark no-show', status: 'no-show', permission: 'no-show' }
    : null
}

// How late an expected visit is, in minutes, once its start has passed
// without the patient arriving; null otherwise.
export function minutesLate(
  appointment: Pick<Appointment, 'status' | 'start'>,
  now: string,
): number | null {
  const expected =
    appointment.status === 'scheduled' || appointment.status === 'confirmed'
  const late = toMinutes(now) - toMinutes(appointment.start)
  return expected && late > 0 ? late : null
}
