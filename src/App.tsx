import { useEffect, useRef, useState } from 'react'
import { CheckInDrawer } from './components/CheckInDrawer'
import { PatientFlow } from './components/PatientFlow'
import { SignInPage } from './components/SignInPage'
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
import { useAuth, useSession } from './session/SessionContext'
import type { AppointmentStatus } from './types'

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

// Signed out: the sign-in page. Signed in: the board, keyed by user so a
// new sign-in starts with fresh screen state (no drawer or toast left over).
function App() {
  const { user } = useAuth()
  return user ? <Board key={user.id} /> : <SignInPage />
}

function Board() {
  const { user, practiceId, setPracticeId, signOut, can } = useSession()
  const headingRef = useRef<HTMLHeadingElement>(null)
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

  // Same as the sign-in page: after the page swaps, focus starts at its heading.
  useEffect(() => headingRef.current?.focus(), [])

  const practiceName =
    practices.data?.find((p) => p.id === practiceId)?.name ?? ''

  const toastText = lastChange
    ? lastChange.kind === 'forward'
      ? `${lastChange.name}: ${statusStyle[lastChange.to].label}`
      : `${lastChange.name}: moved back to ${statusStyle[lastChange.to].label}`
    : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        inert={Boolean(selected)}
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"
      >
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold outline-none"
          >
            Front Desk Board
          </h1>
          <p className="text-sm text-slate-600">
            Tuesday, Nov 17 · Demo data only, no real patients
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* Only the office manager can switch, so only they get a control.
              Everyone else sees their practice as plain text. */}
          {can('switch-practice') ? (
            <label className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
              Practice
              <select
                value={practiceId}
                onChange={(e) => {
                  setSelectedId(null) // never keep one practice's drawer open on another
                  setLastChange(null)
                  update.reset()
                  setPracticeId(e.target.value)
                }}
                disabled={!practices.data}
                className="h-11 min-w-52 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
              >
                {practices.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-slate-600">
                Practice
              </span>
              <span className="text-sm font-medium text-slate-900">
                {practiceName}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 sm:border-l sm:border-slate-200 sm:pl-5">
            <div
              role="group"
              aria-label="Signed in as"
              className="flex flex-col gap-0.5"
            >
              <span className="text-sm font-medium text-slate-900">
                {user.name}
              </span>
              <span className="text-xs text-slate-600">
                {roleLabel[user.role]}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium whitespace-nowrap text-slate-900 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
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
