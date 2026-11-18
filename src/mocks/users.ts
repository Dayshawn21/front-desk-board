import type { Role, StaffUser } from '../types'

// FAKE DATA ONLY. The three demo staff accounts, one per role.
// There are no passwords: the sign-in page lets you pick one, and the
// README says a real app would sign in through an identity provider.
export const users: StaffUser[] = [
  {
    id: 'u-rosa',
    name: 'Rosa Jimenez',
    role: 'front-desk',
    practiceId: 'maple',
  },
  {
    id: 'u-okafor',
    name: 'Dr. Amara Okafor',
    role: 'provider',
    practiceId: 'maple',
  },
  {
    id: 'u-theo',
    name: 'Theo Grant',
    role: 'office-manager',
    practiceId: 'maple',
  },
]

export function findUser(id: string): StaffUser | undefined {
  return users.find((u) => u.id === id)
}

export function userForRole(role: Role): StaffUser {
  const user = users.find((u) => u.role === role)
  if (!user) throw new Error(`No demo user for role: ${role}`)
  return user
}
