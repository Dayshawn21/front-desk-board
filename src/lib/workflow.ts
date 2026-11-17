import type { AppointmentStatus } from '../types'

// The visit's path through the front desk, in order. "cancelled" is outside the path.
export const flowSteps: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrived',
  'in-chair',
  'completed',
]

export type NextAction = { label: string; status: AppointmentStatus }

export function nextAction(status: AppointmentStatus): NextAction | null {
  switch (status) {
    case 'scheduled':
      return { label: 'Mark confirmed', status: 'confirmed' }
    case 'confirmed':
      return { label: 'Check in', status: 'arrived' }
    case 'arrived':
      return { label: 'Seat in chair', status: 'in-chair' }
    case 'in-chair':
      return { label: 'Check out', status: 'completed' }
    case 'completed':
    case 'cancelled':
      return null
  }
}
