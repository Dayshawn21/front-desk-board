import type { Role } from '../types'

// One source for both the runtime list and the type.
// `as const` keeps the exact strings; `[number]` turns the array into a union.
export const PERMISSIONS = [
  'confirm',
  'check-in',
  'seat',
  'check-out',
  'reopen-checkout',
  'edit-checklist',
  'switch-practice',
  'book',
] as const

export type Permission = (typeof PERMISSIONS)[number]

// The whole policy in one table: which roles hold each permission.
// Record<Permission, …> makes TypeScript require a row for every permission.
//
// UI permissions are a convenience, not security: they hide buttons a role
// can't use. A real server would enforce the same rules on every request.
const rules: Record<Permission, Role[]> = {
  confirm: ['front-desk', 'office-manager'],
  'check-in': ['front-desk', 'office-manager'],
  seat: ['provider', 'office-manager'],
  'check-out': ['front-desk', 'office-manager'],
  'reopen-checkout': ['office-manager'],
  'edit-checklist': ['front-desk', 'office-manager'],
  'switch-practice': ['office-manager'],
  book: ['front-desk', 'office-manager'],
}

export function can(role: Role, permission: Permission): boolean {
  return rules[permission].includes(role)
}
