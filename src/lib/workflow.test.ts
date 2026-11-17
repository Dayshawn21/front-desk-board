import { describe, expect, it } from 'vitest'
import { flowSteps, nextAction } from './workflow'

describe('nextAction', () => {
  it('walks a visit through every front-desk step in order', () => {
    expect(nextAction('scheduled')).toEqual({
      label: 'Mark confirmed',
      status: 'confirmed',
    })
    expect(nextAction('confirmed')).toEqual({
      label: 'Check in',
      status: 'arrived',
    })
    expect(nextAction('arrived')).toEqual({
      label: 'Seat in chair',
      status: 'in-chair',
    })
    expect(nextAction('in-chair')).toEqual({
      label: 'Check out',
      status: 'completed',
    })
  })

  it('has no next step for finished or cancelled visits', () => {
    expect(nextAction('completed')).toBeNull()
    expect(nextAction('cancelled')).toBeNull()
  })

  it('each next status is the following step in flowSteps', () => {
    for (const [i, step] of flowSteps.slice(0, -1).entries()) {
      expect(nextAction(step)?.status).toBe(flowSteps[i + 1])
    }
  })
})
