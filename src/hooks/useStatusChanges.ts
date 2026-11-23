import { useState } from 'react'
import type { Permission } from '../lib/permissions'
import {
  changeKind,
  nextToastKey,
  type StatusChange,
  statusPatch,
  toastTextFor,
  undoFor,
} from '../lib/statusChange'
import type { AppointmentStatus, CancelReason, ScheduleDay } from '../types'
import type { useUpdateAppointment } from './useSchedule'

type Options = {
  day: ScheduleDay | undefined
  update: ReturnType<typeof useUpdateAppointment>
  can: (permission: Permission) => boolean
  onChanged?: () => void // e.g. clear another toast
}

// Every status change (drawer, flow board, or the toast's Undo) goes
// through changeStatus, so each one is saved the same way, gets a toast,
// and can be undone the same way. The rules live in lib/statusChange.
export function useStatusChanges({ day, update, can, onChanged }: Options) {
  const [lastChange, setLastChange] = useState<StatusChange | null>(null)

  // `version`: the version the change is based on. By default the one on
  // screen; Undo passes the one its change left, so it's refused if anyone
  // changed the visit since.
  const changeStatus = (
    id: string,
    to: AppointmentStatus,
    reason?: CancelReason,
    version?: number,
  ) => {
    const appt = day?.appointments.find((a) => a.id === id)
    if (!appt) return
    const patient = day?.patients.find((p) => p.id === appt.patientId)
    const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Visit'
    const from = appt.status

    update.mutate(
      { id, patch: statusPatch(from, to, version ?? appt.version, reason) },
      {
        onSuccess: (saved) => {
          onChanged?.()
          setLastChange({
            key: nextToastKey(),
            appointmentId: id,
            name,
            from,
            to,
            kind: changeKind(from, to),
            reason,
            version: saved.version,
          })
        },
      },
    )
  }

  // Undo is offered only when this role may take the step back. (Front desk
  // can check a patient out, but only the office manager can reopen.)
  const step = lastChange ? undoFor(lastChange) : null
  const undo =
    lastChange && step && can(step.permission)
      ? {
          label: `${step.label} for ${lastChange.name}`,
          onUndo: () =>
            changeStatus(
              lastChange.appointmentId,
              lastChange.from,
              undefined,
              lastChange.version,
            ),
        }
      : undefined

  return {
    changeStatus,
    toast: lastChange
      ? {
          key: lastChange.key,
          text: toastTextFor(lastChange),
          // The drawer already has its own step back for a forward step or
          // an undo of one; a cancel or no-show (and putting either back)
          // has nowhere else to be undone from inside the drawer.
          ...(inDrawer(lastChange) && {
            appointmentId: lastChange.appointmentId,
            name: lastChange.name,
          }),
        }
      : null,
    undo,
    clear: () => setLastChange(null),
  }
}

function inDrawer(change: StatusChange): boolean {
  return (
    change.kind === 'cancel' ||
    change.kind === 'no-show' ||
    change.kind === 'restore' ||
    (change.kind === 'undo' && change.from === 'no-show')
  )
}
