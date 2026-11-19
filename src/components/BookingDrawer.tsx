import { type FormEvent, useId, useRef, useState } from 'react'
import type { NewAppointment } from '../api/schedule'
import { DEMO_DAY_LABEL } from '../config'
import { useModalDialog } from '../hooks/useModalDialog'
import { useParseBooking } from '../hooks/useSchedule'
import {
  contextFromDay,
  findOtherDay,
  LENGTHS,
  type SanitizedDraft,
  sanitizeDraft,
} from '../lib/assist'
import { typeLabel } from '../lib/display'
import { findOpenSlots, type OpenSlot } from '../lib/slots'
import { formatTime } from '../lib/time'
import type { AppointmentType, ScheduleDay } from '../types'

// A typical length for each visit type; the person can still change it.
const defaultLength: Record<AppointmentType, number> = {
  cleaning: 60,
  exam: 30,
  filling: 60,
  crown: 90,
  consult: 30,
  emergency: 30,
}
const NOON = '12:00'

// 'from' = start at the spot clicked on the schedule.
type TimeOfDay = 'any' | 'morning' | 'afternoon' | 'from'

type BookingDrawerProps = {
  day: ScheduleDay
  now: string // demo clock; times before it are never suggested
  isSaving: boolean
  saveError: string | null
  onBook: (input: NewAppointment) => void
  onClose: () => void
  // Filled in when the panel opens from a spot on the schedule.
  initialChairId?: string
  initialFrom?: string // "HH:MM"
}

const slotKey = (slot: OpenSlot) => `${slot.chairId}|${slot.start}`

