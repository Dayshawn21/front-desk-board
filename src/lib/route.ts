// The app's few pages, read from the URL path. No router package: three
// kinds of page don't need one. On Vercel, vercel.json sends these paths to
// index.html; `vite preview` and the dev server already do.
//
//   /                 the staff board (sign-in first)
//   /book/<practice>  a patient books a visit online (/book: the first practice)
//   /check-in/<practice>/<visit>  a patient checks in from their phone
//   anything else     the staff board

export type Route =
  | { page: 'board' }
  | { page: 'book'; practiceId: string }
  | { page: 'choose-practice' } // stub; built in the next commit
  | { page: 'check-in'; practiceId: string; visitId: string }

// Where a bare /book goes: the demo's first practice.
const DEFAULT_PRACTICE_ID = 'maple'

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'book' && parts.length <= 2) {
    return { page: 'book', practiceId: parts[1] ?? DEFAULT_PRACTICE_ID }
  }
  if (parts[0] === 'check-in' && parts.length === 3) {
    return { page: 'check-in', practiceId: parts[1], visitId: parts[2] }
  }
  return { page: 'board' }
}

export function bookingPath(practiceId: string): string {
  return `/book/${encodeURIComponent(practiceId)}`
}

// The link a patient opens on arrival. In a real system it would carry a
// signed, expiring token instead of the visit id, so it can't be guessed.
export function checkInPath(practiceId: string, visitId: string): string {
  return `/check-in/${encodeURIComponent(practiceId)}/${encodeURIComponent(visitId)}`
}
