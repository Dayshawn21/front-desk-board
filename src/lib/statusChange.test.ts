import { describe, expect, it } from 'vitest'
import {
  changeKind,
  type StatusChange,
  statusPatch,
  toastTextFor,
  undoFor,
} from './statusChange'

const change = (overrides: Partial<StatusChange>): StatusChange => ({
  key: 1,
  appointmentId: 'a-07',
  name: 'Lena Ortiz',
  from: 'confirmed',
  to: 'arrived',
  kind: 'forward',
  ...overrides,
})

describe('changeKind', () => {
  it.each([
    ['confirmed', 'arrived', 'forward'],
    ['arrived', 'confirmed', 'undo'],
    ['scheduled', 'cancelled', 'cancel'],
    ['cancelled', 'scheduled', 'restore'],
    ['confirmed', 'no-show', 'no-show'],
    ['no-show', 'scheduled', 'undo'],
  ] as const)('%s -> %s is %s', (from, to, kind) => {
    expect(changeKind(from, to)).toBe(kind)
  })
})

describe('statusPatch', () => {
  it('saves why a visit was cancelled, and clears it on restore', () => {
    expect(statusPatch('confirmed', 'cancelled', 'late-cancel')).toEqual({
      status: 'cancelled',
      cancelReason: 'late-cancel',
    })
    expect(statusPatch('cancelled', 'confirmed')).toEqual({
      status: 'confirmed',
      cancelReason: null,
    })
    expect(statusPatch('confirmed', 'arrived')).toEqual({ status: 'arrived' })
  })
})

describe('undoFor', () => {
  it('steps a forward change back, with the permission that step needs', () => {
    expect(undoFor(change({}))).toEqual({
      label: 'Undo check-in',
      status: 'confirmed',
      permission: 'check-in',
    })
  })

  it('puts a cancel or no-show back to exactly what it was', () => {
    expect(
      undoFor(change({ from: 'scheduled', to: 'cancelled', kind: 'cancel' })),
    ).toEqual({
      label: 'Undo cancel',
      status: 'scheduled',
      permission: 'cancel',
    })
    expect(
      undoFor(change({ from: 'scheduled', to: 'no-show', kind: 'no-show' })),
    ).toEqual({
      label: 'Undo no-show',
      status: 'scheduled',
      permission: 'no-show',
    })
  })

  it('offers nothing after an undo or a restore', () => {
    expect(
      undoFor(change({ from: 'arrived', to: 'confirmed', kind: 'undo' })),
    ).toBeNull()
    expect(
      undoFor(change({ from: 'cancelled', to: 'confirmed', kind: 'restore' })),
    ).toBeNull()
  })
})

describe('toastTextFor', () => {
  it.each([
    [change({}), 'Lena Ortiz: Arrived'],
    [
      change({ from: 'arrived', to: 'confirmed', kind: 'undo' }),
      'Lena Ortiz: moved back to Confirmed',
    ],
    [
      change({
        to: 'cancelled',
        kind: 'cancel',
        reason: 'late-cancel',
      }),
      'Lena Ortiz: cancelled, late cancel',
    ],
    [change({ to: 'no-show', kind: 'no-show' }), 'Lena Ortiz: marked no-show'],
    [
      change({ from: 'cancelled', to: 'confirmed', kind: 'restore' }),
      'Lena Ortiz: restored as Confirmed',
    ],
  ])('says what happened', (c, text) => {
    expect(toastTextFor(c)).toBe(text)
  })
})
