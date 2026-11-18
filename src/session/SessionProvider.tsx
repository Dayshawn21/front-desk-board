import { type ReactNode, useState } from 'react'
import type { Role } from '../types'
import { SessionContext } from './SessionContext'

type SessionProviderProps = {
  children: ReactNode
  initialRole?: Role
  initialPracticeId?: string
}

export function SessionProvider({
  children,
  initialRole = 'front-desk',
  initialPracticeId = 'maple',
}: SessionProviderProps) {
  const [role, setRole] = useState<Role>(initialRole)
  const [practiceId, setPracticeId] = useState(initialPracticeId)

  // No useMemo on the value: this provider sits at the root, so it only
  // re-renders when role or practice change, which is exactly when consumers
  // should update. Memoizing would add code without measurable benefit.
  return (
    <SessionContext.Provider
      value={{ role, setRole, practiceId, setPracticeId }}
    >
      {children}
    </SessionContext.Provider>
  )
}
