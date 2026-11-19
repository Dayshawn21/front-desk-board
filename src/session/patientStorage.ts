// Remembers which patient signed in on the patient pages, for this tab only
// (sessionStorage), like the staff sign-in: a reload keeps you signed in,
// closing the tab signs you out. Separate from the staff sign-in, so one
// never signs in or out the other. Storage can be blocked, so every access
// is guarded and sign-in still works until the page reloads.
const KEY = 'front-desk-board.patient'

export type PatientSignIn = { practiceId: string; patientId: string }

export function readPatientSignIn(): PatientSignIn | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    // Edited or stale storage just means signed out.
    if (
      typeof value === 'object' &&
      value !== null &&
      'practiceId' in value &&
      'patientId' in value &&
      typeof value.practiceId === 'string' &&
      typeof value.patientId === 'string'
    ) {
      return { practiceId: value.practiceId, patientId: value.patientId }
    }
    return null
  } catch {
    return null
  }
}

export function rememberPatientSignIn(value: PatientSignIn | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Not remembered; the sign-in still works until the page reloads.
  }
}
