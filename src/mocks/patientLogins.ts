import type { Patient } from '../types'
import { patients } from './seed'

// Demo logins for the made-up patients. Every patient's email comes from
// their name (owen.hart@example.com, on the reserved example.com domain, so
// it can never be a real inbox) and they all share one demo password, which
// the README lists. It lives with the mock server and is never sent to the
// browser's pages. A real server would store a slow hash of each patient's
// own password, never the password itself.
export const DEMO_PATIENT_PASSWORD = 'demo1234'

export function patientEmail(
  patient: Pick<Patient, 'firstName' | 'lastName'>,
): string {
  const part = (name: string) =>
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // drop accents: Tomás -> Tomas
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  return `${part(patient.firstName)}.${part(patient.lastName)}@example.com`
}

export type PatientLogin = {
  email: string
  password: string
  patientId: string
}

export const patientLogins: PatientLogin[] = patients.map((p) => ({
  email: patientEmail(p),
  password: DEMO_PATIENT_PASSWORD,
  patientId: p.id,
}))
