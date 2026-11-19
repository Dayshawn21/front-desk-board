// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  clientIp,
  createSignInGate,
  handleSignInAttempt,
  SIGN_IN_IP_LIMIT,
} from './signInGate'

// POST /api/patient-sign-in: every patient sign-in try passes through
// here first, and it allows at most 20 tries per IP address in 15 minutes.

const MINUTE = 60_000

function attempt(headers: Record<string, string> = {}, method = 'POST') {
  return new Request('http://localhost/api/patient-sign-in', {
    method,
    headers: { 'x-real-ip': '203.0.113.7', ...headers },
  })
}

function gateAt(start = 0) {
  let now = start
  const gate = createSignInGate({ now: () => now })
  return {
    gate,
    advance: (ms: number) => {
      now += ms
    },
  }
}

async function call(
  gate: ReturnType<typeof createSignInGate>,
  request = attempt(),
) {
  const response = await handleSignInAttempt(request, gate)
  const body = response.status === 204 ? null : await response.json()
  return { response, status: response.status, body }
}

describe('the per-IP sign-in limit', () => {
  it('is 20 tries per IP in 15 minutes', () => {
    expect(SIGN_IN_IP_LIMIT).toEqual({ tries: 20, windowMs: 15 * MINUTE })
  })

  it('lets tries through up to the limit, then answers 429', async () => {
    const { gate } = gateAt()
    for (let i = 0; i < 20; i++) {
      expect((await call(gate)).status).toBe(204)
    }
    const blocked = await call(gate)
    expect(blocked.status).toBe(429)
    expect(blocked.body).toEqual({
      error:
        'Too many sign-in attempts from your network. Try again in 15 minutes.',
    })
    expect(blocked.response.headers.get('retry-after')).toBe('900')
  })

  it('counts each IP on its own', async () => {
    const { gate } = gateAt()
    for (let i = 0; i < 21; i++) await call(gate)
    expect(
      (await call(gate, attempt({ 'x-real-ip': '198.51.100.4' }))).status,
    ).toBe(204)
  })

  it('opens again as old tries age out, and says how long is left', async () => {
    const { gate, advance } = gateAt()
    for (let i = 0; i < 20; i++) await call(gate)
    advance(10 * MINUTE)
    const blocked = await call(gate)
    expect(blocked.body.error).toMatch(/Try again in 5 minutes/)
    expect(blocked.response.headers.get('retry-after')).toBe('300')
    advance(5 * MINUTE + 1)
    expect((await call(gate)).status).toBe(204)
  })

  it("doesn't count tries it refused", async () => {
    const { gate, advance } = gateAt()
    for (let i = 0; i < 20; i++) await call(gate)
    for (let i = 0; i < 10; i++) await call(gate) // all 429
    advance(15 * MINUTE + 1)
    expect((await call(gate)).status).toBe(204)
  })

  it('only takes POST', async () => {
    const { gate } = gateAt()
    expect((await call(gate, attempt({}, 'GET'))).status).toBe(405)
  })

  it('forgets IPs it no longer needs, so memory stays small', async () => {
    const { gate, advance } = gateAt()
    for (let i = 0; i < 50; i++) {
      await call(gate, attempt({ 'x-real-ip': `192.0.2.${i}` }))
    }
    expect(gate.size()).toBe(50)
    advance(15 * MINUTE + 1)
    await call(gate)
    expect(gate.size()).toBe(1)
  })
})

describe('clientIp', () => {
  it("uses the platform's x-real-ip", () => {
    expect(clientIp(attempt({ 'x-real-ip': '203.0.113.7' }))).toBe(
      '203.0.113.7',
    )
  })

  it('falls back to the first x-forwarded-for address', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
    })
    expect(clientIp(request)).toBe('198.51.100.4')
  })

  it('puts requests with no address in one shared bucket', () => {
    expect(clientIp(new Request('http://localhost/'))).toBe('unknown')
  })
})
