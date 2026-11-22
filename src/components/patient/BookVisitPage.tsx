import { useEffect, useId, useRef, useState } from 'react'
import type { MyVisit } from '../../api/patientPortal'
import { ApiError } from '../../api/schedule'
import { DEMO_DAY_LABEL } from '../../config'
import { useBookMyVisit, useOpenTimes } from '../../hooks/usePatientSession'
import { usePractices } from '../../hooks/useSchedule'
import {
  PATIENT_VISITS,
  patientVisitLabel,
  spokenDuration,
} from '../../lib/patientBooking'
import { bookingPath, checkInPath, PATIENT_HOME_PATH } from '../../lib/route'
import { formatTime, formatTimeRange, toMinutes } from '../../lib/time'
import type { AppointmentType, Practice } from '../../types'
import { PatientShell } from './PatientShell'
import { type PatientSession, RequirePatient } from './RequirePatient'

const TAKEN = 'Sorry, that time was just taken. Please pick another time.'
const SUBTITLE = 'Online booking'

// The patient's side: sign in, then pick what the visit is for and one of
// today's open times, and book. Open times come from the server, worked
// out with the same slot finder the front desk uses, and carry no patient
// details. The server books for the signed-in patient only, at their own
// office, and re-checks the time (a 409 if someone else just took it). The
// new visit is "Scheduled" on the board, in every open tab.
export function BookVisitPage({ practiceId }: { practiceId: string }) {
  const practices = usePractices()

  if (practices.isPending) {
    return (
      <PatientShell subtitle={SUBTITLE} nameLoading>
        <p role="status" className="text-slate-600">
          Loading…
        </p>
      </PatientShell>
    )
  }

  if (practices.isError) {
    return (
      <PatientShell subtitle={SUBTITLE}>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn't load open times
        </h1>
        <p className="text-slate-700">{practices.error.message}</p>
        <button
          type="button"
          onClick={() => practices.refetch()}
          className="h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium"
        >
          Try again
        </button>
      </PatientShell>
    )
  }

  const practice = practices.data.find((p) => p.id === practiceId)
  if (!practice) {
    return (
      <PatientShell subtitle={SUBTITLE}>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn't find that practice
        </h1>
        <p className="text-slate-700">
          Check the link from your dental office, or give them a call.
        </p>
      </PatientShell>
    )
  }

  return (
    <RequirePatient
      subtitle={SUBTITLE}
      practiceName={practice.name}
      heading="Sign in to book"
      intro={`Then pick a time today, ${DEMO_DAY_LABEL}.`}
    >
      {(session) =>
        session.account.practice.id === practice.id ? (
          // Keyed by session: someone else signing in starts a fresh form.
          <BookingForm
            key={session.token}
            practice={practice}
            session={session}
          />
        ) : (
          <WrongOffice practice={practice} session={session} />
        )
      }
    </RequirePatient>
  )
}

// A patient can only book at their own office: say so, and link there.
function WrongOffice({
  practice,
  session,
}: {
  practice: Practice
  session: PatientSession
}) {
  const { account, signOut, justSignedIn } = session
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (justSignedIn) headingRef.current?.focus()
  }, [justSignedIn])

  return (
    <PatientShell
      practiceName={practice.name}
      subtitle={SUBTITLE}
      signedIn={{ patient: account.patient, onSignOut: signOut }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        You're a patient at {account.practice.name}
      </h1>
      <p className="text-slate-700">
        You can book online at your own dental office. To become a patient at{' '}
        {practice.name}, give them a call.
      </p>
      <a
        href={bookingPath(account.practice.id)}
        className="flex h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800"
      >
        Book at {account.practice.name}
      </a>
    </PatientShell>
  )
}

function BookingForm({
  practice,
  session,
}: {
  practice: Practice
  session: PatientSession
}) {
  const { token, account, signOut, justSignedIn } = session
  const patient = account.patient
  const book = useBookMyVisit(token)

  const [visitType, setVisitType] = useState<AppointmentType | null>(null)
  const [start, setStart] = useState<string | null>(null)
  const [booked, setBooked] = useState<MyVisit | null>(null)
  const [error, setError] = useState<string | null>(null)

  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  const doneHeadingRef = useRef<HTMLHeadingElement>(null)
  const focusFormNext = useRef(justSignedIn)
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

  const visit = PATIENT_VISITS.find((v) => v.type === visitType)
  const openTimes = useOpenTimes(practice.id, visit?.minutes ?? null)
  const times = openTimes.data?.times ?? []
  // Read from the fresh list: if someone just took this time, it's gone
  // from the list and nothing is selected.
  const slot = times.find((t) => t.start === start)
  const practiceName = practice.name
  const signedIn = { patient, onSignOut: signOut }

  const submit = () => {
    if (!slot || !visit || book.isPending) return
    setError(null)
    book.mutate(
      { practiceId: practice.id, type: visit.type, start: slot.start },
      {
        onSuccess: (made) => setBooked(made),
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
    setVisitType(null)
    setStart(null)
    setError(null)
    book.reset()
    focusFormNext.current = true
    setBooked(null)
  }

  if (booked) {
    const label = patientVisitLabel(booked.type)
    return (
      <PatientShell
        practiceName={practiceName}
        subtitle={SUBTITLE}
        signedIn={signedIn}
      >
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
            {label} for {patient.firstName} {patient.lastName}
          </p>
          <p className="text-slate-800">
            {DEMO_DAY_LABEL}, {formatTimeRange(booked.start, booked.end)}
          </p>
          {booked.provider && (
            <p className="text-slate-700">
              With {booked.provider} at {practiceName}
            </p>
          )}
        </div>
        <p className="text-slate-700">
          On the day,{' '}
          <a
            href={checkInPath(practice.id, booked.id)}
            className="font-medium text-teal-800 underline underline-offset-2"
          >
            check in from your phone
          </a>{' '}
          when you arrive. No clipboard, no waiting at the desk.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={PATIENT_HOME_PATH}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800"
          >
            See your visits
          </a>
          <button
            type="button"
            onClick={startOver}
            className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
          >
            Book another visit
          </button>
        </div>
      </PatientShell>
    )
  }

  const morning = times.filter((t) => toMinutes(t.start) < 12 * 60)
  const afternoon = times.filter((t) => toMinutes(t.start) >= 12 * 60)

  return (
    <PatientShell
      practiceName={practiceName}
      subtitle={SUBTITLE}
      signedIn={signedIn}
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-slate-700">Hi {patient.firstName},</p>
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
          submit()
        }}
      >
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

        {visit && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 font-semibold">Pick a time</legend>
            {openTimes.isPending ? (
              <p role="status" className="text-slate-600">
                Loading open times…
              </p>
            ) : openTimes.isError ? (
              <p role="alert" className="text-red-800">
                We couldn't load open times. {openTimes.error.message}
              </p>
            ) : times.length === 0 ? (
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

        {visit && times.length > 0 && (
          <button
            type="submit"
            disabled={!slot || book.isPending}
            className="h-12 rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {book.isPending
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
