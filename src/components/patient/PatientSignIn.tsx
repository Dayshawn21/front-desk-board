import type { Ref } from 'react'
import { initials } from '../../lib/display'
import type { Patient } from '../../types'

type PatientSignInProps = {
  heading: string // "Sign in", or "Sign in to book"
  intro: string // what happens after signing in
  patients: Patient[] // this practice's patients
  onSignIn: (patientId: string) => void
  headingRef?: Ref<HTMLHeadingElement>
}

// The demo patient sign-in: pick one of the practice's made-up patients.
// It says so plainly; a real page would never list patients, and would
// sign the patient in with a password or a code texted to their phone.
export function PatientSignIn({
  heading,
  intro,
  patients,
  onSignIn,
  headingRef,
}: PatientSignInProps) {
  const sorted = [...patients].sort(
    (a, b) =>
      a.firstName.localeCompare(b.firstName) ||
      a.lastName.localeCompare(b.lastName),
  )
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
        <p className="text-sm text-slate-600">
          Demo sign-in: pick one of the practice's made-up patients. No
          password; a real page would send a code to your phone.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sorted.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSignIn(p.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-teal-600 hover:bg-teal-50"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800"
              >
                {initials(`${p.firstName} ${p.lastName}`)}
              </span>
              <span className="font-medium">
                {p.firstName} {p.lastName}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
