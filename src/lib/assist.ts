import type { AppointmentType, ScheduleDay } from '../types'

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/
const minutes = (clock: string) =>
  Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5))

// Never trust model output: keep only values that exist in this practice
// and that the form can use. Everything else becomes null with a warning.
export function sanitizeDraft(
  raw: unknown,
  context: AssistContext,
): SanitizedDraft {
  if (!isRecord(raw)) {
    throw new Error('Expected the AI answer to be a JSON object.')
  }
  const warnings: string[] = []

  // null or missing means "not said" (no warning); anything else must pass.
  function keep<T>(
    value: unknown,
    isValid: (v: unknown) => v is T,
    warning: string,
  ): T | null {
    if (value === null || value === undefined) return null
    if (isValid(value)) return value
    warnings.push(warning)
    return null
  }

  const isPatientId = (v: unknown): v is string =>
    context.patients.some((p) => p.id === v)
  const isChairId = (v: unknown): v is string =>
    context.chairs.some((c) => c.id === v)
  const isVisitType = (v: unknown): v is AppointmentType =>
    (VISIT_TYPES as readonly unknown[]).includes(v)
  const isLength = (v: unknown): v is number =>
    (LENGTHS as readonly unknown[]).includes(v)
  const isTimeOfDay = (v: unknown): v is TimeOfDay =>
    (TIMES_OF_DAY as readonly unknown[]).includes(v)
  const isOpenClock = (v: unknown): v is string =>
    typeof v === 'string' &&
    CLOCK.test(v) &&
    minutes(v) >= minutes(context.openTime) &&
    minutes(v) < minutes(context.closeTime)

  const notUsed = Array.isArray(raw.notUsed)
    ? raw.notUsed
        .filter((note): note is string => typeof note === 'string')
        .map((note) => note.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 5)
    : []

  return {
    draft: {
      patientId: keep(
        raw.patientId,
        isPatientId,
        "The patient wasn't found in this practice's list.",
      ),
      visitType: keep(
        raw.visitType,
        isVisitType,
        "That visit type isn't offered.",
      ),
      durationMinutes: keep(
        raw.durationMinutes,
        isLength,
        "That length isn't offered (15, 30, 45, 60 or 90 min).",
      ),
      chairId: keep(
        raw.chairId,
        isChairId,
        "The chair wasn't found in this practice.",
      ),
      timeOfDay: keep(
        raw.timeOfDay,
        isTimeOfDay,
        "The time of day wasn't one the form offers.",
      ),
      earliest: keep(
        raw.earliest,
        isOpenClock,
        'The start time was outside opening hours.',
      ),
      notUsed,
    },
    warnings,
  }
}

// The same context, built from the day the browser is showing. The booking
// panel re-checks the server's answer against it before filling the form.
export function contextFromDay(day: ScheduleDay): AssistContext {
  return {
    practiceName: day.practice.name,
    openTime: day.practice.openTime,
    closeTime: day.practice.closeTime,
    patients: day.patients.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
    })),
    chairs: day.chairs.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
    })),
  }
}

// The words in a request that ask for a day other than today, e.g.
// "tomorrow". Checked in code, so the warning doesn't depend on the model.
// STUB: filled in by the next commit.
export function findOtherDay(text: string): string | null {
  void text
  return null
}
