import type { ScheduleDay } from '../types'

// What a person (or, on Day 4, the AI parser) asks for.
// Times in the window are practice wall-clock "HH:MM".
export type SlotRequest = {
  durationMinutes: number
  chairId?: string // any chair when omitted
  earliest?: string // slot may start at or after this
  latest?: string // slot must END at or before this
  limit?: number // default 3
}

export type OpenSlot = { chairId: string; start: string; end: string }

export function findOpenSlots(
  _day: ScheduleDay,
  _request: SlotRequest,
): OpenSlot[] {
  throw new Error('findOpenSlots: not implemented')
}
