import { ApiError } from './schedule'

const PLAIN_LIMIT =
  'Too many sign-in attempts from your network. Wait a few minutes and try again.'

// Asks our server route (POST /api/patient-sign-in) before each patient
// sign-in try. The route counts tries per IP address and answers 429 over
// the limit (or the Vercel firewall does, before the route runs). Nothing
// about the patient is sent: no email, no password.
//
// Anything but a 429 lets the try go on. A static preview (and the unit
// tests) has no API routes, so the route answers 404 or can't be reached;
// failing open keeps sign-in working there. This only shows the pattern:
// the password check itself runs in the browser in this demo, so a
// determined visitor could skip the route. A real server checks the IP
// limit and the password in the same request.
export async function checkSignInGate(): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/patient-sign-in', { method: 'POST' })
  } catch {
    return // unreachable: fail open (see above)
  }
  if (response.status !== 429) return

  let message = PLAIN_LIMIT
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
    ) {
      message = body.error
    }
  } catch {
    // The firewall's 429 has no JSON body: keep the plain message.
  }
  throw new ApiError(message, 429)
}
