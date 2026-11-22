import { useEffect, useRef, useState } from 'react'
import { DEMO_DATE, DEMO_NOW } from '../config'
import { useBooking } from '../hooks/useBooking'
import {
  useCreateAppointment,
  useMoveAppointment,
  usePractices,
  useRecordPayment,
  useResetDemoData,
  useSchedule,
  useUpdateAppointment,
  useVoidPayment,
} from '../hooks/useSchedule'
import { useMoves } from '../hooks/useMoves'
import { usePayments } from '../hooks/usePayments'
import { useStatusChanges } from '../hooks/useStatusChanges'
import { nextToastKey } from '../lib/statusChange'
import type { ThemeChoice } from '../lib/theme'
import { useSession } from '../session/SessionContext'
import { BoardHeader } from './BoardHeader'
import { BookingDrawer } from './BookingDrawer'
import { CheckInDrawer } from './CheckInDrawer'
import { DayTotals } from './DayTotals'
import { PatientFlow } from './PatientFlow'
import { ScheduleGrid } from './ScheduleGrid'
import { type ToastMessage, UndoToast } from './UndoToast'
import { type ViewId, ViewTabs } from './ViewTabs'

// ?crash in the URL breaks the board on purpose, to demo and test the
// error screen (like ?fail for a failed load).
function throwIfDemoCrash() {
  if (new URLSearchParams(window.location.search).has('crash')) {
    throw new Error('Demo crash: ?crash is in the URL')
  }
}

type BoardProps = {
  theme: ThemeChoice
  onThemeChange: (choice: ThemeChoice) => void
}

