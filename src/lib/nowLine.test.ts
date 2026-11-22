import { describe, expect, it } from 'vitest'
import { labelCoveredByNow } from './nowLine'

// The "now" marker is a pill on the time axis. When it sits on a
// half-hour label, that label is hidden (the pill already says the time),
// so the two never print over each other.
describe('labelCoveredByNow', () => {
  const nineThirty = 9 * 60 + 30
  it.each<[string, number, boolean]>([
    ['well before the label', 9 * 60 + 20, false],
    ['just before it', 9 * 60 + 27, true],
    ['on it', 9 * 60 + 30, true],
    ['the demo clock, 9:40', 9 * 60 + 40, true],
    ['12 minutes after', 9 * 60 + 42, true],
    ['13 minutes after', 9 * 60 + 43, false],
    ['the next half hour', 10 * 60, false],
  ])('now %s → %s', (_, now, covered) => {
    expect(labelCoveredByNow(nineThirty, now)).toBe(covered)
  })
})
