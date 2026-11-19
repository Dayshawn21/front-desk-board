import { type RefObject, useState } from 'react'
import type { NewAppointment } from '../api/schedule'
import { typeLabel } from '../lib/display'
import { formatTime } from '../lib/time'
import type { ScheduleDay } from '../types'
import type { useCreateAppointment } from './useSchedule'

// Where a booking started when it came from a spot on the schedule.
export type BookingStart = { chairId: string; time: string }

type Options = {
  day: ScheduleDay | undefined
  create: ReturnType<typeof useCreateAppointment>
  onBooked: (message: string) => void // e.g. show a toast
  // The New appointment button: where focus returns when the panel closes.
  buttonRef: RefObject<HTMLButtonElement | null>
}

// The New appointment panel's state: open or closed, where it started, and
// booking. The panel itself (BookingDrawer) owns the form.
export function useBooking({ day, create, onBooked, buttonRef }: Options) {
  const [isOpen, setIsOpen] = useState(false)
  const [start, setStart] = useState<BookingStart | null>(null)

  const open = (from: BookingStart | null) => {
    create.reset() // clear an error left over from an earlier attempt
    // A schedule spot can't take focus, so park focus on the New appointment
    // button first: when the panel closes, focus comes back to it.
    if (from) buttonRef.current?.focus()
    setStart(from)
    setIsOpen(true)
  }

  const book = (input: NewAppointment) => {
    create.mutate(input, {
      onSuccess: (appt) => {
        const patient = day?.patients.find((p) => p.id === appt.patientId)
        const chair = day?.chairs.find((c) => c.id === appt.chairId)
        const name = patient
          ? `${patient.firstName} ${patient.lastName}`
          : 'Visit'
        onBooked(
          `Booked ${name}: ${typeLabel[appt.type]}, ${formatTime(appt.start)}, ${chair?.name ?? ''}`,
        )
        setIsOpen(false)
      },
    })
  }

  return {
    isOpen,
    start,
    open,
    book,
    close: () => setIsOpen(false),
  }
}
