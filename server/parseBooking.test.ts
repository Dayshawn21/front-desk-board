// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { AssistContext } from '../src/lib/assist'
import {
  AssistError,
  DEFAULT_MODEL,
  type MessagesClient,
  parseBookingRequest,
} from './parseBooking'

const context: AssistContext = {
  practiceName: 'Maple Street Dental',
  openTime: '08:00',
  closeTime: '17:00',
  patients: [{ id: 'p-ana', name: 'Ana Diaz' }],
  chairs: [{ id: 'maple-c2', name: 'Chair 2', provider: 'Hygienist Patel' }],
}

const answer = {
  patientId: 'p-ana',
  visitType: 'cleaning',
  durationMinutes: 60,
  chairId: 'maple-c2',
  timeOfDay: 'afternoon',
  earliest: null,
  notUsed: [],
}

// A stand-in for client.beta.messages that records what it was sent.
function fakeClient(response: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = []
  const client = {
    create: async (params: Record<string, unknown>) => {
      calls.push(params)
      return response
    },
  } as unknown as MessagesClient
  return { client, calls }
}

const ok = (json: unknown) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(json) }],
})

describe('parseBookingRequest', () => {
  it('returns the checked draft from Claude’s JSON answer', async () => {
    const { client } = fakeClient(ok(answer))

    const result = await parseBookingRequest(
      client,
      'Cleaning for Ana this afternoon',
      context,
    )

    expect(result.draft).toMatchObject({
      patientId: 'p-ana',
      visitType: 'cleaning',
      chairId: 'maple-c2',
    })
  })

  it('asks for JSON in a fixed schema, at low effort, with refusal fallbacks', async () => {
    const { client, calls } = fakeClient(ok(answer))

    await parseBookingRequest(client, 'Cleaning for Ana', context)

    const params = calls[0]
    expect(params).toMatchObject({
      model: DEFAULT_MODEL,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: { type: 'json_schema' },
      },
    })
    expect(params.max_tokens).toBeLessThanOrEqual(4096)
  })

  it('sends the request text as data, with only this practice’s list', async () => {
    const { client, calls } = fakeClient(ok(answer))

    await parseBookingRequest(client, 'Cleaning for Ana', context)

    const sent = JSON.stringify(calls[0].messages)
    expect(sent).toContain('Cleaning for Ana')
    expect(sent).toContain('p-ana')
    expect(sent).toContain('maple-c2')
    expect(String(calls[0].system)).toMatch(/only.*(list|ids)/i)
  })

  it('uses another model when asked (for the eval)', async () => {
    const { client, calls } = fakeClient(ok(answer))

    await parseBookingRequest(client, 'x', context, 'claude-haiku-5-5')

    expect(calls[0].model).toBe('claude-haiku-5-5')
  })

  it('reports a refusal instead of reading the content', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', content: [] })

    await expect(
      parseBookingRequest(client, 'x', context),
    ).rejects.toMatchObject({ kind: 'refusal' })
  })

  it('reports output that was cut off or is not valid JSON', async () => {
    const cut = fakeClient({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"patientId": "p-a' }],
    })
    await expect(
      parseBookingRequest(cut.client, 'x', context),
    ).rejects.toBeInstanceOf(AssistError)

    const junk = fakeClient({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Sure! Ana at 2pm.' }],
    })
    await expect(
      parseBookingRequest(junk.client, 'x', context),
    ).rejects.toMatchObject({ kind: 'bad-output' })
  })

  it('drops an invented patient id from Claude’s answer', async () => {
    const { client } = fakeClient(ok({ ...answer, patientId: 'p-made-up' }))

    const result = await parseBookingRequest(client, 'x', context)

    expect(result.draft.patientId).toBeNull()
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
