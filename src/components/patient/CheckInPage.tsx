import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import type { MyVisit } from '../../api/patientPortal'
import { useCheckInMyVisit } from '../../hooks/usePatientSession'
import { usePractices } from '../../hooks/useSchedule'
import { patientVisitLabel } from '../../lib/patientBooking'
import { PATIENT_HOME_PATH } from '../../lib/route'
import { formatTimeRange } from '../../lib/time'
import { PatientShell } from './PatientShell'
import { type PatientSession, RequirePatient } from './RequirePatient'

const SUBTITLE = 'Check-in'
const NOT_SAVED =
  "We couldn't save that. Please try again, or tell the front desk."
const NOT_CHECKED_IN =
  "We couldn't check you in. Please try again, or tell the front desk."

type CheckInPageProps = { practiceId: string; visitId: string }

// The page a patient opens on their phone when they arrive (the link comes
// from the front desk, or from their booking confirmation). The link alone
// shows nothing: the patient signs in first, and the page can only show a
// visit that's in their own account, which the server returns for their
// session. Anyone else's visit is "not found", even signed in.
export function CheckInPage({ practiceId, visitId }: CheckInPageProps) {
  const practices = usePractices()
  const practiceName = practices.data?.find((p) => p.id === practiceId)?.name

  return (
    <RequirePatient
      subtitle={SUBTITLE}
      practiceName={practiceName}
      practiceLoading={practices.isPending}
      heading="Sign in to check in"
      intro="Then tick your forms and tell us you're here."
    >
      {(session) => {
        const { account } = session
        const visit =
          account.practice.id === practiceId
            ? account.visits.find((v) => v.id === visitId)
            : undefined
        return visit ? (
          <CheckInView key={visit.id} session={session} visit={visit} />
        ) : (
          <VisitNotFound session={session} />
        )
      }}
    </RequirePatient>
  )
}

function useFocusWhen(when: boolean) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (when) ref.current?.focus()
  }, [when])
  return ref
}

function VisitNotFound({ session }: { session: PatientSession }) {
  const { account, signOut, justSignedIn } = session
  const headingRef = useFocusWhen(justSignedIn)
  return (
    <PatientShell
      practiceName={account.practice.name}
      subtitle={SUBTITLE}
      signedIn={{ patient: account.patient, onSignOut: signOut }}
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none"
      >
        We couldn't find that visit
      </h1>
      <p className="text-slate-700">
        It isn't one of your visits today. Check the link from your dental
        office, or tell the front desk when you arrive.
      </p>
      <a
        href={PATIENT_HOME_PATH}
        className="flex h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800"
      >
        See your visits
      </a>
    </PatientShell>
  )
}

// The two checklist items a patient can do themselves. Insurance and the
// copay stay with the front desk.
type PatientTicks = { formsComplete: boolean; medicalHistoryReviewed: boolean }

