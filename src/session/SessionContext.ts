import { createContext, useContext } from 'react'
import { can as canForRole, type Permission } from '../lib/permissions'
import type { StaffUser } from '../types'

// Who is signed in and which practice they're looking at.
// Sign-in is mocked: you pick one of three demo users (README says so).
export type SessionState = {
  user: StaffUser | null
  practiceId: string
  signIn: (userId: string) => void
  signOut: () => void
  setPracticeId: (id: string) => void
}

export const SessionContext = createContext<SessionState | null>(null)

function useSessionState() {
  const session = useContext(SessionContext)
  if (!session) {
    throw new Error('Session hooks must be used inside <SessionProvider>')
  }
  return session
}

// Works signed in or out: for the sign-in page and the top-level App.
export function useAuth() {
  const { user, signIn, signOut } = useSessionState()
  return { user, signIn, signOut }
}

// For screens behind sign-in. Throws if nobody is signed in, so the board
// can never render with a missing role.
export function useSession() {
  const { user, ...rest } = useSessionState()
  if (!user) {
    throw new Error('useSession needs a signed-in user')
  }
  // Bound to the current role, so components can write can('seat').
  const can = (permission: Permission) => canForRole(user.role, permission)
  return { ...rest, user, role: user.role, can }
}
