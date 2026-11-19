// The app's few pages, read from the URL path. No router package: six
// kinds of page don't need one. On Vercel, vercel.json sends these paths to
// index.html; `vite preview` and the dev server already do.
//
//   /                 the staff board (sign-in first)
//   /book             a patient chooses their dental office
//   /book/<practice>  a patient books a visit online
//   /check-in/<practice>/<visit>  a patient checks in from their phone
//   /patient          a patient chooses their office to sign in
//   /patient/<practice>  a patient signs in, then sees today's visits
//   anything else     the staff board

export type Route =
  | { page: 'board' }
  | { page: 'book'; practiceId: string }
  | { page: 'choose-practice' }
  | { page: 'check-in'; practiceId: string; visitId: string }
  | { page: 'patient-choose-practice' }
  | { page: 'patient-home'; practiceId: string }

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'book' && parts.length === 1) {
    return { page: 'choose-practice' }
  }
  if (parts[0] === 'book' && parts.length === 2) {
    return { page: 'book', practiceId: parts[1] }
  }
  if (parts[0] === 'check-in' && parts.length === 3) {
    return { page: 'check-in', practiceId: parts[1], visitId: parts[2] }
  }
  if (parts[0] === 'patient' && parts.length === 1) {
    return { page: 'patient-choose-practice' }
  }
  if (parts[0] === 'patient' && parts.length === 2) {
    return { page: 'patient-home', practiceId: parts[1] }
  }
  return { page: 'board' }
}

// Where a patient starts: the list of practices.
export const CHOOSE_PRACTICE_PATH = '/book'

export function bookingPath(practiceId: string): string {
  return `/book/${encodeURIComponent(practiceId)}`
}

// The link a patient opens on arrival. In a real system it would carry a
// signed, expiring token instead of the visit id, so it can't be guessed.
export function checkInPath(practiceId: string, visitId: string): string {
  return `/check-in/${encodeURIComponent(practiceId)}/${encodeURIComponent(visitId)}`
}

// Where a patient signs in: the list of practices, then the practice's
// patient page (sign-in, then "Your visits").
export const PATIENT_SIGN_IN_PATH = '/patient'

export function patientHomePath(practiceId: string): string {
  return `/patient/${encodeURIComponent(practiceId)}`
}
