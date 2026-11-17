import { QueryClient } from '@tanstack/react-query'

// A factory, not a single shared instance, so each test can get a fresh cache.
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // treat data as fresh for 30s; no refetch on every mount
        retry: 1, // one retry, then show the error state
        refetchOnWindowFocus: false, // keeps the demo calm while recording
      },
    },
  })
}