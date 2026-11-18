import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { SessionProvider } from '../session/SessionProvider'
import type { Role } from '../types'

// Every test gets a fresh, empty cache and its own session.
// Retries are off so error tests fail fast. Role defaults to front desk,
// the same as the real app.
export function renderWithQuery(
  ui: ReactElement,
  { role }: { role?: Role } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider initialRole={role}>{ui}</SessionProvider>
    </QueryClientProvider>,
  )
}
