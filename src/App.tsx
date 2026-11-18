import { useEffect, useRef, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { BookingDrawer } from './components/BookingDrawer'
import { CheckInDrawer } from './components/CheckInDrawer'
import { PatientFlow } from './components/PatientFlow'
import { SignInPage } from './components/SignInPage'
import { ScheduleGrid } from './components/ScheduleGrid'
import { type ToastMessage, UndoToast } from './components/UndoToast'
import { type ViewId, ViewTabs } from './components/ViewTabs'
import type { NewAppointment } from './api/schedule'
import { DEMO_DATE, DEMO_NOW } from './config'
import {
  usePractices,
  useSchedule,
  useCreateAppointment,
  useUpdateAppointment,
} from './hooks/useSchedule'
import { statusStyle, typeLabel } from './lib/display'
import { formatTime } from './lib/time'
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
  // forward: a normal step; undo: one step back; cancel: visit cancelled;
  // restore: a cancel was undone
  kind: 'forward' | 'undo' | 'cancel' | 'restore'
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
  const [isBooking, setIsBooking] = useState(false)
  // Set when booking starts from a spot on the schedule.
  const [bookingStart, setBookingStart] = useState<{
    chairId: string
    time: string
  } | null>(null)
  const newAppointmentRef = useRef<HTMLButtonElement>(null)
  // A plain confirmation with no Undo (e.g. "Booked …").
  const [notice, setNotice] = useState<ToastMessage | null>(null)
  const practices = usePractices()
  const schedule = useSchedule(practiceId, DEMO_DATE)
  const update = useUpdateAppointment(practiceId, DEMO_DATE)
  const create = useCreateAppointment(practiceId, DEMO_DATE)

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
    const kind: StatusChange['kind'] =
      to === 'cancelled'
        ? 'cancel'
        : from === 'cancelled'
          ? 'restore'
          : previousAction(from)?.status === to
            ? 'undo'
            : 'forward'

    update.mutate(
      { id, patch: { status: to } },
      {
        onSuccess: () => {
          changeCounter += 1
          setNotice(null)
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

  // Offer Undo only for a forward step or a cancel the current role is allowed
  // to reverse. (Front desk can check a patient out, but only the office
  // manager can reopen.) Undoing a cancel restores the status it had before.
  const undoStep =
    lastChange?.kind === 'forward'
      ? previousAction(lastChange.to)
      : lastChange?.kind === 'cancel'
        ? {
            label: 'Undo cancel',
            status: lastChange.from,
            permission: 'cancel' as const,
          }
        : null
  const canUndoLast =
    lastChange !== null &&
    undoStep !== null &&
    undoStep.status === lastChange.from &&
    can(undoStep.permission)

  // Same as the sign-in page: after the page swaps, focus starts at its heading.
  useEffect(() => headingRef.current?.focus(), [])

  const practiceName =
    practices.data?.find((p) => p.id === practiceId)?.name ?? ''

  const openBooking = (start: { chairId: string; time: string } | null) => {
    create.reset() // clear an error left over from an earlier attempt
    // A schedule spot can't take focus, so park focus on the New appointment
    // button first: when the panel closes, focus comes back to it.
    if (start) newAppointmentRef.current?.focus()
    setBookingStart(start)
    setIsBooking(true)
  }

  const book = (input: NewAppointment) => {
    create.mutate(input, {
      onSuccess: (appt) => {
        const patient = schedule.data?.patients.find(
          (p) => p.id === appt.patientId,
        )
        const chair = schedule.data?.chairs.find((c) => c.id === appt.chairId)
        const name = patient
          ? `${patient.firstName} ${patient.lastName}`
          : 'Visit'
        changeCounter += 1
        setLastChange(null)
        setNotice({
          key: changeCounter,
          text: `Booked ${name}: ${typeLabel[appt.type]}, ${formatTime(appt.start)}, ${chair?.name ?? ''}`,
        })
        setIsBooking(false)
      },
    })
  }

  // Anything modal open? Then the page behind is inert.
  const modalOpen = Boolean(selected) || isBooking

  const toastText = lastChange
    ? {
        forward: `${lastChange.name}: ${statusStyle[lastChange.to].label}`,
        undo: `${lastChange.name}: moved back to ${statusStyle[lastChange.to].label}`,
        cancel: `${lastChange.name}: cancelled`,
        restore: `${lastChange.name}: restored as ${statusStyle[lastChange.to].label}`,
      }[lastChange.kind]
    : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        inert={modalOpen}
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
                  setNotice(null)
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

          <AccountMenu
            user={user}
            practiceName={practiceName}
            onSignOut={signOut}
          />
        </div>
      </header>

      {/* inert: while a drawer is open, nothing behind it can be focused or clicked */}
      <main inert={modalOpen} className="flex flex-col gap-4 p-6">
        {can('book') && (
          <div className="flex justify-end">
            <button
              type="button"
              ref={newAppointmentRef}
              onClick={() => openBooking(null)}
              disabled={!schedule.data}
              className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              New appointment
            </button>
          </div>
        )}
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
                  onSelectSlot={
                    can('book')
                      ? (chairId, time) => openBooking({ chairId, time })
                      : undefined
                  }
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

      {schedule.data && isBooking && (
        <BookingDrawer
          day={schedule.data}
          now={DEMO_NOW}
          isSaving={create.isPending}
          saveError={create.error?.message ?? null}
          onBook={book}
          onClose={() => setIsBooking(false)}
          initialChairId={bookingStart?.chairId}
          initialFrom={bookingStart?.time}
        />
      )}

      <UndoToast
        toast={
          lastChange && toastText
            ? { key: lastChange.key, text: toastText }
            : notice
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
        onDismiss={() => {
          setLastChange(null)
          setNotice(null)
        }}
      />
    </div>
  )
}

export default App
