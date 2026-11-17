import { useState } from 'react'
import { DEMO_DATE } from './config'
import { usePractices, useSchedule } from './hooks/useSchedule'

function App() {
  const [practiceId, setPracticeId] = useState('maple')
  const practices = usePractices()
  const schedule = useSchedule(practiceId, DEMO_DATE)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-end gap-4 border-b border-slate-200 bg-white px-6 py-4">
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
            onChange={(e) => setPracticeId(e.target.value)}
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

      <main className="p-6">
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
          <p className="text-sm">
            {schedule.data.practice.name}: {schedule.data.appointments.length}{' '}
            appointments across {schedule.data.chairs.length} chairs
          </p>
        )}
      </main>
    </div>
  )
}

export default App
