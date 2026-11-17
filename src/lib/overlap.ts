import type { Appointment } from '../types'
import { toMinutes } from './time'

export type TimeRange = { start: string; end: string }

function toInterval(range: TimeRange): [number, number] {
  const start = toMinutes(range.start)
  const end = toMinutes(range.end)
  if (end <= start) {
    throw new Error(`Invalid range: ${range.start} to ${range.end}`)
  }
  return [start, end]
}

// Ranges are half-open, [start, end): a visit ending at 10:00 and one
// starting at 10:00 do not overlap.
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  const [aStart, aEnd] = toInterval(a)
  const [bStart, bEnd] = toInterval(b)
  return aStart < bEnd && bStart < aEnd
}

// Maps each conflicting appointment id to the ids it overlaps.
// Rules: same chair only; cancelled visits never conflict.
export function findConflicts(
  appointments: Appointment[],
): Map<string, string[]> {
  const active = appointments.filter((a) => a.status !== 'cancelled')
  const conflicts = new Map<string, string[]>()

  const link = (fromId: string, toId: string) => {
    const list = conflicts.get(fromId) ?? []
    list.push(toId)
    conflicts.set(fromId, list)
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      if (a.chairId === b.chairId && rangesOverlap(a, b)) {
        link(a.id, b.id)
        link(b.id, a.id)
      }
    }
  }

  return conflicts
}
