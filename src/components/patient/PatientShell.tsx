import type { ReactNode } from 'react'
import { BrandMark } from '../BrandMark'

type PatientShellProps = {
  practiceName?: string // unknown while loading, or for a bad link
  subtitle: string // what this page is, e.g. "Online booking"
  children: ReactNode
}

// The frame around every patient-facing page: the practice's name at the
// top, one narrow column (phones first), and a footer that says it's a demo.
// Calmer than the staff board: no header tools, no dense grid.
export function PatientShell({
  practiceName,
  subtitle,
  children,
}: PatientShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <BrandMark size={36} />
          <div>
            <p className="leading-tight font-semibold tracking-tight">
              {practiceName ?? 'Front Desk Board'}
            </p>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-6 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto max-w-xl px-4 pb-10 text-sm text-slate-600">
        A Front Desk Board demo. The practice and its patients are made up.{' '}
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
