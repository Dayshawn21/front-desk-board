import { useEffect, useId, useRef } from 'react'
import {
  canPatientCheckIn,
  patientStatusLabel,
  patientVisitLabel,
} from '../../lib/patientBooking'
import { bookingPath, checkInPath } from '../../lib/route'
import { formatTime, formatTimeRange } from '../../lib/time'
import { PatientShell } from './PatientShell'
import { type PatientSession, RequirePatient } from './RequirePatient'

const SUBTITLE = 'Your visits'

// /patient: the patient signs in, then sees today's visits at their
// office (from the server, for their session only), with a check-in link
// for each one they haven't arrived for yet, and a way to book another.
export function PatientHomePage({
  arrivedSignedIn = false,
}: {
  arrivedSignedIn?: boolean // just signed up: focus the heading
}) {
  return (
    <RequirePatient
      arrivedSignedIn={arrivedSignedIn}
      subtitle="Patient sign-in"
      heading="Sign in"
      intro="See today's visits, check in when you arrive, or book a visit."
    >
      {(session) => <YourVisits session={session} />}
    </RequirePatient>
  )
}

function YourVisits({ session }: { session: PatientSession }) {
  const { account, signOut, justSignedIn } = session
  const { patient, practice, visits } = account
  const headingRef = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  // Just signed in: the page changed under the patient, so start screen
  // readers at the new heading. Not on page load.
  useEffect(() => {
    if (justSignedIn) headingRef.current?.focus()
  }, [justSignedIn])

  return (
    <PatientShell
      practiceName={practice.name}
      subtitle={SUBTITLE}
      signedIn={{ patient, onSignOut: signOut }}
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-slate-700">Hi {patient.firstName},</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Your visits
        </h1>
      </div>

      <section aria-labelledby={`${ids}-today`} className="flex flex-col gap-3">
        <h2 id={`${ids}-today`} className="font-semibold">
          Today
        </h2>
        {visits.length === 0 ? (
          <p className="text-slate-700">You have no visits today.</p>
        ) : (
          <ul aria-label="Your visits today" className="flex flex-col gap-3">
            {visits.map((visit) => {
              const label = patientVisitLabel(visit.type)
              return (
                <li
                  key={visit.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-lg font-semibold text-slate-900">
                      {label}
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {patientStatusLabel[visit.status]}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-slate-800">
                      {formatTimeRange(visit.start, visit.end)}
                    </p>
                    {visit.provider && (
                      <p className="text-slate-700">With {visit.provider}</p>
                    )}
                  </div>
                  {canPatientCheckIn(visit.status) && (
                    <a
                      href={checkInPath(practice.id, visit.id)}
                      className="flex h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800"
                    >
                      Check in
                      <span className="sr-only">
                        {' '}
                        for your {formatTime(visit.start)} {label.toLowerCase()}
                      </span>
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <a
        href={bookingPath(practice.id)}
        className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
      >
        Book a visit
      </a>
    </PatientShell>
  )
}
