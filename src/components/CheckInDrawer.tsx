import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import type { AppointmentPatch } from '../api/schedule'
import { statusStyle, typeLabel } from '../lib/display'
import { findConflicts } from '../lib/overlap'
import { formatTime } from '../lib/time'
import { flowSteps, nextAction } from '../lib/workflow'
import type { Appointment, CheckInChecklist, ScheduleDay } from '../types'

const checklistItems: { key: keyof CheckInChecklist; label: string }[] = [
  { key: 'insuranceVerified', label: 'Insurance verified' },
  { key: 'formsComplete', label: 'Forms complete' },
  { key: 'medicalHistoryReviewed', label: 'Medical history reviewed' },
  { key: 'copayCollected', label: 'Copay collected' },
]

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type CheckInDrawerProps = {
  day: ScheduleDay
  appointment: Appointment
  isSaving: boolean
  saveError: string | null
  onSave: (patch: AppointmentPatch) => void
  onClose: () => void
}

export function CheckInDrawer({
  day,
  appointment,
  isSaving,
  saveError,
  onSave,
  onClose,
}: CheckInDrawerProps) {
  // Local draft of the form. The parent remounts this component (key={id}) when a
  // different appointment opens, so the draft always starts from that appointment.
  const [checklist, setChecklist] = useState(appointment.checklist)
  const [notes, setNotes] = useState(appointment.notes)

  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // On open: remember what had focus (the card), move focus into the drawer.
  // On close (unmount): give focus back to that card.
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    closeButtonRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    // Focus trap: wrap from the last control to the first, and back.
    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const patient = day.patients.find((p) => p.id === appointment.patientId)
  const chair = day.chairs.find((c) => c.id === appointment.chairId)
  const name = patient
    ? `${patient.firstName} ${patient.lastName}`
    : 'Unknown patient'

  const conflictText = (
    findConflicts(day.appointments).get(appointment.id) ?? []
  ).map((otherId) => {
    const other = day.appointments.find((a) => a.id === otherId)
    const otherPatient = day.patients.find((p) => p.id === other?.patientId)
    if (!other || !otherPatient) return 'another appointment'
    return `${otherPatient.firstName} ${otherPatient.lastName} (${typeLabel[other.type]}, ${formatTime(other.start)}–${formatTime(other.end)})`
  })

  const action = nextAction(appointment.status)
  const currentStep = flowSteps.indexOf(appointment.status)
  const doneCount = checklistItems.filter((item) => checklist[item.key]).length
  const isDirty =
    notes !== appointment.notes ||
    checklistItems.some(
      (item) => checklist[item.key] !== appointment.checklist[item.key],
    )

  return (
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        onKeyDown={handleKeyDown}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Check-in
            </p>
            <h2 id="checkin-title" className="text-xl font-semibold">
              {name}
            </h2>
            <p className="text-sm text-slate-700">
              {typeLabel[appointment.type]} · {chair?.name ?? 'Unknown chair'} ·{' '}
              {formatTime(appointment.start)}–{formatTime(appointment.end)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close check-in"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {conflictText.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            Overlaps {conflictText.join(' and ')} in{' '}
            {chair?.name ?? 'this chair'}.
          </div>
        )}

        <section
          aria-labelledby="status-heading"
          className="flex flex-col gap-3"
        >
          <h3 id="status-heading" className="text-sm font-semibold">
            Status: {statusStyle[appointment.status].label}
          </h3>
          <ol className="grid grid-cols-5 gap-1">
            {flowSteps.map((step, i) => (
              <li
                key={step}
                aria-current={i === currentStep ? 'step' : undefined}
                className={`flex flex-col gap-1.5 text-xs ${i === currentStep ? 'font-semibold text-slate-900' : i < currentStep ? 'text-slate-700' : 'text-slate-500'}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1 rounded-full ${i < currentStep ? 'bg-teal-700' : i === currentStep ? 'bg-amber-500' : 'bg-slate-200'}`}
                />
                {statusStyle[step].label}
              </li>
            ))}
          </ol>
          {action && (
            <button
              type="button"
              // aria-disabled (not disabled) so the button keeps keyboard focus while saving
              aria-disabled={isSaving}
              onClick={() => {
                if (!isSaving) onSave({ status: action.status })
              }}
              className="h-11 self-start rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : action.label}
            </button>
          )}
        </section>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ checklist, notes })
          }}
        >
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-2 text-sm font-semibold">
              Checklist · {doneCount} of {checklistItems.length}
            </legend>
            {checklistItems.map((item) => (
              <label
                key={item.key}
                className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={(e) =>
                    setChecklist({ ...checklist, [item.key]: e.target.checked })
                  }
                  className="size-4 accent-teal-700"
                />
                {item.label}
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkin-notes" className="text-sm font-semibold">
              Front desk notes
            </label>
            <textarea
              id="checkin-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-slate-300 p-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={!isDirty || isSaving}
            className="h-11 self-start rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            Save checklist and notes
          </button>
        </form>

        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {saveError}
          </p>
        )}
      </aside>
    </div>
  )
}
