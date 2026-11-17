import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPractices,
  fetchSchedule,
  updateAppointment,
  type AppointmentPatch,
} from '../api/schedule'

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

export function useUpdateAppointment(practiceId: string, date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AppointmentPatch }) =>
      updateAppointment(practiceId, id, patch),
    // After a save, mark this practice's schedule stale so the grid,
    // the drawer and (later) the flow view all refetch the new data.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(practiceId, date),
      }),
  })
}
