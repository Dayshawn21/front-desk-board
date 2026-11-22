import { daySummary, formatCents } from '../lib/billing'
import type { ScheduleDay } from '../types'

// The office manager's Today totals for the current practice. "Billed" is
// what patients owe for checked-out visits (their share, after the
// insurance estimate); the plans' part is shown apart, as an estimate,
// because claims aren't built.
export function DayTotals({ day }: { day: ScheduleDay }) {
  const summary = daySummary(day)
  const figures = [
    ['Billed', summary.billedCents],
    ['Collected', summary.collectedCents],
    ['Outstanding', summary.outstandingCents],
  ] as const

  return (
    <section
      aria-labelledby="day-totals-heading"
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-white px-4 py-3"
    >
      <h2 id="day-totals-heading" className="text-sm font-semibold">
        Today's billing
      </h2>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {figures.map(([label, cents]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="text-slate-700">{label}</dt>
            <dd className="font-semibold tabular-nums">{formatCents(cents)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-600">
        {summary.visits} checked out · insurance estimate{' '}
        {formatCents(summary.insuranceEstimateCents)} (claims not sent in this
        demo)
      </p>
    </section>
  )
}
