import { describe, expect, it } from 'vitest'
import { type AssistContext, findOtherDay, sanitizeDraft } from './assist'

const context: AssistContext = {
  practiceName: 'Maple Street Dental',
  openTime: '08:00',
  closeTime: '17:00',
  patients: [
    { id: 'p-ana', name: 'Ana Diaz' },
    { id: 'p-owen', name: 'Owen Hart' },
  ],
  chairs: [
    { id: 'maple-c1', name: 'Chair 1', provider: 'Dr. Okafor' },
    { id: 'maple-c2', name: 'Chair 2', provider: 'Hygienist Patel' },
  ],
}

const raw = (overrides: Record<string, unknown> = {}) => ({
  patientId: 'p-ana',
  visitType: 'cleaning',
  durationMinutes: 60,
  chairId: 'maple-c2',
  timeOfDay: 'afternoon',
  earliest: null,
  notUsed: [],
  ...overrides,
})

describe('sanitizeDraft', () => {
  it('keeps valid values as they are', () => {
    expect(sanitizeDraft(raw(), context)).toEqual({
      draft: {
        patientId: 'p-ana',
        visitType: 'cleaning',
        durationMinutes: 60,
        chairId: 'maple-c2',
        timeOfDay: 'afternoon',
        earliest: null,
        notUsed: [],
      },
      warnings: [],
    })
  })

  it('drops a patient that is not in this practice (no invented patients)', () => {
    const { draft, warnings } = sanitizeDraft(
      raw({ patientId: 'p-hana' }),
      context,
    )
    expect(draft.patientId).toBeNull()
    expect(warnings).toEqual([expect.stringMatching(/patient/i)])
  })

  it('drops a chair that is not in this practice', () => {
    const { draft, warnings } = sanitizeDraft(
      raw({ chairId: 'river-c1' }),
      context,
    )
    expect(draft.chairId).toBeNull()
    expect(warnings).toEqual([expect.stringMatching(/chair/i)])
  })

  it('drops a visit type, length or time of day the form does not offer', () => {
    const { draft, warnings } = sanitizeDraft(
      raw({ visitType: 'whitening', durationMinutes: 20, timeOfDay: 'night' }),
      context,
    )
    expect(draft).toMatchObject({
      visitType: null,
      durationMinutes: null,
      timeOfDay: null,
    })
    expect(warnings).toHaveLength(3)
  })

  it('keeps an earliest time only if it is a real time inside opening hours', () => {
    expect(
      sanitizeDraft(raw({ earliest: '14:15' }), context).draft.earliest,
    ).toBe('14:15')
    expect(
      sanitizeDraft(raw({ earliest: '18:30' }), context).draft.earliest,
    ).toBeNull()
    expect(
      sanitizeDraft(raw({ earliest: '2pm' }), context).draft.earliest,
    ).toBeNull()
  })

  it('treats missing fields as not said, without warnings', () => {
    const { draft, warnings } = sanitizeDraft(
      raw({
        patientId: null,
        visitType: null,
        durationMinutes: null,
        chairId: null,
        timeOfDay: null,
      }),
      context,
    )
    expect(Object.values(draft).filter((v) => v !== null)).toEqual([[]])
    expect(warnings).toEqual([])
  })

  it('keeps at most 5 short notUsed notes, and only strings', () => {
    const { draft } = sanitizeDraft(
      raw({
        notUsed: ['next Tuesday', 42, 'x'.repeat(200), 'a', 'b', 'c', 'd'],
      }),
      context,
    )
    expect(draft.notUsed).toHaveLength(5)
    expect(draft.notUsed[0]).toBe('next Tuesday')
    expect(draft.notUsed.every((n) => n.length <= 80)).toBe(true)
  })

  it('rejects output that is not an object', () => {
    expect(() => sanitizeDraft('cleaning for Ana', context)).toThrow()
    expect(() => sanitizeDraft(null, context)).toThrow()
  })
})

describe('findOtherDay', () => {
  it.each([
    ['Filling for Priya in chair 3 tomorrow morning', 'tomorrow'],
    ['Exam for Jon the day after tomorrow', 'the day after tomorrow'],
    ['Cleaning for Ana next Tuesday', 'next Tuesday'],
    ['Exam for Jon on Friday at 10', 'Friday'],
    ['Crown prep next week', 'next week'],
    ['Consult for Ms. Silva on 11/20', '11/20'],
    ['Exam for Jon Nov 24', 'Nov 24'],
    ['Exam for Jon in 2 weeks', 'in 2 weeks'],
  ])('finds another day in %j', (text, expected) => {
    expect(findOtherDay(text)).toBe(expected)
  })

  it.each([
    'Cleaning for Ana this afternoon',
    'Exam for Jon Kim, any time today',
    'Crown prep for Marcus Bell after 2:30 pm',
    'Book Tomás Reyes for a 90 min crown with Dr. Lindqvist at 1:30',
    '45 minute exam for Owen Hart, every 6 months',
  ])('finds nothing in %j', (text) => {
    expect(findOtherDay(text)).toBeNull()
  })
})
