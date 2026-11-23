// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type BookingDraft,
  LENGTHS,
  TIMES_OF_DAY,
  VISIT_TYPES,
} from '../../src/lib/assist'
import { chairs, patients, practices } from '../../src/mocks/seed'
import { type EvalCase, FIELDS, gradeOutcome } from './grade'

// Checks the grader before any paid run (eval-audit: oracle and null).
const cases: EvalCase[] = JSON.parse(
  readFileSync(new URL('./cases.json', import.meta.url), 'utf8'),
)

// The "perfect answer" for a case: the first acceptable value of each field.
function oracle(c: EvalCase): BookingDraft {
  const pick = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const draft = Object.fromEntries(
    FIELDS.map((f) => [f, pick(c.expected[f])]),
  ) as unknown as BookingDraft
  draft.notUsed = c.notUsedMentions ? [c.notUsedMentions] : []
  return draft
}

const empty: BookingDraft = {
  patientId: null,
  visitType: null,
  durationMinutes: null,
  chairId: null,
  timeOfDay: null,
  earliest: null,
  notUsed: [],
}

describe('eval grader', () => {
  it('has 50+ cases with unique ids and every field listed', () => {
    expect(cases.length).toBeGreaterThanOrEqual(50)
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length)
    for (const c of cases)
      expect(Object.keys(c.expected).sort()).toEqual([...FIELDS].sort())
  })

  // A typo in a case would grade the model against an answer it can't give.
  it("expects only values the form can hold, from the case's own practice", () => {
    const all = (v: unknown) => (Array.isArray(v) ? v : [v])
    for (const c of cases) {
      const practice = practices.find((p) => p.id === c.practiceId)
      expect(practice, c.id).toBeDefined()
      const ok = {
        patientId: patients
          .filter((p) => p.practiceId === c.practiceId)
          .map((p) => p.id),
        chairId: chairs
          .filter((ch) => ch.practiceId === c.practiceId)
          .map((ch) => ch.id),
        visitType: [...VISIT_TYPES],
        durationMinutes: [...LENGTHS],
        timeOfDay: [...TIMES_OF_DAY],
      } as Record<string, unknown[]>
      for (const [field, allowed] of Object.entries(ok))
        for (const v of all(c.expected[field as keyof typeof c.expected]))
          if (v !== null) expect(allowed, `${c.id} ${field}`).toContain(v)
      for (const v of all(c.expected.earliest))
        if (v !== null) {
          expect(v, c.id).toMatch(/^\d\d:\d\d$/)
          expect(v >= practice!.openTime && v < practice!.closeTime, c.id).toBe(
            true,
          )
        }
    }
  })

  it('scores the oracle answer 100% on every case', () => {
    for (const c of cases) {
      const { grade } = gradeOutcome(c, { draft: oracle(c), warnings: [] })
      expect(grade, c.id).toEqual({
        all_fields: 1,
        no_invented: 1,
        field_score: 1,
      })
    }
  })

  it('fails an empty answer on every case that expects any field', () => {
    const scores = cases.map(
      (c) => gradeOutcome(c, { draft: empty, warnings: [] }).grade.all_fields,
    )
    // Only these expect every field to stay empty.
    expect(cases.filter((_, i) => scores[i]).map((c) => c.id)).toEqual([
      'prompt-injection',
      'says-nothing',
      'not-a-booking',
    ])
  })

  it('flags a made-up patient or chair', () => {
    const c = cases.find((x) => x.id === 'unknown-patient')!
    const result = gradeOutcome(c, {
      draft: { ...oracle(c), patientId: 'p-ana' },
      warnings: [],
    })
    expect(result.grade.no_invented).toBe(0)
    expect(result.grade.all_fields).toBe(0)
    expect(result.explanation.no_invented).toMatch(/patientId=p-ana/)
  })

  it('requires the notUsed mention where the case asks for one', () => {
    const c = cases.find((x) => x.id === 'other-day')!
    const result = gradeOutcome(c, {
      draft: { ...oracle(c), notUsed: [] },
      warnings: [],
    })
    expect(result.grade.all_fields).toBe(0)
    expect(result.grade.field_score).toBe(1)
  })

  it('scores a refusal or unreadable answer as no draft, nothing made up', () => {
    const c = cases[0]
    expect(gradeOutcome(c, { error: 'refusal' }).grade).toEqual({
      all_fields: 0,
      no_invented: 1,
      field_score: 0,
    })
  })
})
