import Anthropic from '@anthropic-ai/sdk'
import type { AssistContext, SanitizedDraft } from '../src/lib/assist.js'
import { chairs, patients, practices } from '../src/mocks/seed.js'
import { AssistError } from './parseBooking.js'

export const MAX_REQUEST_CHARS = 300

export type HandlerDeps = {
  hasApiKey: boolean
  parse: (text: string, context: AssistContext) => Promise<SanitizedDraft>
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

// The only data Claude sees: one practice's fake patients and chairs.
// (In a real app this would come from the database, for the signed-in tenant.)
export function buildContext(practiceId: string): AssistContext | null {
  const practice = practices.find((p) => p.id === practiceId)
  if (!practice) return null
  return {
    practiceName: practice.name,
    openTime: practice.openTime,
    closeTime: practice.closeTime,
    patients: patients
      .filter((p) => p.practiceId === practiceId)
      .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })),
    chairs: chairs
      .filter((c) => c.practiceId === practiceId)
      .map((c) => ({ id: c.id, name: c.name, provider: c.provider })),
  }
}

// POST /api/parse-booking  { practiceId, text } -> { draft, warnings }
export async function handleParseBooking(
  request: Request,
  deps: HandlerDeps,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Send JSON: { practiceId, text }.' })
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('practiceId' in body) ||
    !('text' in body) ||
    typeof body.practiceId !== 'string' ||
    typeof body.text !== 'string'
  ) {
    return json(400, { error: 'Send JSON: { practiceId, text }.' })
  }

  const text = body.text.trim()
  if (!text) return json(400, { error: 'Type a request first.' })
  if (text.length > MAX_REQUEST_CHARS) {
    return json(400, {
      error: `Keep the request under ${MAX_REQUEST_CHARS} characters.`,
    })
  }

  const context = buildContext(body.practiceId)
  if (!context) return json(404, { error: 'Unknown practice.' })

  if (!deps.hasApiKey) {
    return json(503, {
      error:
        'AI assist is not set up on this server (no API key). Fill in the form instead.',
    })
  }

  try {
    return json(200, await deps.parse(text, context))
  } catch (error) {
    if (error instanceof AssistError && error.kind === 'refusal') {
      return json(422, {
        error:
          "Claude couldn't help with that request. Fill in the form instead.",
      })
    }
    // Log the kind of failure for the server owner, never the details to the browser.
    console.error(
      'parse-booking failed:',
      error instanceof Anthropic.APIError
        ? `API ${error.status}`
        : error instanceof Error
          ? error.name
          : 'unknown',
    )
    return json(502, {
      error: 'AI assist is unavailable right now. Try again.',
    })
  }
}
