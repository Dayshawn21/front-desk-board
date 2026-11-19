import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { changeMyPassword } from '../../api/patientPortal'
import { ApiError } from '../../api/schedule'
import { FORGOT_PASSWORD_PATH, PATIENT_HOME_PATH } from '../../lib/route'
import { PatientShell } from './PatientShell'
import { type PatientSession, RequirePatient } from './RequirePatient'

const SUBTITLE = 'Your account'
const INPUT = 'h-12 rounded-xl border border-slate-400 bg-white px-3 text-base'
const LINK = 'font-medium text-teal-800 underline underline-offset-2'
const PRIMARY =
  'flex h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60'

// /patient/change-password: a signed-in patient changes their password.
// They give the current one too, so someone holding an unlocked phone
// can't take the account over. Other sessions end; this one stays.
export function ChangePasswordPage() {
  return (
    <RequirePatient
      subtitle={SUBTITLE}
      heading="Sign in to change your password"
      intro="Then choose a new one."
    >
      {(session) => <ChangePassword session={session} />}
    </RequirePatient>
  )
}

function ChangePassword({ session }: { session: PatientSession }) {
  const { token, account, signOut, justSignedIn } = session
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const change = useMutation({
    mutationFn: () => changeMyPassword(token, current, next),
  })

  const formHeadingRef = useRef<HTMLHeadingElement>(null)
  const doneHeadingRef = useRef<HTMLHeadingElement>(null)
  const ids = useId()

  // Focus the heading that replaced the page: after signing in here, and
  // after the change is saved.
  useEffect(() => {
    if (justSignedIn) formHeadingRef.current?.focus()
  }, [justSignedIn])
  useEffect(() => {
    if (change.isSuccess) doneHeadingRef.current?.focus()
  }, [change.isSuccess])

  const shell = (children: React.ReactNode) => (
    <PatientShell
      practiceName={account.practice.name}
      subtitle={SUBTITLE}
      signedIn={{ patient: account.patient, onSignOut: signOut }}
    >
      {children}
    </PatientShell>
  )

  if (change.isSuccess) {
    return shell(
      <>
        <h1
          ref={doneHeadingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Password changed
        </h1>
        <p className="text-slate-700">
          Use it next time you sign in. Anywhere else you were signed in, you've
          been signed out.
        </p>
        <a href={PATIENT_HOME_PATH} className={PRIMARY}>
          Back to your visits
        </a>
      </>,
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (change.isPending) return
    if (next !== again) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    change.mutate(undefined, {
      // Never keep passwords around after a failed try.
      onError: () => {
        setCurrent('')
        setNext('')
        setAgain('')
      },
    })
  }

  const error = mismatch
    ? "The two new passwords don't match."
    : change.error
      ? change.error instanceof ApiError && change.error.status < 500
        ? change.error.message
        : "We couldn't change your password. Please try again."
      : null
  // Too many wrong tries: the server has locked the form for a while.
  const locked =
    !mismatch && change.error instanceof ApiError && change.error.status === 429

  return shell(
    <>
      <div className="flex flex-col gap-1.5">
        <h1
          ref={formHeadingRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Change your password
        </h1>
        <p className="text-slate-700">
          For {account.patient.email}. Pick one you don't use anywhere else.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        {/* Lets password managers file the new password under the account. */}
        <input
          type="email"
          autoComplete="username"
          value={account.patient.email}
          readOnly
          hidden
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-current`} className="font-medium">
            Current password
          </label>
          <input
            id={`${ids}-current`}
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            className={INPUT}
          />
          <a
            href={FORGOT_PASSWORD_PATH}
            className={`self-start text-sm ${LINK}`}
          >
            Forgot it?
          </a>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-new`} className="font-medium">
            New password
          </label>
          <input
            id={`${ids}-new`}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby={`${ids}-hint`}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            className={INPUT}
          />
          <p id={`${ids}-hint`} className="text-sm text-slate-600">
            At least 8 characters.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-again`} className="font-medium">
            Type it again
          </label>
          <input
            id={`${ids}-again`}
            type="password"
            autoComplete="new-password"
            required
            value={again}
            onChange={(event) => setAgain(event.target.value)}
            className={INPUT}
          />
        </div>
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            <p>{error}</p>
            {locked && (
              <a href={FORGOT_PASSWORD_PATH} className={`self-start ${LINK}`}>
                Reset your password
              </a>
            )}
          </div>
        )}
        <button
          type="submit"
          aria-disabled={change.isPending}
          className={PRIMARY}
        >
          Change password
        </button>
      </form>
      <a href={PATIENT_HOME_PATH} className={LINK}>
        Back to your visits
      </a>
    </>,
  )
}
