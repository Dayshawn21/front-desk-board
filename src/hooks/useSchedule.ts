import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { parseBookingText } from '../api/assist'
import {
  createAppointment,
  fetchPractices,
  fetchSchedule,
  moveAppointment,
  recordPayment,
  resetDemoData,
  subscribeToMockDb,
  updateAppointment,
  voidPayment,
  type AppointmentPatch,
  type MoveTo,
  type NewAppointment,
  type NewPayment,
} from '../api/schedule'

// Query keys in one place so mutations (Day 2) can invalidate the right cache.
export const queryKeys = {
  practices: ['practices'] as const,
  allSchedules: ['schedule'] as const, // every practice and day
  patient: ['patient'] as const, // the patient pages (usePatientSession)
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

// Moving a visit. Refetch on success AND on error: a 409 means someone took
// the time, so the offered times need fresh data either way.
export function useMoveAppointment(practiceId: string, date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: MoveTo }) =>
      moveAppointment(practiceId, id, to),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(practiceId, date),
      }),
  })
}

// Payments at checkout (pretend only). After a save the schedule refetches,
// which brings the new payment and the ticked Copay collected box with it.
export function useRecordPayment(practiceId: string, date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NewPayment }) =>
      recordPayment(practiceId, id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(practiceId, date),
      }),
  })
}

export function useVoidPayment(practiceId: string, date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) => voidPayment(practiceId, paymentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(practiceId, date),
      }),
  })
}

export function useCreateAppointment(practiceId: string, date: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewAppointment) => createAppointment(practiceId, input),
    // Refetch on success AND on error: a 409 means the schedule changed
    // under us, so the suggested times need fresh data either way.
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.schedule(practiceId, date),
      }),
  })
}

// AI assist: free text -> form fields. Not cached (each request is new) and
// not retried automatically, since each try calls Claude and costs money.
export function useParseBooking(practiceId: string) {
  return useMutation({
    mutationFn: (text: string) => parseBookingText(practiceId, text),
  })
}

// When another tab changes the shared mock db (a patient books online, the
// desk in another tab checks someone in), mark every cached schedule stale,
// so whatever is on screen refetches. With a real server this would be a
// WebSocket or SSE message saying which practice changed.
export function useLiveScheduleUpdates() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      subscribeToMockDb(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.allSchedules })
        // The patient pages too: their visits and the open times.
        void queryClient.invalidateQueries({ queryKey: queryKeys.patient })
      }),
    [queryClient],
  )
}

// Reset demo data: the seed comes back in every tab (the others hear it
// through the storage event; this tab refetches here).
export function useResetDemoData() {
  const queryClient = useQueryClient()
  return () => {
    resetDemoData()
    void queryClient.invalidateQueries({ queryKey: queryKeys.allSchedules })
    void queryClient.invalidateQueries({ queryKey: queryKeys.patient })
  }
}
