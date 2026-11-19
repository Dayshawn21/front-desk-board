// POST /api/patient-sign-in: every patient sign-in try passes through this
// route first, and it allows at most 20 tries per IP address in 15 minutes.
// It doesn't see the email or password (the demo checks those in the
// browser); it only counts tries. Together with the per-email limit in the
// mock server, that's the usual pair: per account against guessing one
// password, per IP against one attacker trying many accounts.
//
// Two layers on Vercel:
//   1. A firewall rate-limit rule on this path (set in the Vercel dashboard,
//      see README) answers 429 before the function runs at all.
//   2. This in-memory count, a backup for the window a function instance
//      stays warm. Instances don't share memory and a cold start forgets,
//      so on its own it's best effort; a real server would keep the counts
//      in a shared store such as Redis.
//
// IPs are kept in memory only, never logged.

export const SIGN_IN_IP_LIMIT = { tries: 20, windowMs: 15 * 60_000 }

// Stop growing past this many IPs (an attack from many addresses): the
// oldest entries go first.
const MAX_TRACKED_IPS = 10_000

export type SignInGate = {
  // Records a try for this IP; returns ms until it may try again, or 0.
  attempt: (ip: string) => number
  size: () => number
}

export function createSignInGate({
  now = Date.now,
  limit = SIGN_IN_IP_LIMIT,
}: { now?: () => number; limit?: typeof SIGN_IN_IP_LIMIT } = {}): SignInGate {
  const tries = new Map<string, number[]>()

  const prune = (at: number) => {
    for (const [ip, times] of tries) {
      const recent = times.filter((t) => t > at - limit.windowMs)
      if (recent.length === 0) tries.delete(ip)
      else tries.set(ip, recent)
    }
  }

  return {
    attempt(ip) {
      const at = now()
      prune(at)
      const recent = tries.get(ip) ?? []
      if (recent.length >= limit.tries) {
        // Refused tries aren't counted, so the wait doesn't keep growing.
        return recent[recent.length - limit.tries] + limit.windowMs - at
      }
      // Re-insert so Map order is oldest-active first, for the size cap.
      tries.delete(ip)
      tries.set(ip, [...recent, at])
      while (tries.size > MAX_TRACKED_IPS) {
        const oldest = tries.keys().next().value
        if (oldest === undefined) break
        tries.delete(oldest)
      }
      return 0
    },
    size: () => tries.size,
  }
}

// The caller's IP. On Vercel, x-real-ip is set by the platform; the first
// x-forwarded-for entry is the fallback for other hosts and the dev server.
export function clientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwarded = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  return forwarded || 'unknown'
}

export async function handleSignInAttempt(
  request: Request,
  gate: SignInGate,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } })
  }
  const waitMs = gate.attempt(clientIp(request))
  if (waitMs === 0) return new Response(null, { status: 204 })

  const minutes = Math.max(1, Math.ceil(waitMs / 60_000))
  return new Response(
    JSON.stringify({
      error: `Too many sign-in attempts from your network. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    }),
    {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(waitMs / 1000)),
      },
    },
  )
}
