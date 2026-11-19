import type { BookingDraft } from '../../src/lib/assist.ts'

// Programmatic grading for the AI booking assist eval. No model judges here:
// every check compares the app's checked draft with the expected fields.

export const FIELDS = [
  'patientId',
  'visitType',
  'durationMinutes',
  'chairId',
  'timeOfDay',
  'earliest',
] as const
type Field = (typeof FIELDS)[number]

// An expected value, or a list of acceptable values (null allowed).
type Expected = string | number | null | (string | number | null)[]

export type EvalCase = {
  id: string
  tags: string[]
  practiceId: string
  text: string
  expected: Record<Field, Expected>
  notUsedMentions?: string // must appear in draft.notUsed, case-insensitive
}

// What the route returned: a draft, or why there was none.
export type Outcome =
  | { draft: BookingDraft; warnings: string[] }
  | { error: 'refusal' | 'bad-output' }

export type Grade = {
  grade: { all_fields: number; no_invented: number; field_score: number }
  explanation: { all_fields: string; no_invented: string; field_score: string }
}

const accepts = (expected: Expected, actual: unknown) =>
  Array.isArray(expected)
    ? expected.includes(actual as never)
    : expected === actual

const show = (value: unknown) => (value === null ? 'empty' : String(value))

export function gradeOutcome(c: EvalCase, outcome: Outcome): Grade {
  if ('error' in outcome) {
    const why = `no draft (${outcome.error})`
    return {
      // Nothing was filled in, so nothing was made up.
      grade: { all_fields: 0, no_invented: 1, field_score: 0 },
      explanation: { all_fields: why, no_invented: why, field_score: why },
    }
  }

  const { draft } = outcome
  const misses = FIELDS.filter((f) => !accepts(c.expected[f], draft[f])).map(
    (f) => `${f}: expected ${show(c.expected[f])}, got ${show(draft[f])}`,
  )

  const mention = c.notUsedMentions?.toLowerCase()
  const notUsedOk =
    !mention ||
    draft.notUsed.some((note) => note.toLowerCase().includes(mention))
  if (!notUsedOk)
    misses.push(`notUsed: expected to mention "${c.notUsedMentions}"`)

  // Made up = filled a patient or chair the request didn't clearly name.
  const invented = (['patientId', 'chairId'] as const).filter(
    (f) => c.expected[f] === null && draft[f] !== null,
  )

  const matched =
    FIELDS.length - misses.filter((m) => !m.startsWith('notUsed')).length
  return {
    grade: {
      all_fields: misses.length === 0 ? 1 : 0,
      no_invented: invented.length === 0 ? 1 : 0,
      field_score: matched / FIELDS.length,
    },
    explanation: {
      all_fields: misses.length ? misses.join('; ') : 'all fields match',
      no_invented: invented.length
        ? `filled ${invented.map((f) => `${f}=${show(draft[f])}`).join(', ')} though the request didn't name it`
        : 'nothing made up',
      field_score: `${matched} of ${FIELDS.length} fields match`,
    },
  }
}
