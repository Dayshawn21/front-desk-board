import type { ScheduleDay } from '../types'
import { rangesOverlap } from './overlap'
import { toClock, toMinutes } from './time'

// What a person (or, on Day 4, the AI parser) asks for.
// Times in the window are practice wall-clock "HH:MM".
export type SlotRequest = {
  durationMinutes: number
  chairId?: string // any chair when omitted
  earliest?: string // slot may start at or after this
  latest?: string // slot must END at or before this
  limit?: number // default 3
  ignoreId?: string // a visit being moved: it doesn't block its own new time
}

export type OpenSlot = { chairId: string; start: string; end: string }

// Slots start on the same 15-minute grid as the schedule rows.
const STEP_MINUTES = 15
const DEFAULT_LIMIT = 3

// Suggests open slots for one practice day. Pure and deterministic: the
// same day and request always give the same answer. It only suggests;
// a person still books.
//
// Ranking: earliest start first, then the practice's chair order.
export function findOpenSlots(
  day: ScheduleDay,
  request: SlotRequest,
): OpenSlot[] {
  const { durationMinutes, chairId, limit = DEFAULT_LIMIT } = request

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error(`Invalid duration: ${durationMinutes}`)
  }

  const chairs = chairId
    ? day.chairs.filter((c) => c.id === chairId)
    : day.chairs
  if (chairs.length === 0) {
    throw new Error(`Unknown chair for this practice: ${chairId}`)
  }

  const open = toMinutes(day.practice.openTime)
  const close = toMinutes(day.practice.closeTime)
  const from = Math.max(
    open,
    request.earliest ? toMinutes(request.earliest) : open,
  )
  const to = Math.min(close, request.latest ? toMinutes(request.latest) : close)
  // Check the window as asked, before clamping: a valid window that falls
  // outside opening hours just finds nothing, it isn't an error.
  if (
    request.earliest &&
    request.latest &&
    toMinutes(request.earliest) >= toMinutes(request.latest)
  ) {
    throw new Error(`Invalid window: ${request.earliest} to ${request.latest}`)
  }

  // Round the first start up onto the grid, counted from opening time.
  const firstStart =
    open + Math.ceil((from - open) / STEP_MINUTES) * STEP_MINUTES

  const active = day.appointments.filter(
    (a) => a.status !== 'cancelled' && a.id !== request.ignoreId,
  )
  const at = (minutes: number) => `${day.date}T${toClock(minutes)}:00`

  const slots: OpenSlot[] = []
  for (
    let start = firstStart;
    start + durationMinutes <= to && slots.length < limit;
    start += STEP_MINUTES
  ) {
    const range = { start: at(start), end: at(start + durationMinutes) }
    for (const chair of chairs) {
      if (slots.length >= limit) break
      const busy = active.some(
        (a) => a.chairId === chair.id && rangesOverlap(a, range),
      )
      if (!busy) slots.push({ chairId: chair.id, ...range })
    }
  }
  return slots
}
