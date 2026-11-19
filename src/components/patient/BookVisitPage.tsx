import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../../api/schedule'
import { DEMO_DATE, DEMO_DAY_LABEL, DEMO_NOW } from '../../config'
import { useCreateAppointment, useSchedule } from '../../hooks/useSchedule'
import {
  PATIENT_VISITS,
  patientTimes,
  patientVisitLabel,
  spokenDuration,
} from '../../lib/patientBooking'
import { checkInPath } from '../../lib/route'
import { formatTime, formatTimeRange, toMinutes } from '../../lib/time'
import type { Appointment, AppointmentType } from '../../types'
import { PatientShell } from './PatientShell'

const TAKEN = 'Sorry, that time was just taken. Please pick another time.'
const SUBTITLE = 'Online booking'

// The patient's side: pick who the visit is for, what it's for, and one of
// today's open times, then book. Times come from the same slot finder the
// front desk uses, and the mock server re-checks the time when booking (a
// 409 if someone else just took it). The new visit is "Scheduled" on the
// board, in every open tab, for the desk to confirm.
export function BookVisitPage({ practiceId }: { practiceId: string }) {
  const schedule = useSchedule(practiceId, DEMO_DATE)
  const create = useCreateAppointment(practiceId, DEMO_DATE)

  const [patientId, setPatientId] = useState('')
  const [visitType, setVisitType] = useState<AppointmentType | null>(null)
  const [start, setStart] = useState<string | null>(null)
  const [booked, setBooked] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  const doneHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusFormNext = useRef(false)
  const patientHintId = useId()
  const ids = useId()

  // A new view replaced the old one: move focus to its heading so screen
  // reader and keyboard users start there. Not on first load, which is an
  // ordinary page load.
  useEffect(() => {
    if (booked) doneHeadingRef.current?.focus()
    else if (focusFormNext.current) {
      focusFormNext.current = false
      formHeadingRef.current?.focus()
    }
  }, [booked])

  if (schedule.isPending) {
    return (
      <PatientShell subtitle={SUBTITLE}>
        <p role="status" className="text-slate-600">
          Loading open times…
        </p>
      </PatientShell>
    )
  }

  if (schedule.isError) {
    const notFound =
      schedule.error instanceof ApiError && schedule.error.status === 404
    return (
      <PatientShell subtitle={SUBTITLE}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {notFound
            ? "We couldn't find that practice"
            : "We couldn't load open times"}
        </h1>
        <p className="text-slate-700">
          {notFound
            ? 'Check the link from your dental office, or give them a call.'
            : schedule.error.message}
        </p>
        {!notFound && (
          <button
            type="button"
            onClick={() => schedule.refetch()}
            className="h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium"
          >
            Try again
          </button>
        )}
      </PatientShell>
    )
  }

  const day = schedule.data
  const practiceName = day.practice.name
  const patients = [...day.patients].sort((a, b) =>
    a.firstName.localeCompare(b.firstName),
  )
  const visit = PATIENT_VISITS.find((v) => v.type === visitType)
  const times = visit ? patientTimes(day, visit.minutes, DEMO_NOW) : []
  // Read from the fresh list: if another tab just took this time, it's
  // gone from the list and nothing is selected.
  const slot = times.find((t) => t.start === start)

  const book = () => {
    if (!slot || !visit || !patientId) return
    setError(null)
    create.mutate(
      {
        patientId,
        chairId: slot.chairId,
        start: slot.start,
        end: slot.end,
        type: visit.type,
      },
      {
        onSuccess: (appointment) => setBooked(appointment),
        onError: (err) => {
          setStart(null)
          setError(
            err instanceof ApiError && err.status === 409 ? TAKEN : err.message,
          )
        },
      },
    )
  }

  const startOver = () => {
    setPatientId('')
    setVisitType(null)
    setStart(null)
    setError(null)
    create.reset()
    focusFormNext.current = true
    setBooked(null)
  }

  if (booked) {
    const patient = day.patients.find((p) => p.id === booked.patientId)
    const chair = day.chairs.find((c) => c.id === booked.chairId)
    const label = patientVisitLabel(booked.type)
    return (
      <PatientShell practiceName={practiceName} subtitle={SUBTITLE}>
        <div className="flex flex-col gap-2">
          <h1
            ref={doneHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            You're booked
          </h1>
          <p className="text-slate-700">
            We've saved your visit. The office will confirm it.
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-lg font-semibold text-slate-900">
            {label} for {patient?.firstName} {patient?.lastName}
          </p>
          <p className="text-slate-800">
            {DEMO_DAY_LABEL}, {formatTimeRange(booked.start, booked.end)}
          </p>
          {chair && (
            <p className="text-slate-700">
              With {chair.provider} at {practiceName}
            </p>
          )}
        </div>
        <p className="text-slate-700">
          On the day,{' '}
          <a
            href={checkInPath(practiceId, booked.id)}
            className="font-medium text-teal-800 underline underline-offset-2"
          >
            check in from your phone
          </a>{' '}
          when you arrive. No clipboard, no waiting at the desk.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
        >
          Book another visit
        </button>
      </PatientShell>
    )
  }

  const morning = times.filter((t) => toMinutes(t.start) < 12 * 60)
  const afternoon = times.filter((t) => toMinutes(t.start) >= 12 * 60)

  return (
    <PatientShell practiceName={practiceName} subtitle={SUBTITLE}>
      <div className="flex flex-col gap-1.5">
        <h1
          ref={formHeadingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Book a visit
        </h1>
        <p className="text-slate-700">
          Open times for today, {DEMO_DAY_LABEL}. It takes about a minute.
        </p>
      </div>

      <form
        className="flex flex-col gap-7"
        onSubmit={(event) => {
          event.preventDefault()
          book()
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor={`${patientHintId}-select`} className="font-semibold">
            Who is the visit for?
          </label>
          <p id={patientHintId} className="text-sm text-slate-600">
            Demo: choose one of the practice's made-up patients. A real page
            would ask you to sign in first.
          </p>
          <select
            id={`${patientHintId}-select`}
            aria-describedby={patientHintId}
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base"
          >
            <option value="">Choose a patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">What do you need?</legend>
          {PATIENT_VISITS.map((v) => (
            <label
              key={v.type}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 has-checked:border-teal-600 has-checked:bg-teal-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal-600"
            >
              <input
                type="radio"
                name="visit-type"
                value={v.type}
                checked={visitType === v.type}
                onChange={() => setVisitType(v.type)}
                aria-labelledby={`${ids}-${v.type}-name ${ids}-${v.type}-length`}
                aria-describedby={`${ids}-${v.type}-hint`}
                className="mt-1 size-4 shrink-0"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span id={`${ids}-${v.type}-name`} className="font-medium">
                    {v.label}
                  </span>
                  <span
                    id={`${ids}-${v.type}-length`}
                    className="text-sm text-slate-600"
                  >
                    {spokenDuration(v.minutes)}
                  </span>
                </span>
                <span
                  id={`${ids}-${v.type}-hint`}
                  className="text-sm text-slate-600"
                >
                  {v.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {patientId && visit && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-semibold">Pick a time</legend>
            {times.length === 0 ? (
              <p className="text-slate-700">
                There are no {visit.label.toLowerCase()} times left today.
                Please call the office and we'll find you a time.
              </p>
            ) : (
              [
                { name: 'Morning', list: morning },
                { name: 'Afternoon', list: afternoon },
              ]
                .filter((group) => group.list.length > 0)
                .map((group) => (
                  <div
                    key={group.name}
                    role="group"
                    aria-labelledby={`${ids}-${group.name}`}
                    className="flex flex-col gap-2"
                  >
                    <p
                      id={`${ids}-${group.name}`}
                      className="text-sm font-medium text-slate-600"
                    >
                      {group.name}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {group.list.map((t) => (
                        <label
                          key={t.start}
                          className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-800 has-checked:border-teal-700 has-checked:bg-teal-700 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal-600"
                        >
                          <input
                            type="radio"
                            name="time"
                            value={t.start}
                            checked={start === t.start}
                            onChange={() => {
                              setStart(t.start)
                              setError(null)
                            }}
                            className="sr-only"
                          />
                          {formatTime(t.start)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </fieldset>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </p>
        )}

        {patientId && visit && times.length > 0 && (
          <button
            type="submit"
            disabled={!slot || create.isPending}
            className="h-12 rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {create.isPending
              ? 'Booking…'
              : slot
                ? `Book ${formatTime(slot.start)}`
                : 'Pick a time to book'}
          </button>
        )}
      </form>
    </PatientShell>
  )
}
