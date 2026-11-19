import { createSignInGate, handleSignInAttempt } from '../server/signInGate.js'

// Vercel function: POST /api/patient-sign-in. Counts patient sign-in tries
// per IP address (see server/signInGate.ts). The count lives as long as this
// function instance stays warm; the Vercel firewall rule on this path is the
// durable limit.
const gate = createSignInGate()

export async function POST(request: Request): Promise<Response> {
  return handleSignInAttempt(request, gate)
}
