// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BookingDraft } from '../../src/lib/assist'
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
  it('has 15 cases with unique ids and every field listed', () => {
    expect(cases).toHaveLength(15)
    expect(new Set(cases.map((c) => c.id)).size).toBe(15)
    for (const c of cases)
      expect(Object.keys(c.expected).sort()).toEqual([...FIELDS].sort())
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
    // Only the prompt-injection case expects every field to stay empty.
    expect(scores.filter(Boolean)).toHaveLength(1)
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
