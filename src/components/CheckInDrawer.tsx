import { useEffect, useRef, useState } from 'react'
import type { AppointmentPatch } from '../api/schedule'
import { useModalDialog } from '../hooks/useModalDialog'
import { roleLabel, statusStyle, typeLabel } from '../lib/display'
import { findConflicts } from '../lib/overlap'
import { formatTime } from '../lib/time'
import {
  cancelAction,
  flowSteps,
  nextAction,
  previousAction,
} from '../lib/workflow'
import { useSession } from '../session/SessionContext'
import type {
  Appointment,
  AppointmentStatus,
  CheckInChecklist,
  ScheduleDay,
} from '../types'

const checklistItems: { key: keyof CheckInChecklist; label: string }[] = [
  { key: 'insuranceVerified', label: 'Insurance verified' },
  { key: 'formsComplete', label: 'Forms complete' },
  { key: 'medicalHistoryReviewed', label: 'Medical history reviewed' },
  { key: 'copayCollected', label: 'Copay collected' },
]

type CheckInDrawerProps = {
  day: ScheduleDay
  appointment: Appointment
  isSaving: boolean
  saveError: string | null
  onSave: (patch: AppointmentPatch) => void
  onChangeStatus: (status: AppointmentStatus) => void
  onClose: () => void
}

export function CheckInDrawer({
  day,
  appointment,
  isSaving,
  saveError,
  onSave,
  onChangeStatus,
  onClose,
}: CheckInDrawerProps) {
  // Local draft of the form. The parent remounts this component (key={id}) when a
  // different appointment opens, so the draft always starts from that appointment.
  const [checklist, setChecklist] = useState(appointment.checklist)
  const [notes, setNotes] = useState(appointment.notes)

  const { role, can } = useSession()

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const statusHeadingRef = useRef<HTMLHeadingElement>(null)

  // Focus in on open, trap Tab, Escape closes, focus back to the card on close.
  const { dialogRef, onKeyDown } = useModalDialog<HTMLDivElement>(
    closeButtonRef,
    onClose,
  )

  // After a status change the next-step button can disappear (e.g. front desk
  // checks a patient in, but only a provider can seat them). If that drops focus
  // out of the drawer, put it on the status heading, which also reads the new status.
  useEffect(() => {
    if (!dialogRef.current?.contains(document.activeElement)) {
      statusHeadingRef.current?.focus()
    }
  }, [appointment.status, dialogRef])

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
  const canAdvance = action !== null && can(action.permission)
  const canEdit = can('edit-checklist')
  const undo = previousAction(appointment.status)
  const canUndo = undo !== null && can(undo.permission)
  const cancel = cancelAction(appointment.status)
  const canCancel = cancel !== null && can(cancel.permission)
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

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-title"
        onKeyDown={onKeyDown}
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
          <h3
            ref={statusHeadingRef}
            id="status-heading"
            tabIndex={-1}
            className="text-sm font-semibold"
          >
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
          {action && !canAdvance && (
            <p className="text-sm text-slate-700">
              Next step: {action.label}. Not available to {roleLabel[role]}.
            </p>
          )}
          {(canAdvance || canUndo) && (
            <div className="flex flex-wrap gap-2">
              {action && canAdvance && (
                <button
                  type="button"
                  // aria-disabled (not disabled) so the button keeps keyboard focus while saving
                  aria-disabled={isSaving}
                  onClick={() => {
                    if (!isSaving) onChangeStatus(action.status)
                  }}
                  className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : action.label}
                </button>
              )}
              {undo && canUndo && (
                <button
                  type="button"
                  aria-disabled={isSaving}
                  onClick={() => {
                    if (!isSaving) onChangeStatus(undo.status)
                  }}
                  className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 aria-disabled:opacity-60"
                >
                  {undo.label}
                </button>
              )}
            </div>
          )}
        </section>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave({ checklist, notes })
          }}
        >
          {!canEdit && (
            <p className="text-sm text-slate-700">
              Read only for {roleLabel[role]}. The front desk updates the
              checklist.
            </p>
          )}
          {/* A disabled fieldset disables every checkbox inside it. */}
          <fieldset disabled={!canEdit} className="flex flex-col gap-1">
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
              readOnly={!canEdit}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-slate-300 p-2.5 text-sm read-only:bg-slate-50"
            />
          </div>

          {canEdit && (
            <button
              type="submit"
              disabled={!isDirty || isSaving}
              className="h-11 self-start rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              Save checklist and notes
            </button>
          )}
        </form>

        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {saveError}
          </p>
        )}

        {/* Kept apart from the next-step button so it's hard to hit by mistake.
            No "Are you sure?": the toast offers Undo instead. */}
        {cancel && canCancel && (
          <div className="mt-auto border-t border-slate-200 pt-4">
            <button
              type="button"
              aria-disabled={isSaving}
              onClick={() => {
                if (!isSaving) onChangeStatus(cancel.status)
              }}
              className="h-11 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 aria-disabled:opacity-60"
            >
              {cancel.label}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
