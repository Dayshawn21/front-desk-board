import { describe, expect, it } from 'vitest'
import type { Role } from '../types'
import { can, type Permission } from './permissions'

// The full matrix: every role × every permission. This table IS the spec.
const matrix: [Role, Permission, boolean][] = [
  ['front-desk', 'confirm', true],
  ['front-desk', 'check-in', true],
  ['front-desk', 'seat', false],
  ['front-desk', 'check-out', true],
  ['front-desk', 'reopen-checkout', false],
  ['front-desk', 'edit-checklist', true],
  ['front-desk', 'switch-practice', false],

  ['provider', 'confirm', false],
  ['provider', 'check-in', false],
  ['provider', 'seat', true],
  ['provider', 'check-out', false],
  ['provider', 'reopen-checkout', false],
  ['provider', 'edit-checklist', false],
  ['provider', 'switch-practice', false],

  ['office-manager', 'confirm', true],
  ['office-manager', 'check-in', true],
  ['office-manager', 'seat', true],
  ['office-manager', 'check-out', true],
  ['office-manager', 'reopen-checkout', true],
  ['office-manager', 'edit-checklist', true],
  ['office-manager', 'switch-practice', true],
]

describe('can', () => {
  it.each(matrix)('%s → %s → %s', (role, permission, expected) => {
    expect(can(role, permission)).toBe(expected)
  })
})
