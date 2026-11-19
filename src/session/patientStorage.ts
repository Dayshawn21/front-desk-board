// Remembers the signed-in patient's session token for this tab only
// (sessionStorage), like the staff sign-in: a reload keeps you signed in,
// closing the tab signs you out. Only the token is kept; the server says
// whose it is. Separate from the staff sign-in, so one never signs in or
// out the other. Storage can be blocked, so every access is guarded and
// sign-in still works until the page reloads.
const KEY = 'front-desk-board.patient-session'

export function readPatientToken(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberPatientToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Not remembered; the sign-in still works until the page reloads.
  }
}
