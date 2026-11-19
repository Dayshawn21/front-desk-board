// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import type { SanitizedDraft } from '../src/lib/assist'
import { handleParseBooking, type HandlerDeps } from './handler'
import { AssistError } from './parseBooking'

const result: SanitizedDraft = {
  draft: {
    patientId: 'p-ana',
    visitType: 'cleaning',
    durationMinutes: 60,
    chairId: null,
    timeOfDay: 'afternoon',
    earliest: null,
    notUsed: [],
  },
  warnings: [],
}

const post = (body: unknown) =>
  new Request('http://localhost/api/parse-booking', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  return { hasApiKey: true, parse: vi.fn(async () => result), ...overrides }
}

async function call(body: unknown, d = deps()) {
  const response = await handleParseBooking(post(body), d)
  const json = (await response.json()) as { error?: string }
  return { status: response.status, json }
}

describe('handleParseBooking', () => {
  it('returns the draft for a valid request', async () => {
    const d = deps()
    const { status, json } = await call(
      { practiceId: 'maple', text: 'Cleaning for Ana this afternoon' },
      d,
    )

    expect(status).toBe(200)
    expect(json).toEqual(result)
    // Claude only sees this practice's fake patients and chairs.
    const context = vi.mocked(d.parse).mock.calls[0][1]
    expect(context.practiceName).toBe('Maple Street Dental')
    expect(context.patients.map((p) => p.id)).toContain('p-ana')
    expect(context.patients.map((p) => p.id)).not.toContain('p-hana')
    expect(context.chairs.map((c) => c.id)).toEqual([
      'maple-c1',
      'maple-c2',
      'maple-c3',
    ])
  })

  it('rejects a body that is not JSON or is missing fields (400)', async () => {
    expect((await call('not json')).status).toBe(400)
    expect((await call({ practiceId: 'maple' })).status).toBe(400)
    expect((await call({ practiceId: 'maple', text: '   ' })).status).toBe(400)
  })

  it('rejects requests over 300 characters without calling Claude (400)', async () => {
    const d = deps()
    const { status, json } = await call(
      { practiceId: 'maple', text: 'a'.repeat(301) },
      d,
    )

    expect(status).toBe(400)
    expect(json.error).toMatch(/300 characters/i)
    expect(d.parse).not.toHaveBeenCalled()
  })

  it('rejects an unknown practice (404)', async () => {
    expect((await call({ practiceId: 'nope', text: 'x' })).status).toBe(404)
  })

  it('says AI assist is not set up when the server has no API key (503)', async () => {
    const { status, json } = await call(
      { practiceId: 'maple', text: 'x' },
      deps({ hasApiKey: false }),
    )

    expect(status).toBe(503)
    expect(json.error).toMatch(/not set up/i)
  })

  it('turns a refusal into a plain message (422)', async () => {
    const { status, json } = await call(
      { practiceId: 'maple', text: 'x' },
      deps({
        parse: async () => {
          throw new AssistError('refusal', 'declined')
        },
      }),
    )

    expect(status).toBe(422)
    expect(json.error).toMatch(/fill in the form/i)
  })

  it('turns unreadable output or an API failure into a retryable error (502)', async () => {
    const badOutput = await call(
      { practiceId: 'maple', text: 'x' },
      deps({
        parse: async () => {
          throw new AssistError('bad-output', 'junk')
        },
      }),
    )
    expect(badOutput.status).toBe(502)

    const apiDown = await call(
      { practiceId: 'maple', text: 'x' },
      deps({
        parse: async () => {
          throw new Anthropic.InternalServerError(
            500,
            undefined,
            'boom',
            new Headers(),
          )
        },
      }),
    )
    expect(apiDown.status).toBe(502)
    expect(apiDown.json.error).toMatch(/try again/i)
    // Never leak internal error details to the browser.
    expect(apiDown.json.error).not.toMatch(/boom/)
  })
})
