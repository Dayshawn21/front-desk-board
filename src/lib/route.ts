// The app's few pages, read from the URL path. No router package: a
// handful of pages don't need one. On Vercel, vercel.json sends these paths to
// index.html; `vite preview` and the dev server already do.
//
//   /                 the staff board (sign-in first)
//   /book             a patient chooses their dental office
//   /book/<practice>  a patient books a visit online
//   /check-in/<practice>/<visit>  a patient checks in from their phone
//   /patient          a patient signs in, then sees today's visits
//   /patient/sign-up  a new patient creates an account
//   /patient/forgot-password  ask for a password reset link
//   /patient/reset-password?token=…  choose a new password
//   /patient/demo-inbox  the emails the demo "sent" (no real email)
//   /patient/change-password  a signed-in patient changes their password
//   anything else     the staff board

export type Route =
  | { page: 'board' }
  | { page: 'book'; practiceId: string }
  | { page: 'choose-practice' }
  | { page: 'check-in'; practiceId: string; visitId: string }
  | { page: 'patient-home' }
  | { page: 'patient-sign-up' }
  | { page: 'patient-forgot-password' }
  | { page: 'patient-reset-password' }
  | { page: 'patient-demo-inbox' }
  | { page: 'patient-change-password' }

// Patient pages with no parameters in the path.
type PatientSubpage = Extract<
  Route['page'],
  | 'patient-sign-up'
  | 'patient-forgot-password'
  | 'patient-reset-password'
  | 'patient-demo-inbox'
  | 'patient-change-password'
>

const PATIENT_SUBPAGES: Record<string, PatientSubpage | undefined> = {
  'sign-up': 'patient-sign-up',
  'forgot-password': 'patient-forgot-password',
  'reset-password': 'patient-reset-password',
  'demo-inbox': 'patient-demo-inbox',
  'change-password': 'patient-change-password',
}

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
    return { page: 'patient-home' }
  }
  if (parts[0] === 'patient' && parts.length === 2) {
    // hasOwn: not "constructor" or other names every object has
    const page = Object.hasOwn(PATIENT_SUBPAGES, parts[1])
      ? PATIENT_SUBPAGES[parts[1]]
      : undefined
    if (page) return { page }
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

// Where a patient signs in and sees their visits. The sign-in says which
// office they belong to, so the path doesn't need to.
export const PATIENT_HOME_PATH = '/patient'

export const PATIENT_SIGN_UP_PATH = '/patient/sign-up'
export const FORGOT_PASSWORD_PATH = '/patient/forgot-password'
export const DEMO_INBOX_PATH = '/patient/demo-inbox'
export const CHANGE_PASSWORD_PATH = '/patient/change-password'
