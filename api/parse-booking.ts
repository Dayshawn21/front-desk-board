import Anthropic from '@anthropic-ai/sdk'
import { handleParseBooking } from '../server/handler'
import { DEFAULT_MODEL, parseBookingRequest } from '../server/parseBooking'

// Vercel function: POST /api/parse-booking.
// It runs on the server, so ANTHROPIC_API_KEY never reaches the browser.
export async function POST(request: Request): Promise<Response> {
  const model = process.env.CLAUDE_MODEL || DEFAULT_MODEL
  return handleParseBooking(request, {
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    parse: (text, context) =>
      parseBookingRequest(new Anthropic().beta.messages, text, context, model),
  })
}
