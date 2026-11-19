import { useEffect, useId, useRef, useState } from 'react'
import type { AppointmentPatch } from '../api/schedule'
import { useModalDialog } from '../hooks/useModalDialog'
import {
  cancelReasonLabel,
  roleLabel,
  statusStyle,
  typeLabel,
} from '../lib/display'
import { findConflicts } from '../lib/overlap'
import { formatTimeRange } from '../lib/time'
import {
  cancelAction,
  flowSteps,
  nextAction,
  noShowAction,
  previousAction,
} from '../lib/workflow'
import { useSession } from '../session/SessionContext'
import type {
  Appointment,
  AppointmentStatus,
  CancelReason,
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
  now: string // the demo clock, for "is this visit late?"
  isSaving: boolean
  saveError: string | null
  // Resolves when the save is done (rejects if it fails; the error itself
  // arrives through saveError).
  onSave: (patch: AppointmentPatch) => Promise<void>
  onChangeStatus: (status: AppointmentStatus, reason?: CancelReason) => void
  onClose: () => void
}

const cancelReasons = Object.keys(cancelReasonLabel) as CancelReason[]

export function CheckInDrawer({
  day,
  appointment,
  now,
  isSaving,
  saveError,
  onSave,
  onChangeStatus,
  onClose,
}: CheckInDrawerProps) {
  // Local copy of the form, so typing stays instant. The parent remounts
  // this component (key={id}) when a different appointment opens, so it
  // always starts from that appointment. There is no Save button: a tick
  // saves right away, notes save when you leave the box or close the drawer,
  // so closing can never throw work away.
  const [checklist, setChecklist] = useState(appointment.checklist)
  const [notes, setNotes] = useState(appointment.notes)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )

  const save = (patch: AppointmentPatch) => {
    setSaveState('saving')
    onSave(patch).then(
      () => setSaveState('saved'),
      () => setSaveState('idle'), // the error shows as saveError below
    )
  }
  // Leaving the box and then closing would otherwise save the same notes twice.
  const savedNotes = useRef(appointment.notes)
  const saveNotesIfChanged = () => {
    if (notes === savedNotes.current) return
    savedNotes.current = notes
    save({ notes })
  }
  const close = () => {
    saveNotesIfChanged()
    onClose()
  }

  const { role, can } = useSession()

  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const statusHeadingRef = useRef<HTMLHeadingElement>(null)

  // Cancelling takes two steps: "Cancel visit…" opens a reason, then confirm.
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState<CancelReason | null>(null)
  const [showReasonError, setShowReasonError] = useState(false)
  const cancelTriggerRef = useRef<HTMLButtonElement>(null)
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const reasonFormRef = useRef<HTMLFormElement>(null)
  const backToCancelTrigger = useRef(false)
  const reasonIds = useId()

  // Opening the reason step moves focus to the first reason; "Keep visit"
  // puts focus back on the button that opened it.
  useEffect(() => {
    if (confirmingCancel) {
      // Show the whole step, buttons included, not just the first reason.
      // (Optional call: jsdom has no scrollIntoView.)
      reasonFormRef.current?.scrollIntoView?.({ block: 'nearest' })
      firstReasonRef.current?.focus({ preventScroll: true })
    } else if (backToCancelTrigger.current) {
      backToCancelTrigger.current = false
      cancelTriggerRef.current?.focus()
    }
  }, [confirmingCancel])

  // Focus in on open, trap Tab, Escape closes, focus back to the card on close.
  const { dialogRef, onKeyDown } = useModalDialog<HTMLDivElement>(
    closeButtonRef,
    close,
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
    return `${otherPatient.firstName} ${otherPatient.lastName} (${typeLabel[other.type]}, ${formatTimeRange(other.start, other.end)})`
  })

  const action = nextAction(appointment.status)
  const canAdvance = action !== null && can(action.permission)
  const canEdit = can('edit-checklist')
  const undo = previousAction(appointment.status)
  const canUndo = undo !== null && can(undo.permission)
  const cancel = cancelAction(appointment.status)
  const canCancel = cancel !== null && can(cancel.permission)
  const noShow = noShowAction(appointment.status, appointment.start, now)
  const canNoShow = noShow !== null && can(noShow.permission)
  const currentStep = flowSteps.indexOf(appointment.status)
  const doneCount = checklistItems.filter((item) => checklist[item.key]).length

  return (
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60"
        onClick={close}
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
            <h2 id="checkin-title" className="text-xl font-semibold">
              {name}
            </h2>
            <p className="text-sm text-slate-700">
              {typeLabel[appointment.type]} · {chair?.name ?? 'Unknown chair'} ·{' '}
              {formatTimeRange(appointment.start, appointment.end)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close check-in"
            onClick={close}
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

        <div className="flex flex-col gap-4">
          {!canEdit && (
            <p className="text-sm text-slate-700">
              Read only for {roleLabel[role]}. The front desk updates the
              checklist.
            </p>
          )}
          {/* A disabled fieldset disables every checkbox inside it. */}
          <fieldset disabled={!canEdit} className="flex flex-col gap-1">
            <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-semibold">
              Checklist · {doneCount} of {checklistItems.length}
              {/* Polite: confirms each automatic save without interrupting. */}
              <span
                role="status"
                className="text-xs font-normal text-slate-600"
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : saveState === 'saved'
                    ? 'Saved'
                    : ''}
              </span>
            </legend>
            {checklistItems.map((item) => (
              <label
                key={item.key}
                className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checklist[item.key]}
                  onChange={(e) => {
                    const next = { ...checklist, [item.key]: e.target.checked }
                    setChecklist(next)
                    save({ checklist: next })
                  }}
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
              onBlur={saveNotesIfChanged}
              className="rounded-lg border border-slate-300 p-2.5 text-sm read-only:bg-slate-50"
            />
          </div>

          {canEdit && (
            <p className="text-xs text-slate-600">
              Changes save automatically.
            </p>
          )}
        </div>

        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {saveError}
          </p>
        )}

        {/* Kept apart from the next-step button so they're hard to hit by
            mistake. Both can be undone from the toast. */}
        {((cancel && canCancel) || (noShow && canNoShow)) && (
          <div className="mt-auto flex flex-col gap-3 border-t border-slate-200 pt-4">
            {confirmingCancel ? (
              <form
                ref={reasonFormRef}
                noValidate
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (isSaving) return
                  if (!cancelReason) {
                    setShowReasonError(true)
                    return
                  }
                  setConfirmingCancel(false)
                  onChangeStatus('cancelled', cancelReason)
                }}
              >
                <fieldset
                  aria-describedby={
                    showReasonError && !cancelReason
                      ? `${reasonIds}-error`
                      : undefined
                  }
                  className="flex flex-col gap-1"
                >
                  <legend className="mb-2 text-sm font-semibold">
                    Why is this visit being cancelled?
                  </legend>
                  {cancelReasons.map((reason, i) => (
                    <label
                      key={reason}
                      className="flex min-h-11 items-center gap-3 rounded-lg bg-slate-50 px-3 text-sm"
                    >
                      <input
                        ref={i === 0 ? firstReasonRef : undefined}
                        type="radio"
                        name={`${reasonIds}-reason`}
                        value={reason}
                        checked={cancelReason === reason}
                        onChange={() => setCancelReason(reason)}
                        className="size-4 accent-red-700"
                      />
                      {cancelReasonLabel[reason]}
                    </label>
                  ))}
                </fieldset>
                {showReasonError && !cancelReason && (
                  <p
                    id={`${reasonIds}-error`}
                    className="text-sm font-medium text-red-700"
                  >
                    Choose a reason.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    aria-disabled={isSaving}
                    className="h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 aria-disabled:opacity-60"
                  >
                    Cancel visit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      backToCancelTrigger.current = true
                      setConfirmingCancel(false)
                      setCancelReason(null)
                      setShowReasonError(false)
                    }}
                    className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Keep visit
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                {noShow && canNoShow && (
                  <button
                    type="button"
                    aria-disabled={isSaving}
                    onClick={() => {
                      if (!isSaving) onChangeStatus(noShow.status)
                    }}
                    className="h-11 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 aria-disabled:opacity-60"
                  >
                    {noShow.label}
                  </button>
                )}
                {cancel && canCancel && (
                  <button
                    ref={cancelTriggerRef}
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className="h-11 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    {cancel.label}…
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
