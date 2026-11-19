import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { MyAccount } from '../../api/patientPortal'
import { ApiError } from '../../api/schedule'
import { FORGOT_PASSWORD_PATH, PATIENT_SIGN_UP_PATH } from '../../lib/route'
import { usePatientSession } from '../../hooks/usePatientSession'
import { PatientShell } from './PatientShell'

export type PatientSession = {
  token: string
  account: MyAccount
  signOut: () => void
  // True when this view replaced the sign-in form (the patient just signed
  // in): the view moves focus to its heading. False on a page load.
  justSignedIn: boolean
}

type RequirePatientProps = {
  subtitle: string
  practiceName?: string // shown on the sign-in step, when the page knows it
  heading: string // the sign-in step's heading, e.g. "Sign in to check in"
  intro: string
  children: (session: PatientSession) => ReactNode
  // Set when this page replaced another view in place (sign-up, then
  // "Your visits"), so the page moves focus to its heading.
  arrivedSignedIn?: boolean
}

// Puts a patient page behind the patient sign-in. Signed out, it shows the
// sign-in form and nothing of the page; signed in, it renders the page with
// the account the server returned for this patient's token. What a page
// can show is limited to that account, so a patient never sees anyone
// else's visits, whatever link they open.
export function RequirePatient({
  subtitle,
  practiceName,
  heading,
  intro,
  children,
  arrivedSignedIn = false,
}: RequirePatientProps) {
  const session = usePatientSession()
  const { token, account } = session
  const [justSignedIn, setJustSignedIn] = useState(arrivedSignedIn)
  const [justSignedOut, setJustSignedOut] = useState(false)
  const signInHeadingRef = useRef<HTMLHeadingElement>(null)

  // After signing out here, start screen readers at the sign-in heading.
  useEffect(() => {
    if (justSignedOut && token === null) signInHeadingRef.current?.focus()
  }, [justSignedOut, token])

  if (token === null) {
    return (
      <PatientShell practiceName={practiceName} subtitle={subtitle}>
        <PatientSignInForm
          heading={heading}
          intro={intro}
          headingRef={signInHeadingRef}
          notice={session.sessionEnded ? 'Please sign in again.' : null}
          pending={session.signIn.isPending}
          error={
            session.signIn.error
              ? session.signIn.error instanceof ApiError &&
                session.signIn.error.status === 401
                ? session.signIn.error.message
                : "We couldn't sign you in. Please try again."
              : null
          }
          onSubmit={(email, password) => {
            session.signIn.mutate(
              { email, password },
              {
                onSuccess: () => {
                  setJustSignedIn(true)
                  setJustSignedOut(false)
                },
              },
            )
          }}
        />
      </PatientShell>
    )
  }

  if (account.isPending) {
    return (
      <PatientShell practiceName={practiceName} subtitle={subtitle}>
        <p role="status" className="text-slate-600">
          Loading…
        </p>
      </PatientShell>
    )
  }

  if (account.isError) {
    return (
      <PatientShell practiceName={practiceName} subtitle={subtitle}>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn't load your visits
        </h1>
        <p className="text-slate-700">{account.error.message}</p>
        <button
          type="button"
          onClick={() => account.refetch()}
          className="h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium"
        >
          Try again
        </button>
      </PatientShell>
    )
  }

  return children({
    token,
    account: account.data,
    signOut: () => {
      setJustSignedIn(false)
      setJustSignedOut(true)
      session.signOut()
    },
    justSignedIn,
  })
}

type PatientSignInFormProps = {
  heading: string
  intro: string
  headingRef: React.Ref<HTMLHeadingElement>
  notice: string | null
  pending: boolean
  error: string | null
  onSubmit: (email: string, password: string) => void
}

function PatientSignInForm({
  heading,
  intro,
  headingRef,
  notice,
  pending,
  error,
  onSubmit,
}: PatientSignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const ids = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    onSubmit(email, password)
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          {heading}
        </h1>
        <p className="text-slate-700">{intro}</p>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800"
        >
          {notice}
        </p>
      )}

      <form
        onSubmit={submit}
        className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-email`} className="font-medium">
            Email
          </label>
          <input
            id={`${ids}-email`}
            type="email"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-xl border border-slate-400 bg-white px-3 text-base"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-password`} className="font-medium">
            Password
          </label>
          <input
            id={`${ids}-password`}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-xl border border-slate-400 bg-white px-3 text-base"
          />
          {/* After the field, so Tab goes email, password, then this. */}
          <a
            href={FORGOT_PASSWORD_PATH}
            className="self-start text-sm font-medium text-teal-800 underline underline-offset-2"
          >
            Forgot password?
          </a>
        </div>

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
          aria-disabled={pending}
          className="h-12 rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
        >
          Sign in
        </button>
      </form>

      <p className="text-slate-700">
        New patient?{' '}
        <a
          href={PATIENT_SIGN_UP_PATH}
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Create an account
        </a>
      </p>

      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
        Demo login: <span className="font-medium">owen.hart@example.com</span>,
        password <span className="font-medium">demo1234</span>. Every made-up
        patient has one; the README lists more.
      </p>
    </>
  )
}
