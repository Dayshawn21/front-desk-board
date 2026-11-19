import type { AppointmentType } from '../types'

// The AI assist turns a free-text request into these form fields. It never
// picks a time or books anything: findOpenSlots suggests times, a person books.

export const VISIT_TYPES = [
  'cleaning',
  'exam',
  'filling',
  'crown',
  'consult',
  'emergency',
] as const satisfies readonly AppointmentType[]

export const LENGTHS = [15, 30, 45, 60, 90] as const
export const TIMES_OF_DAY = ['any', 'morning', 'afternoon'] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]

// What Claude may refer to: only this practice's fake patients and chairs.
export type AssistContext = {
  practiceName: string
  openTime: string // "HH:MM"
  closeTime: string
  patients: { id: string; name: string }[]
  chairs: { id: string; name: string; provider: string }[]
}

// The form fields after checking. null = "not said" or "couldn't use it".
export type BookingDraft = {
  patientId: string | null
  visitType: AppointmentType | null
  durationMinutes: number | null
  chairId: string | null
  timeOfDay: TimeOfDay | null
  earliest: string | null // "HH:MM"
  notUsed: string[] // parts of the request the form can't do, e.g. "next Tuesday"
}

export type SanitizedDraft = { draft: BookingDraft; warnings: string[] }

// Never trust model output: keep only values that exist in this practice
// and that the form can use. Everything else becomes null with a warning.
export function sanitizeDraft(
  _raw: unknown,
  _context: AssistContext,
): SanitizedDraft {
  throw new Error('sanitizeDraft: not implemented')
}
