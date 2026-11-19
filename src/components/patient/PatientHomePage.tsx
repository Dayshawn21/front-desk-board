import { useEffect, useId, useRef } from 'react'
import { usePatientSignIn } from '../../hooks/usePatientSignIn'
import {
  canPatientCheckIn,
  patientStatusLabel,
  patientVisitLabel,
} from '../../lib/patientBooking'
import { bookingPath, checkInPath } from '../../lib/route'
import { formatTime, formatTimeRange } from '../../lib/time'
import type { ScheduleDay } from '../../types'
import { PatientShell } from './PatientShell'
import { PatientSignIn } from './PatientSignIn'
import { PracticeDay } from './PracticeDay'

const SUBTITLE = 'Your visits'

// /patient/<practice>: the patient signs in (the demo way), then sees
// today's visits at this practice, with a check-in link for each one they
// haven't arrived for yet, and a way to book another.
export function PatientHomePage({ practiceId }: { practiceId: string }) {
  return (
    <PracticeDay
      practiceId={practiceId}
      subtitle={SUBTITLE}
      loadingText="Loading…"
      failedText="We couldn't load your visits"
    >
      {(day) => <PatientHome day={day} />}
    </PracticeDay>
  )
}

function PatientHome({ day }: { day: ScheduleDay }) {
  const practiceId = day.practice.id
  const { patient, signIn, signOut } = usePatientSignIn(
    practiceId,
    day.patients,
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)
  const ids = useId()

  // Signing in or out swaps the page: move focus to the new heading so a
  // screen reader says it. Not on page load.
  useEffect(() => {
    if (focusHeading.current) {
      focusHeading.current = false
      headingRef.current?.focus()
    }
  }, [patient?.id])

  if (!patient) {
    return (
      <PatientShell practiceName={day.practice.name} subtitle="Patient sign-in">
        <PatientSignIn
          heading="Sign in"
          intro="See today's visits, check in when you arrive, or book a visit."
          patients={day.patients}
          headingRef={headingRef}
          onSignIn={(id) => {
            focusHeading.current = true
            signIn(id)
          }}
        />
      </PatientShell>
    )
  }

  const visits = day.appointments
    .filter((a) => a.patientId === patient.id)
    .sort((a, b) => a.start.localeCompare(b.start))

  return (
    <PatientShell
      practiceName={day.practice.name}
      subtitle={SUBTITLE}
      signedIn={{
        patient,
        onSignOut: () => {
          focusHeading.current = true
          signOut()
        },
      }}
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
              const chair = day.chairs.find((c) => c.id === visit.chairId)
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
                    {chair && (
                      <p className="text-slate-700">With {chair.provider}</p>
                    )}
                  </div>
                  {canPatientCheckIn(visit.status) && (
                    <a
                      href={checkInPath(practiceId, visit.id)}
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
        href={bookingPath(practiceId)}
        className="flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-medium text-slate-900 hover:bg-slate-100"
      >
        Book a visit
      </a>
    </PatientShell>
  )
}
