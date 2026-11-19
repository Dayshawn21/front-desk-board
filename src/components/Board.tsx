import { useEffect, useRef, useState } from 'react'
import { DEMO_DATE, DEMO_NOW } from '../config'
import { useBooking } from '../hooks/useBooking'
import {
  useCreateAppointment,
  usePractices,
  useSchedule,
  useUpdateAppointment,
} from '../hooks/useSchedule'
import { useStatusChanges } from '../hooks/useStatusChanges'
import { nextToastKey } from '../lib/statusChange'
import type { ThemeChoice } from '../lib/theme'
import { useSession } from '../session/SessionContext'
import { BoardHeader } from './BoardHeader'
import { BookingDrawer } from './BookingDrawer'
import { CheckInDrawer } from './CheckInDrawer'
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

  const statusChanges = useStatusChanges({
    day: schedule.data,
    update,
    can,
    onChanged: () => setNotice(null),
  })
  const booking = useBooking({
    day: schedule.data,
    create,
    buttonRef: newAppointmentRef,
    onBooked: (text) => {
      statusChanges.clear()
      setNotice({ key: nextToastKey(), text })
    },
  })

  // Read the selected appointment from the query, not a copy in state,
  // so the drawer shows fresh data after every save.
  const selected = schedule.data?.appointments.find((a) => a.id === selectedId)

  // Which card is saving right now (for the flow board's buttons).
  const savingId = update.isPending ? (update.variables?.id ?? null) : null

  const openDrawer = (id: string) => {
    update.reset() // clear any error left over from an earlier save
    setSelectedId(id)
  }

  const switchPractice = (id: string) => {
    setSelectedId(null) // never keep one practice's drawer open on another
    statusChanges.clear()
    setNotice(null)
    update.reset()
    setPracticeId(id)
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
      />

      {/* inert: while a drawer is open, nothing behind it can be focused or clicked */}
      <main
        inert={modalOpen}
        className="flex flex-col gap-4 p-4 max-sm:pb-24 sm:p-6"
      >
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
        toast={statusChanges.toast ?? notice}
        undo={statusChanges.undo}
        onDismiss={() => {
          statusChanges.clear()
          setNotice(null)
        }}
      />
    </div>
  )
}
