import { createContext, useContext } from 'react'
import { can as canForRole, type Permission } from '../lib/permissions'
import type { Role } from '../types'

// Who is using the board and which practice they're looking at.
// In a real app this would come from the signed-in user; here an
// "Acting as" switcher sets it, and the README says so.
export type Session = {
  practiceId: string
  role: Role
  setPracticeId: (id: string) => void
  setRole: (role: Role) => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>')
  }
  // Bound to the current role, so components can write can('seat').
  const can = (permission: Permission) => canForRole(session.role, permission)
  return { ...session, can }
}
