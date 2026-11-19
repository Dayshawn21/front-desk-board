import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  bookMyVisit,
  checkInMyVisit,
  fetchMyAccount,
  fetchOpenTimes,
  patientSignIn,
  patientSignOut,
  type MyBooking,
  type MyCheckIn,
} from '../api/patientPortal'
import { ApiError } from '../api/schedule'
import { checkSignInGate } from '../api/signInGate'
import { DEMO_DATE, DEMO_NOW } from '../config'
import {
  readPatientToken,
  rememberPatientToken,
} from '../session/patientStorage'

export const patientKeys = {
  all: ['patient'] as const, // everything on the patient side
  account: (token: string) => ['patient', 'account', token] as const,
  openTimes: (practiceId: string, minutes: number) =>
    ['patient', 'open-times', practiceId, minutes] as const,
}

const isSignedOut = (error: unknown) =>
  error instanceof ApiError && error.status === 401

// The patient's session on the patient pages: the token from sign-in, and
// the account it unlocks (their details and today's visits, from the
// server). A token the server no longer knows (signed out elsewhere, or
// the demo data was reset) means signed out.
export function usePatientSession() {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(readPatientToken)

  const account = useQuery({
    queryKey: patientKeys.account(token ?? ''),
    queryFn: () => fetchMyAccount(token ?? '', DEMO_DATE),
    enabled: token !== null,
    // Don't retry a 401: the answer won't change.
    retry: (count, error) => !isSignedOut(error) && count < 2,
  })

  const signInMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      // The per-IP limit, on our server route, before the password check.
      await checkSignInGate()
      return patientSignIn(email, password)
    },
    onSuccess: ({ token: next }) => {
      rememberPatientToken(next)
      setToken(next)
    },
  })

  const signOut = () => {
    if (token) void patientSignOut(token).catch(() => {})
    signInMutation.reset()
    rememberPatientToken(null)
    setToken(null)
    // Drop the patient's data, so the next person on this phone never
    // sees it, even for a moment.
    queryClient.removeQueries({ queryKey: [...patientKeys.all, 'account'] })
  }

  // The server no longer knows the token (signed out in another tab, or
  // the demo data was reset): treat it as signed out, and forget it.
  const expired = token !== null && isSignedOut(account.error)
  useEffect(() => {
    if (expired) rememberPatientToken(null)
  }, [expired])

  return {
    token: expired ? null : token, // null: signed out
    account,
    signIn: signInMutation,
    signOut,
    sessionEnded: expired, // say "Please sign in again" on the form
  }
}

export function useOpenTimes(practiceId: string, minutes: number | null) {
  return useQuery({
    queryKey: patientKeys.openTimes(practiceId, minutes ?? 0),
    queryFn: () =>
      fetchOpenTimes(practiceId, DEMO_DATE, minutes ?? 0, DEMO_NOW),
    enabled: minutes !== null,
  })
}

export function useBookMyVisit(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (booking: MyBooking) => bookMyVisit(token, booking),
    // On success AND on error: a 409 means the open times changed.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  })
}

export function useCheckInMyVisit(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: MyCheckIn }) =>
      checkInMyVisit(token, id, change),
    // Returned, so mutateAsync resolves after the account has refetched.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: patientKeys.all }),
  })
}
