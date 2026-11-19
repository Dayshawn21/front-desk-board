import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useId, useState } from 'react'
import { patientSignUp } from '../../api/patientPortal'
import { ApiError } from '../../api/schedule'
import { usePatientSession } from '../../hooks/usePatientSession'
import { usePractices } from '../../hooks/useSchedule'
import { PATIENT_HOME_PATH } from '../../lib/route'
import { formatTimeRange } from '../../lib/time'
import { rememberPatientToken } from '../../session/patientStorage'
import { PatientHomePage } from './PatientHomePage'
import { PatientShell } from './PatientShell'

const SUBTITLE = 'Create an account'
const INPUT = 'h-12 rounded-xl border border-slate-400 bg-white px-3 text-base'
const LINK = 'font-medium text-teal-800 underline underline-offset-2'

// /patient/sign-up: a new patient creates an account at their office. The
// mock server checks each field, refuses an email that already has an
// account, stores a salted hash of the password, and signs them in; the
// page then becomes "Your visits" (at /patient).
export function PatientSignUpPage() {
  const [signedUp, setSignedUp] = useState(false)
  if (signedUp) return <PatientHomePage arrivedSignedIn />
  return <SignUp onSignedUp={() => setSignedUp(true)} />
}

function SignUp({ onSignedUp }: { onSignedUp: () => void }) {
  const session = usePatientSession()
  const practices = usePractices()
  const signUp = useMutation({ mutationFn: patientSignUp })

  const [practiceId, setPracticeId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const ids = useId()

  // Already signed in: no second account from this tab.
  if (session.token !== null) {
    if (session.account.isPending) {
      return (
        <PatientShell subtitle={SUBTITLE}>
          <p role="status" className="text-slate-600">
            Loading…
          </p>
        </PatientShell>
      )
    }
    if (session.account.data) {
      const { patient, practice } = session.account.data
      return (
        <PatientShell
          practiceName={practice.name}
          subtitle={SUBTITLE}
          signedIn={{ patient, onSignOut: session.signOut }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            You're signed in as {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-slate-700">
            To create another account, sign out first.
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
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (signUp.isPending) return
    signUp.mutate(
      { practiceId, firstName, lastName, phone, email, password },
      {
        onSuccess: ({ token }) => {
          rememberPatientToken(token)
          // The page becomes "Your visits": give it that page's address,
          // so a reload or a shared link lands there.
          window.history.replaceState(null, '', PATIENT_HOME_PATH)
          onSignedUp()
        },
        // Never keep a password around after a failed try.
        onError: () => setPassword(''),
      },
    )
  }

  const error = signUp.error
    ? signUp.error instanceof ApiError && signUp.error.status < 500
      ? signUp.error.message
      : "We couldn't create your account. Please try again."
    : null

  return (
    <PatientShell subtitle={SUBTITLE}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-slate-700">
          Book visits online and check in from your phone. Already have an
          account?{' '}
          <a href={PATIENT_HOME_PATH} className={LINK}>
            Sign in
          </a>
        </p>
      </div>

      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
        This is a demo: please use a made-up name and an @example.com email.
        What you type stays in this browser, and Reset demo data clears it.
      </p>

      <form
        onSubmit={submit}
        className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div
          role="radiogroup"
          aria-labelledby={`${ids}-office`}
          className="flex flex-col gap-2"
        >
          <p id={`${ids}-office`} className="font-medium">
            Your dental office
          </p>
          {practices.isPending && (
            <p role="status" className="text-slate-600">
              Loading dental offices…
            </p>
          )}
          {practices.isError && (
            <p role="alert" className="text-red-800">
              We couldn't load the dental offices. Please reload the page.
            </p>
          )}
          {practices.data?.map((p) => (
            <label
              key={p.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 has-checked:border-teal-600 has-checked:bg-teal-50"
            >
              <input
                type="radio"
                name="office"
                value={p.id}
                required
                checked={practiceId === p.id}
                onChange={() => setPracticeId(p.id)}
                className="mt-1 size-4 shrink-0"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{p.name}</span>
                <span className="text-sm text-slate-600">
                  Open today {formatTimeRange(p.openTime, p.closeTime)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${ids}-first`} label="First name">
            <input
              id={`${ids}-first`}
              autoComplete="given-name"
              required
              maxLength={50}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field id={`${ids}-last`} label="Last name">
            <input
              id={`${ids}-last`}
              autoComplete="family-name"
              required
              maxLength={50}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className={INPUT}
            />
          </Field>
        </div>
        <Field id={`${ids}-phone`} label="Phone">
          <input
            id={`${ids}-phone`}
            type="tel"
            autoComplete="tel"
            required
            maxLength={30}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field id={`${ids}-email`} label="Email">
          <input
            id={`${ids}-email`}
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field id={`${ids}-password`} label="Password">
          <input
            id={`${ids}-password`}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby={`${ids}-password-hint`}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={INPUT}
          />
          <p id={`${ids}-password-hint`} className="text-sm text-slate-600">
            At least 8 characters.
          </p>
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          // aria-disabled (not disabled) keeps focus on the button while sending
          aria-disabled={signUp.isPending}
          className="h-12 rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
        >
          Create account
        </button>
      </form>
    </PatientShell>
  )
}

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
