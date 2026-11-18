import { describe, expect, it } from 'vitest'
import { appointments as seedAppointments } from '../mocks/seed'
import { can } from './permissions'
import {
  cancelAction,
  flowSteps,
  groupByFlow,
  nextAction,
  previousAction,
} from './workflow'

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

describe('previousAction', () => {
  it('moves each visit one step back', () => {
    expect(previousAction('confirmed')).toEqual({
      label: 'Undo confirm',
      status: 'scheduled',
      permission: 'confirm',
    })
    expect(previousAction('arrived')).toEqual({
      label: 'Undo check-in',
      status: 'confirmed',
      permission: 'check-in',
    })
    expect(previousAction('in-chair')).toEqual({
      label: 'Undo seating',
      status: 'arrived',
      permission: 'seat',
    })
    expect(previousAction('completed')).toEqual({
      label: 'Reopen visit',
      status: 'in-chair',
      permission: 'reopen-checkout',
    })
  })

  it('has nothing to undo for a scheduled or cancelled visit', () => {
    expect(previousAction('scheduled')).toBeNull()
    expect(previousAction('cancelled')).toBeNull()
  })

  it('undoes exactly what the forward step did', () => {
    for (const step of flowSteps.slice(0, -1)) {
      const forward = nextAction(step)!
      expect(previousAction(forward.status)?.status).toBe(step)
    }
  })

  it('needs the same permission as the forward step, except reopening a checkout', () => {
    for (const step of ['scheduled', 'confirmed', 'arrived'] as const) {
      const forward = nextAction(step)!
      expect(previousAction(forward.status)?.permission).toBe(
        forward.permission,
      )
    }
    expect(previousAction('completed')?.permission).not.toBe(
      nextAction('in-chair')?.permission,
    )
  })

  it('lets front desk undo a check-in but not reopen a checked-out visit', () => {
    expect(can('front-desk', previousAction('arrived')!.permission)).toBe(true)
    expect(can('front-desk', previousAction('completed')!.permission)).toBe(
      false,
    )
    expect(can('office-manager', previousAction('completed')!.permission)).toBe(
      true,
    )
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

describe('cancelAction', () => {
  it('lets a visit be cancelled before the patient arrives', () => {
    for (const status of ['scheduled', 'confirmed'] as const) {
      expect(cancelAction(status)).toEqual({
        label: 'Cancel visit',
        status: 'cancelled',
        permission: 'cancel',
      })
    }
  })

  it('does not cancel a visit that has started, finished, or is cancelled', () => {
    for (const status of [
      'arrived',
      'in-chair',
      'completed',
      'cancelled',
    ] as const) {
      expect(cancelAction(status)).toBeNull()
    }
  })
})
