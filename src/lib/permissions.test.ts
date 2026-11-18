import { describe, expect, it } from 'vitest'
import type { Role } from '../types'
import { roleLabel } from './display'
import { can, type Permission, PERMISSIONS } from './permissions'

const ROLES = Object.keys(roleLabel) as Role[]

// The full matrix: every role × every permission. This table IS the spec.
const matrix: [Role, Permission, boolean][] = [
  ['front-desk', 'confirm', true],
  ['front-desk', 'check-in', true],
  ['front-desk', 'seat', false],
  ['front-desk', 'check-out', true],
  ['front-desk', 'reopen-checkout', false],
  ['front-desk', 'edit-checklist', true],
  ['front-desk', 'switch-practice', false],
  ['front-desk', 'book', true],

  ['provider', 'confirm', false],
  ['provider', 'check-in', false],
  ['provider', 'seat', true],
  ['provider', 'check-out', false],
  ['provider', 'reopen-checkout', false],
  ['provider', 'edit-checklist', false],
  ['provider', 'switch-practice', false],
  ['provider', 'book', false],

  ['office-manager', 'confirm', true],
  ['office-manager', 'check-in', true],
  ['office-manager', 'seat', true],
  ['office-manager', 'check-out', true],
  ['office-manager', 'reopen-checkout', true],
  ['office-manager', 'edit-checklist', true],
  ['office-manager', 'switch-practice', true],
  ['office-manager', 'book', true],
]

describe('can', () => {
  // Guards the table itself: adding a role or permission without test rows fails here.
  it('has exactly one row for every role × permission pair', () => {
    const pairs = matrix.map(([role, permission]) => `${role}:${permission}`)
    expect(new Set(pairs).size).toBe(pairs.length) // no duplicates
    expect(pairs).toHaveLength(ROLES.length * PERMISSIONS.length)
  })

  it.each(matrix)('%s → %s → %s', (role, permission, expected) => {
    expect(can(role, permission)).toBe(expected)
  })
})