export function BookingDrawer({
  day,
  now,
  isSaving,
  saveError,
  onBook,
  onClose,
  initialChairId = '',
  initialFrom,
}: BookingDrawerProps) {
  const [patientId, setPatientId] = useState('')
  const [type, setType] = useState<AppointmentType>('exam')
  const [length, setLength] = useState(defaultLength.exam)
  const [chairId, setChairId] = useState(initialChairId)
  const [fromTime, setFromTime] = useState(initialFrom)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(
    initialFrom ? 'from' : 'any',
  )

  // AI assist: free text in, form fields out. It never picks a time or books.
  const ai = useParseBooking(day.practice.id)
  const [aiText, setAiText] = useState('')
  const [aiAskedFor, setAiAskedFor] = useState('')
  const [aiInputError, setAiInputError] = useState<string | null>(null)
  const [aiResult, setAiResult] = useState<{
    filled: string[]
    warnings: string[]
    notUsed: string[]
  } | null>(null)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const patientRef = useRef<HTMLSelectElement>(null)
  const { dialogRef, onKeyDown } = useModalDialog<HTMLDivElement>(
    patientRef,
    onClose,
  )
  const ids = useId()

  // The slot finder does the scheduling; this form only collects the request.
  // Never suggest a time that has already passed on the demo clock.
  const nowClock = now.slice(11, 16)
  const windowStart =
    timeOfDay === 'afternoon'
      ? NOON
      : timeOfDay === 'from'
        ? fromTime
        : undefined
  const earliest =
    windowStart && windowStart > nowClock ? windowStart : nowClock
  const latest = timeOfDay === 'morning' ? NOON : undefined
  const slots =
    latest && earliest >= latest
      ? []
      : findOpenSlots(day, {
          durationMinutes: length,
          chairId: chairId || undefined,
          earliest,
          latest,
        })

  // If the filters change and the picked time is no longer offered, drop it.
  const picked = slots.find((slot) => slotKey(slot) === pickedKey) ?? null

  const patients = [...day.patients].sort((a, b) =>
    a.lastName.localeCompare(b.lastName),
  )
  const chairName = (id: string) =>
    day.chairs.find((c) => c.id === id)?.name ?? id

  // Bookings are for today only. If the request named another day, say so
  // plainly, whether or not the model noticed.
  const otherDay = aiResult ? findOtherDay(aiAskedFor) : null

  const patientError = showErrors && !patientId ? 'Choose a patient.' : null
  const timeError = showErrors && !picked ? 'Choose a time.' : null

  // Fill only what the AI was sure about; leave everything else as it is.
  function applyDraft(result: SanitizedDraft) {
    // Re-check against the day on screen: our server already checked, but
    // the form must only ever hold patients and chairs it can show.
    const { draft, warnings } = sanitizeDraft(result.draft, contextFromDay(day))
    const filled: string[] = []
    if (draft.patientId) {
      setPatientId(draft.patientId)
      filled.push('patient')
    }
    if (draft.visitType) {
      setType(draft.visitType)
      setLength(draft.durationMinutes ?? defaultLength[draft.visitType])
      filled.push('visit type')
    }
    if (draft.durationMinutes) {
      setLength(draft.durationMinutes)
      filled.push('length')
    }
    if (draft.chairId) {
      setChairId(draft.chairId)
      filled.push('chair')
    }
    if (draft.earliest) {
      setFromTime(draft.earliest)
      setTimeOfDay('from')
      filled.push('start time')
    } else if (draft.timeOfDay) {
      setTimeOfDay(draft.timeOfDay)
      filled.push('time of day')
    }
    setPickedKey(null)
    setShowErrors(false)
    setAiResult({
      filled,
      warnings: [...new Set([...result.warnings, ...warnings])],
      notUsed: draft.notUsed,
    })
  }

  function askAi(text: string) {
    if (ai.isPending) return
    if (!text.trim()) {
      setAiInputError('Type a request first.')
      return
    }
    setAiInputError(null)
    setAiAskedFor(text)
    ai.mutate(text, { onSuccess: applyDraft })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSaving) return
    if (!patientId || !picked) {
      setShowErrors(true)
      return
    }
    onBook({
      patientId,
      chairId: picked.chairId,
      start: picked.start,
      end: picked.end,
      type,
    })
  }

  const fieldClass =
    'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900'
  const labelClass = 'flex flex-col gap-1 text-sm font-medium text-slate-700'

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
        aria-labelledby={`${ids}-title`}
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col gap-5 overflow-y-auto bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              {day.practice.name}
            </p>
            <h2 id={`${ids}-title`} className="text-xl font-semibold">
              New appointment
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close new appointment"
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

        <div className="flex flex-col gap-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
          <label
            htmlFor={`${ids}-ai-text`}
            className="text-sm font-medium text-slate-800"
          >
            Describe the visit (AI assist)
          </label>
          <textarea
            id={`${ids}-ai-text`}
            rows={2}
            maxLength={300}
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="e.g. 60-minute cleaning for Ana Diaz this afternoon with Hygienist Patel"
            className="rounded-lg border border-slate-300 bg-white p-2.5 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-disabled={ai.isPending}
              onClick={() => askAi(aiText)}
              className="h-11 rounded-lg border border-teal-700 bg-white px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 aria-disabled:opacity-60"
            >
              {ai.isPending ? 'Reading…' : 'Fill in with AI'}
            </button>
            <span className="text-xs text-slate-600 tabular-nums">
              {aiText.length}/300
            </span>
          </div>
          {aiInputError && (
            <p className="text-sm text-red-700">{aiInputError}</p>
          )}
          {ai.isPending && (
            <p role="status" className="text-sm text-slate-700">
              Reading the request…
            </p>
          )}
          {ai.isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800"
            >
              <span className="mr-auto">{ai.error.message}</span>
              <button
                type="button"
                onClick={() => askAi(aiAskedFor)}
                className="h-11 rounded-lg border border-red-300 bg-white px-3 font-medium"
              >
                Try again
              </button>
            </div>
          )}
          {aiResult && ai.isSuccess && (
            <div
              role="status"
              className="flex flex-col gap-1 rounded-lg bg-white p-2.5 text-sm text-slate-700"
            >
              <p className="font-semibold text-slate-900">
                AI-filled. Review before booking.
              </p>
              {otherDay && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 font-medium text-amber-900">
                  You asked for {otherDay}. This books today, {DEMO_DAY_LABEL},
                  and the times below are for today.
                </p>
              )}
              <p>
                {aiResult.filled.length > 0
                  ? `Filled in: ${aiResult.filled.join(', ')}.`
                  : 'Nothing could be filled in from that request.'}
              </p>
              {aiResult.warnings.map((warning) => (
                <p key={warning} className="text-amber-800">
                  {warning}
                </p>
              ))}
              {aiResult.notUsed.length > 0 && (
                <p className="text-amber-800">
                  Not used: {aiResult.notUsed.join(', ')} (bookings are for
                  today only).
                </p>
              )}
            </div>
          )}
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <div className={labelClass}>
            <label htmlFor={`${ids}-patient`}>Patient</label>
            <select
              id={`${ids}-patient`}
              ref={patientRef}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              aria-invalid={patientError ? true : undefined}
              aria-describedby={
                patientError ? `${ids}-patient-error` : undefined
              }
              className={fieldClass}
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            {patientError && (
              <span
                id={`${ids}-patient-error`}
                className="text-sm font-normal text-red-700"
              >
                {patientError}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={labelClass}>
              <label htmlFor={`${ids}-type`}>Visit type</label>
              <select
                id={`${ids}-type`}
                value={type}
                onChange={(e) => {
                  const next = e.target.value as AppointmentType
                  setType(next)
                  setLength(defaultLength[next])
                }}
                className={fieldClass}
              >
                {(Object.keys(typeLabel) as AppointmentType[]).map((t) => (
                  <option key={t} value={t}>
                    {typeLabel[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className={labelClass}>
              <label htmlFor={`${ids}-length`}>Length</label>
              <select
                id={`${ids}-length`}
                value={String(length)}
                onChange={(e) => setLength(Number(e.target.value))}
                className={fieldClass}
              >
                {LENGTHS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </div>
            <div className={labelClass}>
              <label htmlFor={`${ids}-chair`}>Chair</label>
              <select
                id={`${ids}-chair`}
                value={chairId}
                onChange={(e) => setChairId(e.target.value)}
                className={fieldClass}
              >
                <option value="">Any chair</option>
                {day.chairs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.provider}
                  </option>
                ))}
              </select>
            </div>
            <div className={labelClass}>
              <label htmlFor={`${ids}-time`}>Time of day</label>
              <select
                id={`${ids}-time`}
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
                className={fieldClass}
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                {fromTime && (
                  <option value="from">From {formatTime(fromTime)}</option>
                )}
              </select>
            </div>
          </div>

          <fieldset
            aria-describedby={timeError ? `${ids}-time-error` : undefined}
            className="flex flex-col gap-2"
          >
            <legend className="mb-1 text-sm font-medium text-slate-700">
              Pick a time
            </legend>
            {slots.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                No open times match. Try another chair, length, or time of day.
              </p>
            ) : (
              slots.map((slot) => (
                <label
                  key={slotKey(slot)}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 py-2 text-sm has-checked:border-teal-700 has-checked:bg-teal-50"
                >
                  <input
                    type="radio"
                    name={`${ids}-slot`}
                    checked={
                      picked !== null && slotKey(picked) === slotKey(slot)
                    }
                    onChange={() => setPickedKey(slotKey(slot))}
                    className="size-4 accent-teal-700"
                  />
                  <span>
                    <span className="font-medium">
                      {formatTime(slot.start)} – {formatTime(slot.end)}
                    </span>
                    , {chairName(slot.chairId)}
                  </span>
                </label>
              ))
            )}
            {timeError && (
              <span id={`${ids}-time-error`} className="text-sm text-red-700">
                {timeError}
              </span>
            )}
          </fieldset>

          {saveError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {saveError}
            </p>
          )}

          <p className="text-xs text-slate-600">
            Suggested times come from the open-slot finder. You choose and book.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              aria-disabled={isSaving || undefined}
              className="h-11 flex-1 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
            >
              {isSaving ? 'Booking…' : 'Book'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
