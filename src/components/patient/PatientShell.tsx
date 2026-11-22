import type { ReactNode } from 'react'
import { PATIENT_HOME_PATH } from '../../lib/route'
import { BrandMark } from '../BrandMark'

type PatientShellProps = {
  practiceName?: string // unknown while loading, or for a bad link
  subtitle: string // what this page is, e.g. "Online booking"
  // The signed-in patient, shown in the header with a way to sign out.
  signedIn?: {
    patient: { firstName: string; lastName: string }
    onSignOut: () => void
  }
  onYourVisits?: boolean // this page is Your visits: no link to itself
  children: ReactNode
}

// The frame around every patient-facing page: the practice's name at the
// top, one narrow column (phones first), and a footer that says it's a demo.
// Calmer than the staff board: no header tools, no dense grid.
export function PatientShell({
  practiceName,
  subtitle,
  signedIn,
  onYourVisits = false,
  children,
}: PatientShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <BrandMark size={36} />
          <div className="min-w-0 flex-1">
            <p className="leading-tight font-semibold tracking-tight">
              {practiceName ?? 'Front Desk Board'}
            </p>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
          {signedIn && (
            <div className="flex shrink-0 items-center gap-3">
              <p className="hidden text-sm text-slate-700 sm:block">
                {signedIn.patient.firstName} {signedIn.patient.lastName}
              </p>
              {/* From any other page (booking, check-in), the way back to
                  today's visits and the bill. */}
              {!onYourVisits && (
                <a
                  href={PATIENT_HOME_PATH}
                  // h-10: a full-size target on a phone, like Sign out.
                  className="flex h-10 items-center px-1 text-sm font-medium text-teal-800 underline underline-offset-2"
                >
                  Your visits
                </a>
              )}
              <button
                type="button"
                onClick={signedIn.onSignOut}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto max-w-xl px-4 pb-10 text-sm text-slate-600">
        A Front Desk Board demo. The practice and its patients are made up.{' '}
        {!signedIn && (
          <>
            <a
              href={PATIENT_HOME_PATH}
              className="font-medium text-teal-800 underline underline-offset-2"
            >
              Patient sign-in
            </a>
            {' · '}
          </>
        )}
        <a
          href="/"
          className="font-medium text-teal-800 underline underline-offset-2"
        >
          Staff sign-in
        </a>
      </footer>
    </div>
  )
}
