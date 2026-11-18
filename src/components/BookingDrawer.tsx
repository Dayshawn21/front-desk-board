import { type FormEvent, useId, useRef, useState } from 'react'
import type { NewAppointment } from '../api/schedule'
import { useModalDialog } from '../hooks/useModalDialog'
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
const LENGTHS = [15, 30, 45, 60, 90]
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
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(
    initialFrom ? 'from' : 'any',
  )
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const patientRef = useRef<HTMLSelectElement>(null)
  const { dialogRef, onKeyDown } = useModalDialog<HTMLElement>(
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
        ? initialFrom
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

  const patientError = showErrors && !patientId ? 'Choose a patient.' : null
  const timeError = showErrors && !picked ? 'Choose a time.' : null

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

      <aside
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

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <label className={labelClass}>
            Patient
            <select
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
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Visit type
              <select
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
            </label>
            <label className={labelClass}>
              Length
              <select
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
            </label>
            <label className={labelClass}>
              Chair
              <select
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
            </label>
            <label className={labelClass}>
              Time of day
              <select
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
                className={fieldClass}
              >
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                {initialFrom && (
                  <option value="from">From {formatTime(initialFrom)}</option>
                )}
              </select>
            </label>
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
      </aside>
    </div>
  )
}
