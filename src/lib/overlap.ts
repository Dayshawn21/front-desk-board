import type { Appointment } from '../types'

export type TimeRange = { start: string; end: string }

// Stub for TDD: the tests are written first and must fail against this.
export function rangesOverlap(_a: TimeRange, _b: TimeRange): boolean {
  throw new Error('Not implemented')
}

export function findConflicts(
  _appointments: Appointment[],
): Map<string, string[]> {
  throw new Error('Not implemented')
}
