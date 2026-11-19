import { useMutation, useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import {
  fetchDemoInbox,
  requestPasswordReset,
  resetPassword,
} from '../../api/patientPortal'
import { ApiError } from '../../api/schedule'
import {
  DEMO_INBOX_PATH,
  FORGOT_PASSWORD_PATH,
  PATIENT_HOME_PATH,
} from '../../lib/route'
import { PatientShell } from './PatientShell'

// Forgot password, in three pages:
//   /patient/forgot-password   ask for a link (the answer never says
//                              whether the email has an account)
//   /patient/demo-inbox        where the demo's "emails" land
//   /patient/reset-password    choose a new password from the link

const INPUT = 'h-12 rounded-xl border border-slate-400 bg-white px-3 text-base'
const LINK = 'font-medium text-teal-800 underline underline-offset-2'
const PRIMARY =
  'flex h-12 items-center justify-center rounded-xl bg-teal-700 px-5 font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60'

// Focus a heading that replaced the page's content, so screen readers say it.
function useFocusWhen(when: boolean) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (when) ref.current?.focus()
  }, [when])
  return ref
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const request = useMutation({ mutationFn: requestPasswordReset })
  const doneRef = useFocusWhen(sentTo !== null)
  const ids = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (request.isPending) return
    const to = email.trim()
    request.mutate(to, { onSuccess: () => setSentTo(to) })
  }

  if (sentTo !== null) {
    return (
      <PatientShell subtitle="Patient sign-in">
        <h1
          ref={doneRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Check your email
        </h1>
        <p className="text-slate-700">
          If an account exists for {sentTo}, we've sent a link to reset your
          password. It works once, for 30 minutes.
        </p>
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-700">
          Demo: there's no real email here. Open the{' '}
          <a href={DEMO_INBOX_PATH} className={LINK}>
            demo inbox
          </a>{' '}
          to see it.
        </p>
        <a href={PATIENT_HOME_PATH} className={LINK}>
          Back to sign in
        </a>
      </PatientShell>
    )
  }

  return (
    <PatientShell subtitle="Patient sign-in">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-slate-700">
          Enter the email you sign in with, and we'll send you a link to choose
          a new password.
        </p>
      </div>
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
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT}
          />
        </div>
        {request.isError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            We couldn't send the link. Please try again.
          </p>
        )}
        <button
          type="submit"
          aria-disabled={request.isPending}
          className={PRIMARY}
        >
          Send reset link
        </button>
      </form>
      <a href={PATIENT_HOME_PATH} className={LINK}>
        Back to sign in
      </a>
    </PatientShell>
  )
}

export function DemoInboxPage() {
  // Under the patient key, so other tabs' changes refetch it.
  const inbox = useQuery({
    queryKey: ['patient', 'demo-inbox'],
    queryFn: fetchDemoInbox,
  })

  return (
    <PatientShell subtitle="Demo inbox">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Demo inbox</h1>
        <p className="text-slate-700">
          There's no real email in this demo. Emails the site would send, like
          password reset links, land here instead. Only this browser sees them,
          and Reset demo data clears them.
        </p>
      </div>

      {inbox.isPending ? (
        <p role="status" className="text-slate-600">
          Loading…
        </p>
      ) : inbox.isError ? (
        <p role="alert" className="text-red-800">
          We couldn't load the inbox. Please reload the page.
        </p>
      ) : inbox.data.length === 0 ? (
        <p className="text-slate-700">No emails yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {inbox.data.map((email) => (
            <EmailCard key={email.id} email={email} />
          ))}
        </div>
      )}

      <a href={PATIENT_HOME_PATH} className={LINK}>
        Back to sign in
      </a>
    </PatientShell>
  )
}

function EmailCard({
  email,
}: {
  email: Awaited<ReturnType<typeof fetchDemoInbox>>[number]
}) {
  const ids = useId()
  const sent = new Date(email.sentAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
  return (
    <article
      aria-labelledby={`${ids}-subject`}
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${ids}-subject`} className="font-semibold">
          {email.subject}
        </h2>
        <p className="text-sm text-slate-600">
          To: {email.to} · {sent}
        </p>
      </div>
      <p className="text-slate-800">{email.body}</p>
      <a href={email.link} className={PRIMARY}>
        Reset your password
      </a>
    </article>
  )
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const reset = useMutation({
    mutationFn: (next: string) => resetPassword(token ?? '', next),
  })
  const doneRef = useFocusWhen(reset.isSuccess)
  const ids = useId()

  if (!token) {
    return (
      <PatientShell subtitle="Patient sign-in">
        <h1 className="text-2xl font-semibold tracking-tight">
          This reset link is incomplete
        </h1>
        <p className="text-slate-700">
          Open the whole link from the email, or ask for a new one.
        </p>
        <a href={FORGOT_PASSWORD_PATH} className={PRIMARY}>
          Ask for a new link
        </a>
      </PatientShell>
    )
  }

  if (reset.isSuccess) {
    return (
      <PatientShell subtitle="Patient sign-in">
        <h1
          ref={doneRef}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none"
        >
          Password changed
        </h1>
        <p className="text-slate-700">
          Sign in with your new password. Anywhere you were signed in before,
          you've been signed out.
        </p>
        <a href={PATIENT_HOME_PATH} className={PRIMARY}>
          Sign in
        </a>
      </PatientShell>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reset.isPending) return
    if (password !== again) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    reset.mutate(password)
  }

  const linkRefused =
    reset.error instanceof ApiError &&
    reset.error.status === 400 &&
    /expired or was already used/.test(reset.error.message)
  const error = mismatch
    ? "The two passwords don't match."
    : reset.error
      ? reset.error instanceof ApiError && reset.error.status < 500
        ? reset.error.message
        : "We couldn't change your password. Please try again."
      : null

  return (
    <PatientShell subtitle="Patient sign-in">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-slate-700">Pick one you don't use anywhere else.</p>
      </div>
      <form
        onSubmit={submit}
        className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      >
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
            {linkRefused && (
              <a href={FORGOT_PASSWORD_PATH} className={LINK}>
                Ask for a new link
              </a>
            )}
          </div>
        )}
        <button
          type="submit"
          aria-disabled={reset.isPending}
          className={PRIMARY}
        >
          Change password
        </button>
      </form>
    </PatientShell>
  )
}
