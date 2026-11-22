import { useEffect, useId, useRef } from 'react'
import type { MyBill } from '../../api/patientPortal'
import { formatCents } from '../../lib/billing'
import {
  canPatientCheckIn,
  patientStatusLabel,
  patientVisitLabel,
} from '../../lib/patientBooking'
import { bookingPath, CHANGE_PASSWORD_PATH, checkInPath } from '../../lib/route'
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
                  {visit.bill && <YourBill bill={visit.bill} />}
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

      <section
        aria-labelledby={`${ids}-account`}
        className="flex flex-col gap-2 border-t border-slate-200 pt-6"
      >
        <h2 id={`${ids}-account`} className="font-semibold">
          Your account
        </h2>
        <p className="text-slate-700">Signed in as {patient.email}</p>
        <a
          href={CHANGE_PASSWORD_PATH}
          className="self-start font-medium text-teal-800 underline underline-offset-2"
        >
          Change password
        </a>
      </section>
    </PatientShell>
  )
}

// A checked-out visit's bill, read only. Paying happens at the front desk.
function YourBill({ bill }: { bill: MyBill }) {
  const ids = useId()
  const status =
    bill.patientCents === 0
      ? 'Nothing to pay: your plan covers this visit'
      : bill.balanceCents === 0
        ? 'Paid in full'
        : `Balance due: ${formatCents(bill.balanceCents)}`

  return (
    <section
      aria-labelledby={`${ids}-bill`}
      className="flex flex-col gap-2 border-t border-slate-200 pt-3"
    >
      <h3 id={`${ids}-bill`} className="font-semibold">
        Your bill
      </h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-slate-800">
        {bill.items.map((item) => (
          <div key={item.name} className="contents">
            <dt>{item.name}</dt>
            <dd className="text-right tabular-nums">
              {formatCents(item.cents)}
            </dd>
          </div>
        ))}
        <dt className="border-t border-slate-200 pt-1">Total</dt>
        <dd className="border-t border-slate-200 pt-1 text-right tabular-nums">
          {formatCents(bill.totalCents)}
        </dd>
        <dt>Insurance estimate</dt>
        <dd className="text-right tabular-nums">
          −{formatCents(bill.insuranceCents)}
        </dd>
        <dt className="font-semibold">Your share</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatCents(bill.patientCents)}
        </dd>
        {bill.paidCents > 0 && (
          <>
            <dt>Paid</dt>
            <dd className="text-right tabular-nums">
              {formatCents(bill.paidCents)}
            </dd>
          </>
        )}
      </dl>
      <p className="font-semibold text-slate-900">{status}</p>
      {bill.balanceCents > 0 && (
        <p className="text-sm text-slate-700">
          Pay at the front desk. The insurance part is an estimate until your
          plan replies.
        </p>
      )}
    </section>
  )
}
