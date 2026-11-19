// The app's few pages, read from the URL path. No router package: three
// kinds of page don't need one. On Vercel, vercel.json sends these paths to
// index.html; `vite preview` and the dev server already do.
//
//   /                 the staff board (sign-in first)
//   /book/<practice>  a patient books a visit online (/book: the first practice)
//   anything else     the staff board

export type Route =
  | { page: 'board' }
  | { page: 'book'; practiceId: string }
  | { page: 'check-in'; practiceId: string; visitId: string }

// Where a bare /book goes: the demo's first practice.
const DEFAULT_PRACTICE_ID = 'maple'

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] === 'book' && parts.length <= 2) {
    return { page: 'book', practiceId: parts[1] ?? DEFAULT_PRACTICE_ID }
  }
  return { page: 'board' }
}

export function bookingPath(practiceId: string): string {
  return `/book/${encodeURIComponent(practiceId)}`
}

// Stub; implemented in the next commit.
export function checkInPath(practiceId: string, visitId: string): string {
  void practiceId
  void visitId
  return '/'
}
