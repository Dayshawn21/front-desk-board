import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { findUser } from '../mocks/users'
import type { StaffUser } from '../types'
import { SessionContext } from './SessionContext'
import { readRememberedUserId, rememberUserId } from './storage'

type SessionProviderProps = {
  children: ReactNode
  // A demo user id to start signed in as, null to start signed out, or
  // undefined to restore the user remembered in this tab.
  initialUserId?: string | null
}

export function SessionProvider({
  children,
  initialUserId,
}: SessionProviderProps) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<StaffUser | null>(() => {
    const id =
      initialUserId === undefined ? readRememberedUserId() : initialUserId
    // An unknown id (stale or edited storage) just means signed out.
    return (id && findUser(id)) || null
  })
  const [practiceId, setPracticeId] = useState(user?.practiceId ?? 'maple')

  const signIn = (userId: string) => {
    const next = findUser(userId)
    if (!next) throw new Error(`Unknown demo user: ${userId}`)
    rememberUserId(next.id)
    setPracticeId(next.practiceId) // everyone starts at their home practice
    setUser(next)
  }

  const signOut = () => {
    rememberUserId(null)
    setUser(null)
    // Drop every cached query so the next person to sign in on this
    // screen never sees the previous user's data, even for a moment.
    queryClient.clear()
  }

  // No useMemo on the value: this provider sits at the root, so it only
  // re-renders when the user or practice change, which is exactly when
  // consumers should update. Memoizing would add code without benefit.
  return (
    <SessionContext.Provider
      value={{ user, practiceId, signIn, signOut, setPracticeId }}
    >
      {children}
    </SessionContext.Provider>
  )
}