// The signed-in screen: header, the Schedule / Patient flow views, the two
// drawers, and the toast. State lives here; the rules live in hooks and lib.
export function Board({ theme, onThemeChange }: BoardProps) {
  throwIfDemoCrash()
  const { user, practiceId, setPracticeId, signOut, can } = useSession()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const newAppointmentRef = useRef<HTMLButtonElement>(null)
  const [view, setView] = useState<ViewId>('schedule')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // A plain confirmation with no Undo (e.g. "Booked …").
  const [notice, setNotice] = useState<ToastMessage | null>(null)

  const practices = usePractices()
  const schedule = useSchedule(practiceId, DEMO_DATE)
  const update = useUpdateAppointment(practiceId, DEMO_DATE)
  const create = useCreateAppointment(practiceId, DEMO_DATE)
  const recordPayment = useRecordPayment(practiceId, DEMO_DATE)
  const voidPayment = useVoidPayment(practiceId, DEMO_DATE)
  const move = useMoveAppointment(practiceId, DEMO_DATE)
  const resetDemoData = useResetDemoData()

  const statusChanges = useStatusChanges({
    day: schedule.data,
    update,
    can,
    onChanged: () => {
      setNotice(null)
      payments.clear()
      moves.clear()
    },
  })
  // Payments share the one toast: whichever changed last shows, with its Undo.
  const payments = usePayments({
    day: schedule.data,
    record: recordPayment,
    voidIt: voidPayment,
    can,
    onChanged: () => {
      setNotice(null)
      statusChanges.clear()
      moves.clear()
    },
  })
  // Moves share the toast too.
  const moves = useMoves({
    day: schedule.data,
    move,
    can,
    onChanged: () => {
      setNotice(null)
      statusChanges.clear()
      payments.clear()
    },
  })
  const booking = useBooking({
    day: schedule.data,
    create,
    buttonRef: newAppointmentRef,
    onBooked: (text) => {
      statusChanges.clear()
      payments.clear()
      moves.clear()
      setNotice({ key: nextToastKey(), text })
    },
  })

  // Read the selected appointment from the query, not a copy in state,
  // so the drawer shows fresh data after every save.
  const selected = schedule.data?.appointments.find((a) => a.id === selectedId)

  // One toast for every kind of change: whichever happened last.
  const toast = statusChanges.toast ?? payments.toast ?? moves.toast ?? notice
  const undo = statusChanges.toast
    ? statusChanges.undo
    : payments.toast
      ? payments.undo
      : moves.toast
        ? moves.undo
        : undefined
  // The latest change to the visit whose drawer is open, for the drawer to
  // show with its Undo (the drawer traps Tab, so the toast is out of reach).
  const drawerChange =
    selected && toast?.appointmentId === selected.id
      ? { key: toast.key, text: changeDetail(toast), undo }
      : null

  // Which card is saving right now (for the flow board's buttons).
  const savingId = update.isPending ? (update.variables?.id ?? null) : null

  const openDrawer = (id: string) => {
    update.reset() // clear any error left over from an earlier save
    recordPayment.reset()
    move.reset()
    setSelectedId(id)
  }

  const switchPractice = (id: string) => {
    setSelectedId(null) // never keep one practice's drawer open on another
    statusChanges.clear()
    payments.clear()
    moves.clear()
    setNotice(null)
    update.reset()
    move.reset()
    setPracticeId(id)
  }

  const resetDemo = () => {
    // Nothing on screen may point at a visit from before the reset.
    setSelectedId(null)
    statusChanges.clear()
    payments.clear()
    moves.clear()
    update.reset()
    move.reset()
    resetDemoData()
    setNotice({ key: nextToastKey(), text: 'Demo data reset' })
  }

  // Same as the sign-in page: after the page swaps, focus starts at its heading.
  useEffect(() => headingRef.current?.focus(), [])

  // Anything modal open? Then the page behind is inert.
  const modalOpen = Boolean(selected) || booking.isOpen

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <BoardHeader
        headingRef={headingRef}
        inert={modalOpen}
        user={user}
        practices={practices.data}
        practiceId={practiceId}
        canSwitchPractice={can('switch-practice')}
        onPracticeChange={switchPractice}
        theme={theme}
        onThemeChange={onThemeChange}
        onSignOut={signOut}
        onResetDemo={resetDemo}
      />

      {/* inert: while a drawer is open, nothing behind it can be focused or clicked */}
      <main
        inert={modalOpen}
        className="flex flex-col gap-4 p-4 max-sm:pb-24 sm:p-6"
      >
        {can('view-day-totals') && schedule.data && (
          <DayTotals day={schedule.data} />
        )}
        <ViewTabs
          value={view}
          onChange={setView}
          actions={
            can('book') && (
              <button
                type="button"
                ref={newAppointmentRef}
                onClick={() => booking.open(null)}
                disabled={!schedule.data}
                // On a phone it floats at the bottom right, in thumb reach.
                className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 max-sm:fixed max-sm:right-4 max-sm:bottom-4 max-sm:z-30 max-sm:h-12 max-sm:rounded-full max-sm:px-5 max-sm:shadow-lg"
              >
                New appointment
              </button>
            )
          }
        >
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
              {/* Undoing a payment from the toast failed (the drawer may be closed). */}
              {voidPayment.isError && !selected && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {voidPayment.error.message}
                </p>
              )}
              {/* Undoing a move from the toast failed (the drawer may be closed). */}
              {move.isError && !selected && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {move.error.message}
                </p>
              )}
              {view === 'schedule' ? (
                <ScheduleGrid
                  day={schedule.data}
                  now={DEMO_NOW}
                  onSelectAppointment={openDrawer}
                  onSelectSlot={
                    can('book')
                      ? (chairId, time) => booking.open({ chairId, time })
                      : undefined
                  }
                />
              ) : (
                <PatientFlow
                  day={schedule.data}
                  now={DEMO_NOW}
                  savingId={savingId}
                  onOpen={openDrawer}
                  onAdvance={statusChanges.changeStatus}
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
          now={DEMO_NOW}
          isSaving={update.isPending}
          saveError={update.error?.message ?? null}
          onSave={(patch) =>
            update.mutateAsync({ id: selected.id, patch }).then(() => {})
          }
          onChangeStatus={(status, reason) =>
            statusChanges.changeStatus(selected.id, status, reason)
          }
          onRecordPayment={(input) =>
            payments.recordPayment(selected.id, input)
          }
          isRecordingPayment={recordPayment.isPending || voidPayment.isPending}
          paymentError={
            recordPayment.error?.message ?? voidPayment.error?.message ?? null
          }
          onMove={(to) => moves.moveVisit(selected.id, to)}
          isMoving={move.isPending}
          moveError={move.error?.message ?? null}
          lastChange={drawerChange}
          onClose={() => setSelectedId(null)}
        />
      )}

      {schedule.data && booking.isOpen && (
        <BookingDrawer
          day={schedule.data}
          now={DEMO_NOW}
          isSaving={create.isPending}
          saveError={create.error?.message ?? null}
          onBook={booking.book}
          onClose={booking.close}
          initialChairId={booking.start?.chairId}
          initialFrom={booking.start?.time}
        />
      )}

      <UndoToast
        toast={toast}
        // While the drawer offers this Undo itself, the toast steps aside
        // and holds (it would otherwise time out behind the drawer).
        undo={drawerChange ? undefined : undo}
        hold={drawerChange !== null}
        onDismiss={() => {
          statusChanges.clear()
          payments.clear()
          moves.clear()
          setNotice(null)
        }}
      />
    </div>
  )
}

// "Lena Ortiz: moved to 11:30 AM" -> "moved to 11:30 AM": inside her own
// drawer the name goes without saying.
function changeDetail(toast: ToastMessage): string {
  const prefix = `${toast.name}: `
  return toast.name && toast.text.startsWith(prefix)
    ? toast.text.slice(prefix.length)
    : toast.text
}
