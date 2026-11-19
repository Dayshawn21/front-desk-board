import type { SanitizedDraft } from '../lib/assist'
import { ApiError } from './schedule'

// Calls our own serverless route. The Claude API key lives on the server;
// the browser only sends the practice id and the typed request.
export async function parseBookingText(
  _practiceId: string,
  _text: string,
): Promise<SanitizedDraft> {
  throw new ApiError('parseBookingText: not implemented', 500)
}
