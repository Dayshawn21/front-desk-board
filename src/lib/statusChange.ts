import type { AppointmentPatch } from '../api/schedule'
import type { AppointmentStatus, CancelReason } from '../types'
import { cancelReasonLabel, statusStyle } from './display'
import type { Permission } from './permissions'
import { previousAction } from './workflow'

// The rules behind every status change on the board, kept apart from React
// so they're easy to read and test: what kind of change it is, what gets
// saved, what Undo does, and what the toast says.

// forward: a normal step; undo: one step back; cancel: visit cancelled;
// restore: a cancel was undone; no-show: marked as not coming
export type ChangeKind = 'forward' | 'undo' | 'cancel' | 'restore' | 'no-show'

// The most recent change, kept so the toast can offer to undo it.
export type StatusChange = {
  key: number // new for every change, so the toast restarts its timer
  appointmentId: string
  name: string
  from: AppointmentStatus
  to: AppointmentStatus
  kind: ChangeKind
  reason?: CancelReason // for a cancel
}

export function changeKind(
  from: AppointmentStatus,
  to: AppointmentStatus,
): ChangeKind {
  if (to === 'cancelled') return 'cancel'
  if (to === 'no-show') return 'no-show'
  if (from === 'cancelled') return 'restore'
  if (from === 'no-show' || previousAction(from)?.status === to) return 'undo'
  return 'forward'
}

// What to save. A cancel records why; restoring a cancelled visit clears it.
export function statusPatch(
  from: AppointmentStatus,
  to: AppointmentStatus,
  reason?: CancelReason,
): AppointmentPatch {
  if (to === 'cancelled') return { status: to, cancelReason: reason }
  if (from === 'cancelled') return { status: to, cancelReason: null }
  return { status: to }
}

export type UndoStep = {
  label: string
  status: AppointmentStatus
  permission: Permission
}

// What Undo would do for a change, before checking the role may do it.
// A forward step goes one step back; a cancel or no-show goes back to
// exactly the status it had. Undoing an undo or a restore isn't offered.
export function undoFor(change: StatusChange): UndoStep | null {
  switch (change.kind) {
    case 'forward': {
      const back = previousAction(change.to)
      return back?.status === change.from ? back : null
    }
    case 'cancel':
      return { label: 'Undo cancel', status: change.from, permission: 'cancel' }
    case 'no-show':
      return {
        label: 'Undo no-show',
        status: change.from,
        permission: 'no-show',
      }
    case 'undo':
    case 'restore':
      return null
  }
}

export function toastTextFor(change: StatusChange): string {
  const { name, to } = change
  switch (change.kind) {
    case 'forward':
      return `${name}: ${statusStyle[to].label}`
    case 'undo':
      return `${name}: moved back to ${statusStyle[to].label}`
    case 'cancel':
      return change.reason
        ? `${name}: cancelled, ${cancelReasonLabel[change.reason].toLowerCase()}`
        : `${name}: cancelled`
    case 'no-show':
      return `${name}: marked no-show`
    case 'restore':
      return `${name}: restored as ${statusStyle[to].label}`
  }
}

// A fresh key for each toast (status changes and notices share one toast).
let toastKey = 0
export function nextToastKey(): number {
  toastKey += 1
  return toastKey
}
