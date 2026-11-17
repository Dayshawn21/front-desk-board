import { useQuery } from '@tanstack/react-query'
import { fetchPractices, fetchSchedule } from '../api/schedule'

// Query keys in one place so mutations (Day 2) can invalidate the right cache.
export const queryKeys = {
  practices: ['practices'] as const,
  schedule: (practiceId: string, date: string) =>
    ['schedule', practiceId, date] as const,
}

export function usePractices() {
  return useQuery({
    queryKey: queryKeys.practices,
    queryFn: fetchPractices,
    staleTime: Infinity, // the practice list doesn't change during a session
  })
}

export function useSchedule(practiceId: string, date: string) {
  return useQuery({
    queryKey: queryKeys.schedule(practiceId, date),
    queryFn: () => fetchSchedule(practiceId, date),
  })
}