function CheckInView({
  session,
  visit: appointment,
}: {
  session: PatientSession
  visit: MyVisit
}) {
  const { token, account, signOut, justSignedIn } = session
  const update = useCheckInMyVisit(token)
  const patient = account.patient
  const checkInHeadingRef = useFocusWhen(justSignedIn)

  // The patient's ticks live here while the page is open; each one is saved
  // right away. Saves send only the patient's boxes, and the server merges
  // them, so the desk's ticks (insurance, copay) are never overwritten.
  const [ticks, setTicks] = useState<PatientTicks>({
    formsComplete: appointment.checklist.formsComplete,
    medicalHistoryReviewed: appointment.checklist.medicalHistoryReviewed,
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)

  const doneHeadingRef = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  const status = appointment.status
  const done =
    checkedIn ||
    status === 'arrived' ||
    status === 'in-chair' ||
    status === 'completed'

  // After "I'm here", the page changes under the patient: move focus to the
  // new heading so a screen reader says it. Not when the page opens already
  // checked in, which is an ordinary page load.
  useEffect(() => {
    if (checkedIn) doneHeadingRef.current?.focus()
  }, [checkedIn])

  const tick = (key: keyof PatientTicks, value: boolean) => {
    setTicks({ ...ticks, [key]: value })
    setError(null)
    setSaveState('saving')
    update.mutate(
      {
        id: appointment.id,
        change: { checklist: { [key]: value } },
      },
      {
        onSuccess: () => setSaveState('saved'),
        onError: () => {
          setSaveState('idle')
          setError(NOT_SAVED)
        },
      },
    )
  }

  const imHere = () => {
    if (update.isPending) return
    setError(null)
    update.mutate(
      {
        id: appointment.id,
        change: {
          arrived: true,
          checklist: ticks,
        },
      },
      {
        onSuccess: () => setCheckedIn(true),
        onError: () => setError(NOT_CHECKED_IN),
      },
    )
  }

  const visitCard = (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-teal-200 bg-teal-50 p-5">
      <p className="text-lg font-semibold text-slate-900">
        {patientVisitLabel(appointment.type)}
      </p>
      <p className="text-slate-800">
        Today, {formatTimeRange(appointment.start, appointment.end)}
      </p>
      {appointment.provider && (
        <p className="text-slate-700">With {appointment.provider}</p>
      )}
    </div>
  )

  const shell = (children: ReactNode) => (
    <PatientShell
      practiceName={account.practice.name}
      subtitle={SUBTITLE}
      signedIn={{ patient, onSignOut: signOut }}
    >
      {children}
    </PatientShell>
  )

  if (status === 'cancelled' || status === 'no-show') {
    return shell(
      <>
        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 'cancelled'
            ? 'This visit was cancelled'
            : 'This visit was marked as missed'}
        </h1>
        <p className="text-slate-700">
          Please call the office and we'll find you a new time. If you're
          already here, tell the front desk.
        </p>
      </>,
    )
  }

  if (done) {
    return shell(
      <>
        <div className="flex flex-col gap-2">
          <h1
            ref={doneHeadingRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            You're checked in
          </h1>
          <p className="text-slate-700">
            Thanks, {patient.firstName}. Have a seat; we'll call you when it's
            time.
          </p>
        </div>
        {visitCard}
      </>,
    )
  }

  return shell(
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-slate-700">Hi {patient.firstName},</p>
        <h1
          ref={checkInHeadingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Check in
        </h1>
        <p className="text-slate-700">
          Check your details, tick what you've done, and tap I'm here.
        </p>
      </div>

      {visitCard}

      <section
        aria-labelledby={`${ids}-details`}
        className="flex flex-col gap-3"
      >
        <h2 id={`${ids}-details`} className="font-semibold">
          Your details
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-slate-600">Name</dt>
          <dd>
            {patient.firstName} {patient.lastName}
          </dd>
          <dt className="text-slate-600">Phone</dt>
          <dd>{patient.phone}</dd>
          <dt className="text-slate-600">Insurance</dt>
          <dd>{patient.insuranceProvider ?? 'None on file'}</dd>
        </dl>
        <p className="text-sm text-slate-600">
          Something wrong or changed? Tell the front desk when you come in.
        </p>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex w-full items-baseline justify-between font-semibold">
          Before your visit
          {/* Polite: confirms each save without interrupting. */}
          <span role="status" className="text-sm font-normal text-slate-600">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved'
                : ''}
          </span>
        </legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 has-checked:border-teal-600 has-checked:bg-teal-50">
          <input
            type="checkbox"
            checked={ticks.formsComplete}
            onChange={(event) => tick('formsComplete', event.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span>I've filled in my visit forms</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 has-checked:border-teal-600 has-checked:bg-teal-50">
          <input
            type="checkbox"
            checked={ticks.medicalHistoryReviewed}
            onChange={(event) =>
              tick('medicalHistoryReviewed', event.target.checked)
            }
            aria-describedby={`${ids}-history-hint`}
            className="mt-1 size-5 shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <span>I've reviewed my health history</span>
            <span id={`${ids}-history-hint`} className="text-sm text-slate-600">
              Medicines, allergies, and anything that's changed
            </span>
          </span>
        </label>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          // aria-disabled (not disabled) keeps focus on the button while saving
          aria-disabled={update.isPending}
          onClick={imHere}
          className="h-14 rounded-xl bg-teal-700 px-5 text-lg font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
        >
          I'm here
        </button>
        <p className="text-center text-sm text-slate-600">
          Tap when you're at the office. The front desk will see you've arrived.
        </p>
      </div>
    </>,
  )
}
