import { statusStyle, typeLabel } from '../lib/display'
import { formatTime, toMinutes } from '../lib/time'
import type { ScheduleDay } from '../types'

const SLOT_MINUTES = 15
const ROW_PX = 32
const HEADER_PX = 40

type ScheduleGridProps = {
  day: ScheduleDay
  now?: string
}

export function ScheduleGrid({ day, now }: ScheduleGridProps) {
  const open = toMinutes(day.practice.openTime)
  const close = toMinutes(day.practice.closeTime)
  const slotCount = (close - open) / SLOT_MINUTES

  // CSS grid lines start at 1, and row 1 is the chair header, so slot 0 is row 2.
  const rowFor = (minutes: number) => (minutes - open) / SLOT_MINUTES + 2

  const patientsById = new Map(day.patients.map((p) => [p.id, p]))
  const columnByChair = new Map(day.chairs.map((c, i) => [c.id, i + 2]))

  const nowMinutes = now ? toMinutes(now) : null
  const showNow =
    nowMinutes !== null && nowMinutes >= open && nowMinutes <= close

  return (
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

        {/* Appointment cards */}
        {day.appointments.map((appt) => {
          const patient = patientsById.get(appt.patientId)
          const column = columnByChair.get(appt.chairId)
          if (!patient || !column) return null // skip rows that point at missing data

          const status = statusStyle[appt.status]
          const start = toMinutes(appt.start)
          const end = toMinutes(appt.end)
          const name = `${patient.firstName} ${patient.lastName}`

          return (
            <button
              key={appt.id}
              type="button"
              aria-label={`${name}, ${typeLabel[appt.type]}, ${formatTime(start)} to ${formatTime(end)}, ${status.label}`}
              className={`relative z-10 m-0.5 flex min-w-0 flex-col gap-0.5 overflow-hidden rounded-lg border px-2 py-1 text-left ${status.card}`}
              style={{
                gridColumn: column,
                gridRow: `${rowFor(start)} / ${rowFor(end)}`,
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold">
                  {name}
                </span>
                <span
                  className={`ml-auto shrink-0 rounded-full px-1.5 text-[11px] font-semibold ${status.pill}`}
                >
                  {status.label}
                </span>
              </span>
              <span className="truncate text-xs text-slate-700">
                {typeLabel[appt.type]} · {formatTime(start)}–{formatTime(end)}
              </span>
            </button>
          )
        })}

        {/* "Now" line */}
        {showNow && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-0 left-14 z-20 h-0.5 bg-teal-700"
            style={{
              top: HEADER_PX + ((nowMinutes - open) / SLOT_MINUTES) * ROW_PX,
            }}
          />
        )}
      </div>
    </div>
  )
}
