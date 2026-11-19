import { usePractices } from '../../hooks/useSchedule'
import {
  bookingPath,
  PATIENT_SIGN_IN_PATH,
  patientHomePath,
} from '../../lib/route'
import { formatTimeRange } from '../../lib/time'
import { PatientShell } from './PatientShell'

// The patient picks their dental office first: at /book to book there, at
// /patient to sign in there. Each office is a plain link to that page, so
// it can be opened in a new tab or shared like any other link.
const PURPOSES = {
  book: {
    subtitle: 'Online booking',
    intro: 'Pick the office you visit, then choose a time today.',
    path: bookingPath,
  },
  'sign-in': {
    subtitle: 'Patient sign-in',
    intro: 'Pick the office you visit, then sign in.',
    path: patientHomePath,
  },
}

export function ChoosePracticePage({
  purpose,
}: {
  purpose: keyof typeof PURPOSES
}) {
  const practices = usePractices()
  const { subtitle: SUBTITLE, intro, path } = PURPOSES[purpose]

  if (practices.isPending) {
    return (
      <PatientShell subtitle={SUBTITLE}>
        <p role="status" className="text-slate-600">
          Loading dental offices…
        </p>
      </PatientShell>
    )
  }

  if (practices.isError) {
    return (
      <PatientShell subtitle={SUBTITLE}>
        <h1 className="text-2xl font-semibold tracking-tight">
          We couldn't load the dental offices
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

  return (
    <PatientShell subtitle={SUBTITLE}>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">
          Choose your dental office
        </h1>
        <p className="text-slate-700">{intro}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {practices.data.map((practice) => (
          <li key={practice.id}>
            <a
              href={path(practice.id)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-600 hover:bg-teal-50"
            >
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-lg font-semibold text-slate-900">
                  {practice.name}
                </span>{' '}
                <span className="text-slate-700">
                  Open today{' '}
                  {formatTimeRange(practice.openTime, practice.closeTime)}
                </span>
              </span>
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-slate-500"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
      {purpose === 'book' && (
        <p className="text-slate-700">
          Already booked?{' '}
          <a
            href={PATIENT_SIGN_IN_PATH}
            className="font-medium text-teal-800 underline underline-offset-2"
          >
            Sign in to see your visits
          </a>{' '}
          and check in when you arrive.
        </p>
      )}
    </PatientShell>
  )
}
