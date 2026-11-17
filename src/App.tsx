import { useState } from 'react'
import { CheckInDrawer } from './components/CheckInDrawer'
import { PatientFlow } from './components/PatientFlow'
import { ScheduleGrid } from './components/ScheduleGrid'
import { type ViewId, ViewTabs } from './components/ViewTabs'
import { DEMO_DATE, DEMO_NOW } from './config'
import {
  usePractices,
  useSchedule,
  useUpdateAppointment,
} from './hooks/useSchedule'

function App() {
  const [practiceId, setPracticeId] = useState('maple')
  const [view, setView] = useState<ViewId>('schedule')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        inert={Boolean(selected)}
        className="flex flex-wrap items-end gap-4 border-b border-slate-200 bg-white px-6 py-4"
      >
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Front Desk Board</h1>
          <p className="text-sm text-slate-600">
            Tuesday, Nov 17 · Demo data only, no real patients
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Practice
          <select
            value={practiceId}
            onChange={(e) => {
              setSelectedId(null) // never keep one practice's drawer open on another
              update.reset()
              setPracticeId(e.target.value)
            }}
            disabled={!practices.data}
            className="h-11 min-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {practices.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                  onAdvance={(id, status) =>
                    update.mutate({ id, patch: { status } })
                  }
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
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

export default App
