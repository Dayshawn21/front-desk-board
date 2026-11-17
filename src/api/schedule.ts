import { appointments, chairs, patients, practices } from '../mocks/seed'
import type { Practice, ScheduleDay } from '../types'

// Mock API. Simulates network latency and can be forced to fail.
// Components call these functions only, never the seed data directly.

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 400

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Add ?fail to the URL to see the error state, e.g. http://localhost:5173/?fail
function shouldFail(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('fail')
  )
}

function forPractice<T extends { practiceId: string }>(
  rows: T[],
  practiceId: string,
): T[] {
  return rows.filter((row) => row.practiceId === practiceId)
}

export async function fetchPractices(): Promise<Practice[]> {
  await sleep(LATENCY_MS)
  return structuredClone(practices)
}

export async function fetchSchedule(
  practiceId: string,
  date: string,
): Promise<ScheduleDay> {
  await sleep(LATENCY_MS)

  if (shouldFail()) {
    throw new ApiError('Could not load the schedule (simulated failure).', 503)
  }

  const practice = practices.find((p) => p.id === practiceId)
  if (!practice) {
    throw new ApiError(`Unknown practice: ${practiceId}`, 404)
  }

  return structuredClone({
    practice,
    date,
    chairs: forPractice(chairs, practiceId),
    patients: forPractice(patients, practiceId),
    appointments: forPractice(appointments, practiceId).filter((a) =>
      a.start.startsWith(date),
    ),
  })
}
