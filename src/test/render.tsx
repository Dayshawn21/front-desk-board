import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { userForRole } from '../mocks/users'
import { SessionProvider } from '../session/SessionProvider'
import type { Role } from '../types'

type RenderOptions = {
  role?: Role // signed in as that role's demo user (default front desk)
  signedOut?: boolean // start on the sign-in page
  restoreSession?: boolean // read the remembered user, like a page reload
}

// Every test gets a fresh, empty cache and its own session.
// Retries are off so error tests fail fast.
export function renderWithQuery(
  ui: ReactElement,
  { role = 'front-desk', signedOut, restoreSession }: RenderOptions = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const initialUserId = restoreSession
    ? undefined
    : signedOut
      ? null
      : userForRole(role).id
  const result = render(
    <QueryClientProvider client={client}>
      <SessionProvider initialUserId={initialUserId}>{ui}</SessionProvider>
    </QueryClientProvider>,
  )
  return { ...result, client }
}
