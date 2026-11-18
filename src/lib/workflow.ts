import type { Appointment, AppointmentStatus } from '../types'
import type { Permission } from './permissions'

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
