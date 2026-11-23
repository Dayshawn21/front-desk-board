import { useState } from 'react'
import { moveToastText, moveUndoneText } from '../lib/move'
import type { Permission } from '../lib/permissions'
import type { OpenSlot } from '../lib/slots'
import { nextToastKey } from '../lib/statusChange'
import type { ScheduleDay } from '../types'
import type { useMoveAppointment } from './useSchedule'

type Options = {
  day: ScheduleDay | undefined
  move: ReturnType<typeof useMoveAppointment>
  can: (permission: Permission) => boolean
  onChanged?: () => void // e.g. clear another toast
}

type Place = { chairId: string; start: string }

type LastMove = {
  key: number
  appointmentId: string
  name: string
  from: Place // where it was, for Undo
  version: number // the visit's version after the move, for Undo
  text: string
  undoable: boolean // false once it has been undone
}

// Moving a visit works like a status change: it saves, shows a toast, and
// the toast offers Undo, which puts the visit back where it was.
export function useMoves({ day, move, can, onChanged }: Options) {
  const [last, setLast] = useState<LastMove | null>(null)

  const chairName = (id: string) =>
    day?.chairs.find((c) => c.id === id)?.name ?? 'another chair'

  // Resolves once saved and the schedule has refetched; rejects on failure
  // (the error itself arrives through move.error).
  const moveVisit = async (appointmentId: string, to: OpenSlot) => {
    const appt = day?.appointments.find((a) => a.id === appointmentId)
    if (!appt) return
    const patient = day?.patients.find((p) => p.id === appt.patientId)
    const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Visit'
    const from = { chairId: appt.chairId, start: appt.start }

    const saved = await move.mutateAsync({
      id: appointmentId,
      to: { chairId: to.chairId, start: to.start, version: appt.version },
    })
    onChanged?.()
    setLast({
      key: nextToastKey(),
      appointmentId,
      name,
      from,
      version: saved.version,
      text: moveToastText({
        name,
        start: to.start,
        chairName: chairName(to.chairId),
      }),
      undoable: true,
    })
  }

  const undoMove = (moved: LastMove) => {
    move.mutate(
      {
        id: moved.appointmentId,
        to: { ...moved.from, restore: true, version: moved.version },
      },
      {
        onSuccess: () => {
          onChanged?.()
          setLast({
            ...moved,
            key: nextToastKey(),
            text: moveUndoneText({
              name: moved.name,
              start: moved.from.start,
              chairName: chairName(moved.from.chairId),
            }),
            undoable: false, // no "undo the undo"
          })
        },
      },
    )
  }

  const undo =
    last?.undoable && can('move')
      ? {
          label: `Undo move for ${last.name}`,
          onUndo: () => undoMove(last),
        }
      : undefined

  return {
    moveVisit,
    toast: last
      ? {
          key: last.key,
          text: last.text,
          appointmentId: last.appointmentId,
          name: last.name,
        }
      : null,
    undo,
    clear: () => setLast(null),
  }
}
