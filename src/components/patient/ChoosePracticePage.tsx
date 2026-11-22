import { usePractices } from '../../hooks/useSchedule'
import { bookingPath, PATIENT_HOME_PATH } from '../../lib/route'
import { formatTimeRange } from '../../lib/time'
import { OFFICE_COUNT } from './offices'
import { PatientShell } from './PatientShell'

const SUBTITLE = 'Online booking'

// /book: the patient picks their dental office first, then books there.
// Each office is a plain link to its booking page, so it can be opened in
// a new tab or shared like any other link.
export function ChoosePracticePage() {
  const practices = usePractices()

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
        <p className="text-slate-700">
          Pick the office you visit, then choose a time today.
        </p>
      </div>
      {practices.isPending ? (
        <>
          <p role="status" className="sr-only">
            Loading dental offices…
          </p>
          {/* One card per office, sized like the real ones, so nothing
              below the list moves when the offices arrive (Lighthouse
              counted that jump against the page). */}
          <div
            aria-hidden="true"
            data-testid="office-placeholders"
            className="flex flex-col gap-3"
          >
            {Array.from({ length: OFFICE_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-0.5 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="text-lg">&nbsp;</span>
                <span>&nbsp;</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <ul className="flex flex-col gap-3">
          {practices.data.map((practice) => (
            <li key={practice.id}>
              <a
                href={bookingPath(practice.id)}
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
      )}
      <p className="text-slate-700">
        Already booked?{' '}
        <a
          href={PATIENT_HOME_PATH}
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Sign in to see your visits
        </a>{' '}
        and check in when you arrive.
      </p>
    </PatientShell>
  )
}
