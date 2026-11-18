// Remembers who is signed in for this tab only (sessionStorage): a reload
// keeps you signed in, closing the tab signs you out. Storage can be
// blocked (private windows, strict settings), so every access is guarded
// and sign-in still works without it.
const KEY = 'front-desk-board.userId'

export function readRememberedUserId(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberUserId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Not remembered; the session still works until the page reloads.
  }
}
