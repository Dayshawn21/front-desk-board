# What is mocked

This is a front-end demo. The data, the staff sign-in and the patient accounts run in the browser; only two small routes run on a server. Here is exactly what is real and what is not. ([Back to the README](../README.md))

- **The API.** `src/api/schedule.ts` is an in-browser mock with fake latency. Data is
  scoped by `practiceId` there; in a real system the server enforces that. The mock
  database lives in `localStorage`, so every tab in the same browser shares it and a
  reload keeps changes; **Reset demo data** in the account menu puts the seed back in
  every open tab. Each call reads, changes, and writes the whole database in one
  synchronous step, so two tabs don't overwrite each other. Other browsers or devices
  don't share it, and if storage is blocked or full the data stays in that tab's memory.
- **Live updates.** When one tab saves, the browser fires a `storage` event in the
  other tabs; the app listens (`subscribeToMockDb`) and marks every cached schedule
  stale, so TanStack Query refetches what's on screen. A real server would push the
  same "this practice changed" message over a WebSocket or server-sent events.
- **Sign-in and roles.** Sign-in is pretend: you pick one of three fake staff users
  (`src/mocks/users.ts`) and there are no passwords. Anything checked in the browser can
  be bypassed, so a real app would sign in through an identity provider and the server
  would decide who you are. The chosen user is remembered in `sessionStorage` for that
  tab. Role rules (`src/lib/permissions.ts`) only hide buttons in the UI; a real server
  would enforce the same rules on every request.
- **Patient sign-in.** The rules are real (sign in, then only your own visits), but
  the "server" runs in the browser, so they're a model of a server, not security:
  anyone can read `localStorage` or the bundle. The demo passwords are one shared,
  published password, stored in plain text in `src/mocks/patientLogins.ts`. Accounts
  from the sign-up page store a salted PBKDF2 hash instead, but in this browser's
  `localStorage`, as are changed passwords. The session token sits in
  `sessionStorage`. The demo inbox stands in for email: anyone using this browser can
  read it, so it would never exist on a real site, where the link goes only to the
  patient's inbox. The per-email rate limits (sign-in, forgot password, change
  password) count in this browser's `localStorage`, so clearing it resets them. The
  per-IP sign-in limit is on a real server route, but the password is still checked
  in the browser afterwards, so a determined visitor could skip the route: it shows
  the pattern, not real protection. A real server checks the IP limit and the
  password in the same request, keeps the counts in a shared store (such as Redis),
  and limits forgot-password requests per IP too. Sign-up details never
  reach Claude: the AI assist's server only knows the built-in seed patients. A real server would hash each patient's own
  password, rate-limit sign-in attempts, keep the session in an HttpOnly cookie, and
  check it on every request. The emails are on `example.com`, which can never be a
  real inbox, so no real names or addresses get into the demo.
- **The check-in link.** It's `/check-in/<practice>/<visit id>`. On its own it shows
  nothing: the patient signs in, and only their own visit opens. A real link would
  also carry a signed token that expires after the visit (and is sent by text).
- **Billing.** The fee lists, procedure names, prices and insurance plans are made
  up (no real CDT codes, which the ADA owns). The insurance share is an estimate from
  a percentage per category and the remaining annual maximum; there are no
  deductibles, frequency limits, waiting periods or real eligibility checks. Payments
  are pretend: nothing is charged and no processor is called. Undo marks a payment
  voided; a real system would refund or void the charge with the payment processor,
  and keep an audit trail of who did it. No claim is sent, so the insurance part stays
  an estimate. The server re-works the balance from its own fees and plan rather than
  trusting the browser, but like everything here it runs in the browser. Patients see
  their own bill read only; they can't pay online.
- **The AI assist's data.** Claude only ever sees fake seed data: the practice's
  invented patients and chairs, plus the typed request. In production that list would
  come from the database for the signed-in practice, and the request text could contain
  real patient details, so it would need a data agreement with the AI provider.
- **Error logging.** `src/lib/logError.ts` writes one structured line to the browser
  console. A real app would send it to an error service (Sentry or similar) with source
  maps uploaded, since the production build's component names are minified. A report
  holds only the error's name and message, where it happened, the component stack, and
  the time: never props, state, or form values, which could contain patient details.
- **The clock.** The demo always runs on Tue Nov 17, 2026 at 9:40 AM so it looks the same
  whenever it's opened. Times are practice wall-clock strings with no timezone.

## The patient sign-in route

`POST /api/patient-sign-in` counts patient sign-in tries
per IP (from Vercel's `x-real-ip`), 20 per 15 minutes, in the function's memory.
Function instances don't share memory and a cold start forgets, so the durable
limit is a Vercel firewall rule, added the same way as the AI route's: in the Vercel
dashboard, **Firewall → Rules → New rule**, if _Request Path_ _equals_
`/api/patient-sign-in`, then **Rate Limit**, 10 requests per 60 seconds, keyed by
**IP**, action **Too Many Requests (429)**. The sign-in form shows the route's
message, or a plain "Too many sign-in attempts from your network…" for the
firewall's bodiless 429. IPs are held in memory only and never logged. Where there's
no API route (`vite preview`, which the end-to-end tests use), the form carries on
without the check; the e2e test fakes the route's 429.
