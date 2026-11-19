import type { AssistContext, SanitizedDraft } from '../src/lib/assist'

export const MAX_REQUEST_CHARS = 300

export type HandlerDeps = {
  hasApiKey: boolean
  parse: (text: string, context: AssistContext) => Promise<SanitizedDraft>
}

// POST /api/parse-booking  { practiceId, text } -> { draft, warnings }
export async function handleParseBooking(
  _request: Request,
  _deps: HandlerDeps,
): Promise<Response> {
  throw new Error('handleParseBooking: not implemented')
}
