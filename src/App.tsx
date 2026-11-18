import { useState } from 'react'
import { CheckInDrawer } from './components/CheckInDrawer'
import { PatientFlow } from './components/PatientFlow'
import { ScheduleGrid } from './components/ScheduleGrid'
import { UndoToast } from './components/UndoToast'
import { type ViewId, ViewTabs } from './components/ViewTabs'
import { DEMO_DATE, DEMO_NOW } from './config'
import {
  usePractices,
  useSchedule,
  useUpdateAppointment,
} from './hooks/useSchedule'
import { roleLabel, statusStyle } from './lib/display'
import { previousAction } from './lib/workflow'
import { useSession } from './session/SessionContext'
import type { AppointmentStatus, Role } from './types'

const roles = Object.keys(roleLabel) as Role[]

// The most recent status change, kept so the toast can offer to undo it.
type StatusChange = {
  key: number
  appointmentId: string
  name: string
  from: AppointmentStatus
  to: AppointmentStatus
  kind: 'forward' | 'undo'
}

let changeCounter = 0

function App() {
  const { practiceId, setPracticeId, role, setRole, can } = useSession()
  const [view, setView] = useState<ViewId>('schedule')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastChange, setLastChange] = useState<StatusChange | null>(null)
  const practices = usePractices()
  const schedule = useSchedule(practiceId, DEMO_DATE)
  const update = useUpdateAppointment(practiceId, DEMO_DATE)

  // Read the selected appointment from the query, not a copy in state,
  // so the drawer shows fresh data after every save.
  const selected = schedule.data?.appointments.find((a) => a.id === selectedId)

  // Which card is saving right now (for the flow board's buttons).
  const savingId = update.isPending ? (update.variables?.id ?? null) : null

  const openDrawer = (id: string) => {
    update.reset() // clear any error left over from an earlier save
    setSelectedId(id)
  }

  // Every status change (drawer, board, or the toast's Undo) goes through here,
  // so each one gets a toast and can be undone the same way.
  const changeStatus = (id: string, to: AppointmentStatus) => {
    const appt = schedule.data?.appointments.find((a) => a.id === id)
    if (!appt) return
    const patient = schedule.data?.patients.find((p) => p.id === appt.patientId)
    const name = patient ? `${patient.firstName} ${patient.lastName}` : 'Visit'
    const from = appt.status
    const kind = previousAction(from)?.status === to ? 'undo' : 'forward'

    update.mutate(
      { id, patch: { status: to } },
      {
        onSuccess: () => {
          changeCounter += 1
          setLastChange({
            key: changeCounter,
            appointmentId: id,
            name,
            from,
            to,
            kind,
          })
        },
      },
    )
  }

  // Offer Undo only for a forward step the current role is allowed to reverse.
  // (Front desk can check a patient out, but only the office manager can reopen.)
  const undoStep =
    lastChange?.kind === 'forward' ? previousAction(lastChange.to) : null
  const canUndoLast =
    lastChange !== null &&
    undoStep !== null &&
    undoStep.status === lastChange.from &&
    can(undoStep.permission)

  const toastText = lastChange
    ? lastChange.kind === 'forward'
      ? `${lastChange.name}: ${statusStyle[lastChange.to].label}`
      : `${lastChange.name}: moved back to ${statusStyle[lastChange.to].label}`
    : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        inert={Boolean(selected)}
        className="flex flex-wrap items-start gap-4 border-b border-slate-200 bg-white px-6 py-4"
      >
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Front Desk Board</h1>
          <p className="text-sm text-slate-600">
            Tuesday, Nov 17 · Demo data only, no real patients
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Practice
            <select
              value={practiceId}
              onChange={(e) => {
                setSelectedId(null) // never keep one practice's drawer open on another
                setLastChange(null)
                update.reset()
                setPracticeId(e.target.value)
              }}
              disabled={!practices.data || !can('switch-practice')}
              aria-describedby={
                can('switch-practice') ? undefined : 'practice-locked'
              }
              className="h-11 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100"
            >
              {practices.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {!can('switch-practice') && (
            <p id="practice-locked" className="text-xs text-slate-600">
              Only the office manager can switch practices.
            </p>
          )}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Acting as (demo)
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-11 min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* inert: while the drawer is open, nothing behind it can be focused or clicked */}
      <main inert={Boolean(selected)} className="p-6">
        <ViewTabs value={view} onChange={setView}>
          {schedule.isPending ? (
            <p role="status" className="text-sm text-slate-600">
              Loading schedule…
            </p>
          ) : schedule.isError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <span className="mr-auto">{schedule.error.message}</span>
              <button
                type="button"
                onClick={() => schedule.refetch()}
                className="h-11 rounded-lg border border-red-300 bg-white px-4 font-medium text-red-800"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Errors from saves started on the board (the drawer shows its own). */}
              {update.isError && !selected && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {update.error.message}
                </p>
              )}
              {view === 'schedule' ? (
                <ScheduleGrid
                  day={schedule.data}
                  now={DEMO_NOW}
                  onSelectAppointment={openDrawer}
                />
              ) : (
                <PatientFlow
                  day={schedule.data}
                  savingId={savingId}
                  onOpen={openDrawer}
                  onAdvance={changeStatus}
                />
              )}
            </div>
          )}
        </ViewTabs>
      </main>

      {schedule.data && selected && (
        <CheckInDrawer
          key={selected.id}
          day={schedule.data}
          appointment={selected}
          isSaving={update.isPending}
          saveError={update.error?.message ?? null}
          onSave={(patch) => update.mutate({ id: selected.id, patch })}
          onChangeStatus={(status) => changeStatus(selected.id, status)}
          onClose={() => setSelectedId(null)}
        />
      )}

      <UndoToast
        toast={
          lastChange && toastText
            ? { key: lastChange.key, text: toastText }
            : null
        }
        undo={
          lastChange && canUndoLast && undoStep
            ? {
                label: `${undoStep.label} for ${lastChange.name}`,
                onUndo: () =>
                  changeStatus(lastChange.appointmentId, lastChange.from),
              }
            : undefined
        }
        onDismiss={() => setLastChange(null)}
      />
    </div>
  )
}

export default App
