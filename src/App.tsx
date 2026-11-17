import { useState } from 'react'

import { ScheduleGrid } from './components/ScheduleGrid'
import { DEMO_DATE, DEMO_NOW } from './config'
import {
  usePractices,
  useSchedule,
  useUpdateAppointment,
} from './hooks/useSchedule'
import { CheckInDrawer } from './components/CheckInDrawer'

function App() {
  const [practiceId, setPracticeId] = useState('maple')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const practices = usePractices()
  const schedule = useSchedule(practiceId, DEMO_DATE)
  const update = useUpdateAppointment(practiceId, DEMO_DATE)

  // Read the selected appointment from the query, not a copy in state,
  // so the drawer shows fresh data after every save.
  const selected = schedule.data?.appointments.find((a) => a.id === selectedId)

  const openDrawer = (id: string) => {
    update.reset() // clear any error left over from a previous drawer
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
          <ScheduleGrid
            day={schedule.data}
            now={DEMO_NOW}
            onSelectAppointment={openDrawer}
          />
        )}
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
