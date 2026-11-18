import { type ReactNode, useState } from 'react'
import { findUser } from '../mocks/users'
import type { Role } from '../types'
import { SessionContext } from './SessionContext'

type SessionProviderProps = {
  children: ReactNode
  // A demo user id to start signed in as, null to start signed out, or
  // undefined to restore the user remembered in this tab.
  initialUserId?: string | null
  initialPracticeId?: string
}

export function SessionProvider({
  children,
  initialUserId,
  initialPracticeId = 'maple',
}: SessionProviderProps) {
  // Red-step stub: still role-only, no sign-in yet.
  const startRole: Role =
    (initialUserId && findUser(initialUserId)?.role) || 'front-desk'
  const [role, setRole] = useState<Role>(startRole)
  const [practiceId, setPracticeId] = useState(initialPracticeId)

  return (
    <SessionContext.Provider
      value={{ role, setRole, practiceId, setPracticeId }}
    >
      {children}
    </SessionContext.Provider>
  )
}
