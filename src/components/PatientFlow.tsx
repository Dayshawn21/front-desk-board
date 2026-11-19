import { roleLabel, typeLabel } from '../lib/display'
import { findConflicts } from '../lib/overlap'
import { formatTime, formatTimeRange } from '../lib/time'
import {
  type FlowColumnId,
  flowColumns,
  groupByFlow,
  minutesLate,
  nextAction,
} from '../lib/workflow'
import { useSession } from '../session/SessionContext'
import type { AppointmentStatus, ScheduleDay } from '../types'
import { LateNote } from './LateNote'

// Full class strings so Tailwind can find them (see display.ts).
const dotClass: Record<FlowColumnId, string> = {
  expected: 'bg-slate-500',
  arrived: 'bg-amber-500',
  'in-chair': 'bg-violet-600',
  'checked-out': 'bg-green-600',
}

type PatientFlowProps = {
  day: ScheduleDay
  now: string // the demo clock, for late visits
  savingId: string | null
  onOpen: (id: string) => void
  onAdvance: (id: string, status: AppointmentStatus) => void
}

export function PatientFlow({
  day,
  now,
  savingId,
  onOpen,
  onAdvance,
}: PatientFlowProps) {
  const { role, can } = useSession()
  const groups = groupByFlow(day.appointments)
  const conflicts = findConflicts(day.appointments)
  const patientsById = new Map(day.patients.map((p) => [p.id, p]))
  const chairsById = new Map(day.chairs.map((c) => [c.id, c]))

  // No-shows leave the columns (they're not coming); list them below so the
  // desk can follow up.
  const noShows = day.appointments
    .filter((a) => a.status === 'no-show')
    .sort((a, b) => a.start.localeCompare(b.start))
  const patientName = (id: string) => {
    const p = patientsById.get(id)
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown patient'
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {flowColumns.map((column) => {
          const items = groups[column.id]
          const headingId = `flow-${column.id}`
          return (
            <section
              key={column.id}
              aria-labelledby={headingId}
              className="flex flex-col gap-3 rounded-xl bg-slate-100 p-3"
            >
              <h2
                id={headingId}
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${dotClass[column.id]}`}
                />
                {column.label}
                <span className="ml-auto rounded-full bg-white px-2 text-xs font-semibold text-slate-700">
                  {items.length}
                  <span className="sr-only">
                    {items.length === 1 ? ' visit' : ' visits'}
                  </span>
                </span>
              </h2>

              {items.length === 0 ? (
                <p className="px-1 text-sm text-slate-600">
                  No one here right now.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((appt) => {
                    const patient = patientsById.get(appt.patientId)
                    const name = patient
                      ? `${patient.firstName} ${patient.lastName}`
                      : 'Unknown patient'
                    const chair =
                      chairsById.get(appt.chairId)?.name ?? 'Unknown chair'
                    const hasConflict = conflicts.has(appt.id)
                    const done = Object.values(appt.checklist).filter(
                      Boolean,
                    ).length
                    const action = nextAction(appt.status)
                    const saving = savingId === appt.id
                    const late = minutesLate(appt, now)

                    return (
                      <li key={appt.id}>
                        <article
                          className={`flex flex-col gap-2 rounded-lg border bg-white p-3 ${hasConflict ? 'border-red-600 ring-1 ring-red-600' : 'border-slate-200'}`}
                        >
                          <div className="flex items-baseline gap-2">
                            <h3 className="flex-1 text-sm font-semibold">
                              {/* Opens the check-in drawer; focus returns here on close. */}
                              <button
                                type="button"
                                onClick={() => onOpen(appt.id)}
                                className="text-left underline-offset-2 hover:underline"
                              >
                                {name}
                              </button>
                            </h3>
                            <span className="text-xs text-slate-700 tabular-nums">
                              {formatTimeRange(appt.start, appt.end)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">
                            {typeLabel[appt.type]} · {chair}
                            {appt.status === 'scheduled'
                              ? ' · Not confirmed yet'
                              : ''}
                          </p>
                          {late && <LateNote minutes={late} />}
                          {hasConflict && (
                            <p className="text-xs font-semibold text-red-700">
                              Overlaps another visit
                            </p>
                          )}
                          <p className="text-xs text-slate-700">
                            Checklist {done} of 4
                          </p>
                          {action && !can(action.permission) && (
                            <p className="text-xs text-slate-600">
                              Next: {action.label} (not available to{' '}
                              {roleLabel[role]})
                            </p>
                          )}
                          {action && can(action.permission) && (
                            <button
                              type="button"
                              // The visible label repeats on every card, so the accessible
                              // name adds the patient: "Check in Lena Ortiz".
                              aria-label={
                                saving
                                  ? `Saving ${name}`
                                  : `${action.label} ${name}`
                              }
                              aria-disabled={saving}
                              onClick={() => {
                                if (!saving) onAdvance(appt.id, action.status)
                              }}
                              className="h-11 rounded-lg border border-teal-700 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 aria-disabled:opacity-60"
                            >
                              {saving ? 'Saving…' : action.label}
                            </button>
                          )}
                        </article>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      {noShows.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">No-shows today:</span>{' '}
          {noShows
            .map((a) => `${patientName(a.patientId)} (${formatTime(a.start)})`)
            .join(', ')}
        </p>
      )}
    </div>
  )
}
