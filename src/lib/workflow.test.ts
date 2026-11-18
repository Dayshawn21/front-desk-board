import { describe, expect, it } from 'vitest'
import { appointments as seedAppointments } from '../mocks/seed'
import { flowSteps, groupByFlow, nextAction } from './workflow'

describe('nextAction', () => {
  it('walks a visit through every front-desk step in order', () => {
    expect(nextAction('scheduled')).toEqual({
      label: 'Mark confirmed',
      status: 'confirmed',
      permission: 'confirm',
    })
    expect(nextAction('confirmed')).toEqual({
      label: 'Check in',
      status: 'arrived',
      permission: 'check-in',
    })
    expect(nextAction('arrived')).toEqual({
      label: 'Seat in chair',
      status: 'in-chair',
      permission: 'seat',
    })
    expect(nextAction('in-chair')).toEqual({
      label: 'Check out',
      status: 'completed',
      permission: 'check-out',
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

describe('groupByFlow', () => {
  const maple = seedAppointments.filter((a) => a.practiceId === 'maple')

  it('puts every Maple visit in exactly one column', () => {
    const groups = groupByFlow(maple)
    const ids = Object.values(groups).flatMap((list) => list.map((a) => a.id))
    expect(ids.sort()).toEqual(maple.map((a) => a.id).sort())
  })

  it('counts each column from the seed data', () => {
    const groups = groupByFlow(maple)
    expect(groups.expected).toHaveLength(9) // 5 scheduled + 4 confirmed
    expect(groups.arrived.map((a) => a.id)).toEqual(['a-06'])
    expect(groups['in-chair'].map((a) => a.id)).toEqual(['a-02', 'a-10'])
    expect(groups['checked-out']).toHaveLength(3)
  })

  it('orders each column by start time', () => {
    const starts = groupByFlow(maple).expected.map((a) => a.start)
    expect(starts).toEqual([...starts].sort())
  })

  it('leaves cancelled visits off the board', () => {
    const cancelled = { ...maple[0], id: 'x', status: 'cancelled' as const }
    const ids = Object.values(groupByFlow([cancelled])).flat()
    expect(ids).toHaveLength(0)
  })
})
