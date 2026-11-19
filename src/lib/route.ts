// Stub; implemented in the next commit.
export type Route = { page: 'board' } | { page: 'book'; practiceId: string }

export function parseRoute(pathname: string): Route {
  void pathname
  return { page: 'board' }
}

export function bookingPath(practiceId: string): string {
  void practiceId
  return '/'
}
