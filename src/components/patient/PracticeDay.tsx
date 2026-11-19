import type { ReactNode } from 'react'
import { ApiError } from '../../api/schedule'
import { DEMO_DATE } from '../../config'
import { useSchedule } from '../../hooks/useSchedule'
import type { ScheduleDay } from '../../types'
import { PatientShell } from './PatientShell'

type PracticeDayProps = {
  practiceId: string
  subtitle: string
  loadingText: string
  failedText: string // heading when the day can't load, e.g. "We couldn't load open times"
  children: (day: ScheduleDay) => ReactNode
}

// Loads a practice's day for a patient page, with the loading, error, and
// "no such practice" screens those pages share. Renders children once the
// day is here.
export function PracticeDay({
  practiceId,
  subtitle,
  loadingText,
  failedText,
  children,
}: PracticeDayProps) {
  const schedule = useSchedule(practiceId, DEMO_DATE)

  if (schedule.isPending) {
    return (
      <PatientShell subtitle={subtitle}>
        <p role="status" className="text-slate-600">
          {loadingText}
        </p>
      </PatientShell>
    )
  }

  if (schedule.isError) {
    const notFound =
      schedule.error instanceof ApiError && schedule.error.status === 404
    return (
      <PatientShell subtitle={subtitle}>
        <h1 className="text-2xl font-semibold tracking-tight">
          {notFound ? "We couldn't find that practice" : failedText}
        </h1>
        <p className="text-slate-700">
          {notFound
            ? 'Check the link from your dental office, or give them a call.'
            : schedule.error.message}
        </p>
        {!notFound && (
          <button
            type="button"
            onClick={() => schedule.refetch()}
            className="h-12 rounded-xl border border-slate-300 bg-white px-5 font-medium"
          >
            Try again
          </button>
        )}
      </PatientShell>
    )
  }

  return children(schedule.data)
}
