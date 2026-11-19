import { statusStyle, typeLabel } from '../lib/display'
import { assignLanes } from '../lib/lanes'
import { findConflicts } from '../lib/overlap'
import { formatTime, toClock, toMinutes } from '../lib/time'
import type { ScheduleDay } from '../types'

const SLOT_MINUTES = 15
const ROW_PX = 32
const HEADER_PX = 40

type ScheduleGridProps = {
  day: ScheduleDay
  now?: string
  onSelectAppointment?: (id: string) => void
  // When set, empty future spots can be clicked to start a booking there.
  onSelectSlot?: (chairId: string, time: string) => void
}

export function ScheduleGrid({
  day,
  now,
  onSelectAppointment,
  onSelectSlot,
}: ScheduleGridProps) {
  const open = toMinutes(day.practice.openTime)
  const close = toMinutes(day.practice.closeTime)
  const slotCount = (close - open) / SLOT_MINUTES

  // CSS grid lines start at 1, and row 1 is the chair header, so slot 0 is row 2.
  const rowFor = (minutes: number) => (minutes - open) / SLOT_MINUTES + 2

  const patientsById = new Map(day.patients.map((p) => [p.id, p]))
  const chairsById = new Map(day.chairs.map((c) => [c.id, c]))
  const columnByChair = new Map(day.chairs.map((c, i) => [c.id, i + 2]))
  const apptsById = new Map(day.appointments.map((a) => [a.id, a]))

  // Cancelled visits leave the grid so their time shows as open; they're
  // listed above it instead. (The record still exists.)
  const active = day.appointments.filter((a) => a.status !== 'cancelled')
  const cancelled = day.appointments.filter((a) => a.status === 'cancelled')

  const conflicts = findConflicts(active)
  const lanes = assignLanes(active)

  const patientName = (patientId: string) => {
    const p = patientsById.get(patientId)
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown patient'
  }

  // One line per conflicting pair (skip the mirror entry B→A).
  const conflictLines = [...conflicts.entries()].flatMap(([id, others]) =>
    others
      .filter((otherId) => id < otherId)
      .map((otherId) => {
        const a = apptsById.get(id)!
        const b = apptsById.get(otherId)!
        const chair = chairsById.get(a.chairId)?.name ?? 'Unknown chair'
        return `${chair}: ${patientName(a.patientId)} (${formatTime(a.start)}–${formatTime(a.end)}) overlaps ${patientName(b.patientId)} (${formatTime(b.start)}–${formatTime(b.end)})`
      }),
  )

  const nowMinutes = now ? toMinutes(now) : null
  const showNow =
    nowMinutes !== null && nowMinutes >= open && nowMinutes <= close

  return (
    <div className="flex flex-col gap-3">
      {conflictLines.length > 0 && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">
            {conflictLines.length === 1
              ? '1 scheduling conflict'
              : `${conflictLines.length} scheduling conflicts`}
          </p>
          {conflictLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}

      {cancelled.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-700">Cancelled today:</span>{' '}
          {cancelled
            .map((a) => `${patientName(a.patientId)} (${formatTime(a.start)})`)
            .join(', ')}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div
          className="relative grid min-w-160"
          style={{
            gridTemplateColumns: `64px repeat(${day.chairs.length}, minmax(160px, 1fr))`,
            gridTemplateRows: `${HEADER_PX}px repeat(${slotCount}, ${ROW_PX}px)`,
          }}
        >
          {/* Chair headers + vertical lane lines */}
          {day.chairs.map((chair, i) => (
            <div key={chair.id} className="contents">
              <div
                className="flex flex-col justify-center border-b border-l border-slate-200 px-2"
                style={{ gridColumn: i + 2, gridRow: 1 }}
              >
                <span className="text-sm font-semibold">{chair.name}</span>
                <span className="text-xs text-slate-600">{chair.provider}</span>
              </div>
              <div
                aria-hidden="true"
                className="border-l border-slate-200"
                style={{ gridColumn: i + 2, gridRow: '2 / -1' }}
              />
            </div>
          ))}

          {/* Horizontal slot lines + time labels */}
          {Array.from({ length: slotCount }, (_, i) => {
            const minutes = open + i * SLOT_MINUTES
            return (
              <div key={minutes} className="contents">
                <div
                  aria-hidden="true"
                  className={
                    minutes % 60 === 0
                      ? 'border-t border-slate-200'
                      : 'border-t border-slate-100'
                  }
                  style={{ gridColumn: '1 / -1', gridRow: i + 2 }}
                />
                <div
                  className="pt-0.5 pr-2 text-right text-xs text-slate-600 tabular-nums"
                  style={{ gridColumn: 1, gridRow: i + 2 }}
                >
                  {minutes % 30 === 0 ? formatTime(minutes) : ''}
                </div>
              </div>
            )
          })}

          {/* Click targets for booking. Mouse and touch only: they're hidden
              from screen readers and not in the Tab order (100+ stops would
              bury the visits). Keyboard users book with "New appointment".
              Cards render after these, so a visit always wins the click. */}
          {onSelectSlot &&
            day.chairs.flatMap((chair, c) =>
              Array.from({ length: slotCount }, (_, i) => {
                const minutes = open + i * SLOT_MINUTES
                if (nowMinutes !== null && minutes < nowMinutes) return null
                const time = toClock(minutes)
                return (
                  <div
                    key={`${chair.id}-${time}`}
                    data-testid={`slot-${chair.id}-${time}`}
                    aria-hidden="true"
                    onClick={() => onSelectSlot(chair.id, time)}
                    className="group cursor-pointer hover:bg-teal-50"
                    style={{ gridColumn: c + 2, gridRow: i + 2 }}
                  >
                    <span className="hidden px-2 text-[11px] leading-8 font-medium text-teal-800 group-hover:block">
                      + Book {formatTime(minutes)}
                    </span>
                  </div>
                )
              }),
            )}

          {/* Appointment cards */}
          {active.map((appt) => {
            const patient = patientsById.get(appt.patientId)
            const column = columnByChair.get(appt.chairId)
            if (!patient || !column) return null // skip rows that point at missing data

            const status = statusStyle[appt.status]
            const start = toMinutes(appt.start)
            const end = toMinutes(appt.end)
            const name = `${patient.firstName} ${patient.lastName}`
            const hasConflict = conflicts.has(appt.id)
            const { lane, laneCount } = lanes.get(appt.id) ?? {
              lane: 0,
              laneCount: 1,
            }

            return (
              <button
                onClick={() => onSelectAppointment?.(appt.id)}
                key={appt.id}
                type="button"
                // Same words, same order as the visible card (WCAG 2.5.3,
                // Label in Name), so voice control users can say what they
                // see. axe checks this in e2e/a11y.e2e.ts.
                aria-label={`${name}, ${status.label}, ${typeLabel[appt.type]}, ${formatTime(start)} to ${formatTime(end)}${hasConflict ? ', Overlaps another appointment' : ''}`}
                className={`relative z-10 my-0.5 flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg border px-2 py-1 text-left ${status.card} ${hasConflict ? 'ring-2 ring-red-600' : ''}`}
                style={{
                  gridColumn: column,
                  gridRow: `${rowFor(start)} / ${rowFor(end)}`,
                  justifySelf: 'start',
                  width: `calc(${100 / laneCount}% - 4px)`,
                  marginLeft: `calc(${(100 * lane) / laneCount}% + 2px)`,
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">
                    {name}
                  </span>{' '}
                  <span
                    className={`ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-semibold ${status.pill}`}
                  >
                    {status.label}
                  </span>
                </span>{' '}
                <span className="truncate text-xs text-slate-700">
                  {typeLabel[appt.type]} · {formatTime(start)} to{' '}
                  {formatTime(end)}
                </span>{' '}
                {hasConflict && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                      <path d="M12 9v4" />
                    </svg>
                    Overlaps
                  </span>
                )}
              </button>
            )
          })}

          {/* "Now" line */}
          {showNow && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 left-14 z-0 h-0.5 bg-teal-700"
              style={{
                top: HEADER_PX + ((nowMinutes - open) / SLOT_MINUTES) * ROW_PX,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
