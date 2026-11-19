import type Anthropic from '@anthropic-ai/sdk'
import type { AssistContext, SanitizedDraft } from '../src/lib/assist'

// One place to change the model; the eval can compare others via CLAUDE_MODEL.
export const DEFAULT_MODEL = 'claude-opus-5-5'

// Only the part of the SDK this file uses, so tests can pass a fake.
export type MessagesClient = Pick<Anthropic['beta']['messages'], 'create'>

export class AssistError extends Error {
  kind: 'refusal' | 'bad-output'
  constructor(kind: 'refusal' | 'bad-output', message: string) {
    super(message)
    this.name = 'AssistError'
    this.kind = kind
  }
}

export async function parseBookingRequest(
  _client: MessagesClient,
  _text: string,
  _context: AssistContext,
  _model: string = DEFAULT_MODEL,
): Promise<SanitizedDraft> {
  throw new Error('parseBookingRequest: not implemented')
}
