import { useState } from 'react'
import type { Patient } from '../types'
import {
  type PatientSignIn,
  readPatientSignIn,
  rememberPatientSignIn,
} from '../session/patientStorage'

// The demo patient sign-in for one practice's pages. Patients belong to a
// practice, so someone signed in at Maple is signed out at Riverbend.
// `patients` is that practice's list: an id that isn't in it (stale
// storage, or a reset demo) also means signed out.
export function usePatientSignIn(practiceId: string, patients: Patient[]) {
  const [signedIn, setSignedIn] = useState<PatientSignIn | null>(
    readPatientSignIn,
  )

  const patient =
    signedIn?.practiceId === practiceId
      ? (patients.find((p) => p.id === signedIn.patientId) ?? null)
      : null

  const signIn = (patientId: string) => {
    const next = { practiceId, patientId }
    rememberPatientSignIn(next)
    setSignedIn(next)
  }

  const signOut = () => {
    rememberPatientSignIn(null)
    setSignedIn(null)
  }

  return { patient, signIn, signOut }
}
