import type { Role } from '../types'

export type Permission =
  | 'confirm'
  | 'check-in'
  | 'seat'
  | 'check-out'
  | 'reopen-checkout'
  | 'edit-checklist'
  | 'switch-practice'

// Stub for TDD: the tests are written first and must fail against this.
export function can(_role: Role, _permission: Permission): boolean {
  throw new Error('Not implemented')
}
