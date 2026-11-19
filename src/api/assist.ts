import type { SanitizedDraft } from '../lib/assist'
import { ApiError } from './schedule'

const FALLBACK_ERROR = 'AI assist is unavailable right now. Try again.'

// Calls our own serverless route. The Claude API key lives on the server;
// the browser only sends the practice id and the typed request.
export async function parseBookingText(
  practiceId: string,
  text: string,
): Promise<SanitizedDraft> {
  const response = await fetch('/api/parse-booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ practiceId, text }),
  })

  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Not JSON (e.g. a proxy error page). Fall through to the generic message.
  }

  // Vercel's firewall rate limit answers 429 before our route runs.
  if (response.status === 429) {
    throw new ApiError('Too many requests. Wait a minute and try again.', 429)
  }
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : FALLBACK_ERROR
    throw new ApiError(message, response.status)
  }
  if (typeof body !== 'object' || body === null || !('draft' in body)) {
    throw new ApiError(FALLBACK_ERROR, 502)
  }
  return body as SanitizedDraft
}
