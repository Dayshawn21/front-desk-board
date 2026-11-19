# Front Desk Board (demo)

A small front-desk scheduling board for a **fictional** dental office, built to show
front-end engineering skills: React, TypeScript, Tailwind, TanStack Query, and tests.

> **Fake data only.** Every patient, practice, and provider is invented.
> Phone numbers use the 555-01xx range reserved for fiction. No real health information.

**Live demo: https://front-desk-board.vercel.app/** · Design notes: [NOTE.md](NOTE.md)

**A one-minute tour**

1. Sign in as **Rosa Jimenez** (front desk). No password; pick a user.
2. The red banner is a deliberate double-booking in Chair 2. Click **Lena Ortiz** to
   open the check-in drawer, then **Check in**. Undo is in the toast. **Priya Shah**
   (8:00) never arrived: open her and **Mark no-show**.
3. Click an empty spot on the schedule, or **New appointment**, to book. In the panel,
   type "60 min cleaning for Ana Diaz this afternoon with Hygienist Patel" and press
   **Fill in with AI**, then pick a time.
4. Open the account menu (top right) to switch between light and dark, and sign out. Sign in as **Theo Grant** (office
   manager) to switch practices, or **Dr. Amara Okafor** (provider), who can seat a
   patient but can't book, check in, or cancel.

The AI assist is rate limited (10 requests a minute per visitor). Add `?fail`,
`?failBook`, or `?crash` to the URL to see the error states.

## Status

Built in six daily steps.

- [x] Schedule grid: chairs as columns, 15-minute rows, status labels
- [x] Two practices with practice-scoped data (switcher in the header)
- [x] Loading and error states (add `?fail` to the URL to see the error state)
- [x] Conflict detection for overlapping appointments (side-by-side cards, banner)
- [x] Check-in drawer: status steps, checklist, notes; Escape closes, focus is trapped
      while open and returns to the card on close
- [x] Patient flow tab: Expected → Arrived → In chair → Checked out, with one-click
      status changes
- [x] Roles: front desk / provider / office manager; actions a role can't take are
      hidden, and only the office manager can switch practices
- [x] Demo sign-in: pick one of three fake staff users; a reload keeps you signed in
      (this tab only)
- [x] Account menu: shows name, job title, and practice, with Sign out (returns to the
      sign-in page and clears cached data); closes on Escape, outside click, or focus leaving
- [x] Dark mode: Light, Dark, or System (the default, follows the device) in the
      account menu, remembered in `localStorage`. A small script in `index.html` sets it
      before the first paint, so there's no white flash. Instead of `dark:` on every
      class, `src/index.css` flips each Tailwind palette (50 ↔ 950, …) under `.dark`, so
      text/background pairs keep their contrast; axe runs on every screen in both themes
- [x] Undo: every status change shows a toast with Undo, and the drawer can move a visit
      back one step; reopening a checked-out visit is office-manager only
- [x] Open-slot finder (`src/lib/slots.ts`): given a duration and an optional chair and
      time window, suggests the earliest free slots inside opening hours, skipping
      cancelled visits. Pure function, built test-first; the AI assist feeds it
- [x] Booking: "New appointment" (front desk and office manager) picks a patient, visit
      type, length, and optional chair or time of day, shows the three earliest open
      times from the slot finder, and books the one you choose. The mock server re-checks
      the slot, so if someone else just took it you get a clear message and fresh times
      (add `?failBook` to the URL to see a failed booking)
- [x] Click an empty spot on the schedule to book there: the panel opens with that chair
      and start time filled in. Mouse and touch only; keyboard users use the New
      appointment button, which does the same thing
- [x] Cancel visit: front desk and office manager can cancel a scheduled or confirmed
      visit from the drawer, in two steps: "Cancel visit…" asks why (patient cancelled,
      late cancel, office rescheduled, other), then Cancel visit or Keep visit. The mock
      server refuses a cancel without a reason. It's a status, not a delete, so the
      record stays. The visit leaves the grid (listed as "Cancelled today" with the
      reason) and its time can be booked again; the toast's Undo restores it unless that
      time was booked in the meantime
- [x] No-show: once an expected visit's start time has passed, front desk and office
      manager can mark it a no-show (Priya Shah, 8:00, in the demo). It stays on the
      grid with its own style, leaves the patient flow columns (listed as "No-shows
      today"), and the toast's Undo puts it back
- [x] AI booking assist: describe the visit in plain words ("60 min cleaning for Ana
      Diaz this afternoon with Hygienist Patel") and Claude fills in the New appointment
      form. The slot finder then suggests times and a person books; the AI never picks a
      time or books. Measured with an eval (below)
- [x] Error boundary around the board: a crash while rendering shows "Something went
      wrong" with Try again and Reload instead of a blank page, moves focus to that
      message, and logs it (add `?crash` to the URL, then sign in, to see it). Errors a
      boundary can't catch (event handlers, rejected promises) are logged too
- [x] End-to-end tests (Playwright) in a real browser: book a visit and check a patient
      in, the double-booking banner, click-to-book, and the AI assist (fill, warn about
      another day, rate limit). The AI tests fake the server route, so CI never calls
      Claude or spends money
- [x] Automated accessibility checks (axe-core: WCAG 2.2 AA rules plus best practices) on
      the sign-in page,
      schedule (desktop and phone width), patient flow, check-in drawer, New appointment
      panel, account menu, and toast. axe catches only part of WCAG; keyboard and focus
      behaviour is covered by the other tests
- [x] Lighthouse on the live site, including the signed-in board (a scripted user
      flow that signs in, then opens the check-in drawer). Accessibility, Best
      Practices, and SEO are 100 on every screen; the sign-in page scores 100 for
      Performance on phone and desktop. On Lighthouse's slowed-down phone the click from
      sign-in to the board took 420 ms to respond (70 ms on desktop); see Performance
      below for what profiling showed

## Performance

Measured, then decided. Numbers are from Chrome with the CPU slowed 4×, the same
slowdown Lighthouse uses for phones, as medians of 12 interleaved runs.

- **Signing in.** The click responds in about 150–190 ms here, against a local
  production build. Lighthouse's run on the live site said 420 ms; I haven't pinned down
  that gap (different setup and throttling method). React's render of
  the whole board is about 60 ms. The rest is the browser's style and layout, which it
  must do once before painting the new board.
- **Focus on the heading.** Lighthouse flags a "forced reflow": after sign-in the app
  moves focus to the page heading (so screen-reader users start at the top), and
  `focus()` makes the browser lay out the page right away. Removing it cut JavaScript
  time by ~70 ms but added the same amount of native work later, so the total didn't
  change. It stays.
- **No memoization.** With a ~60 ms render and nothing re-rendering in a loop, `memo`
  and `useMemo` would add code without a measurable gain. Fewer DOM nodes didn't help
  either: the provider view (no clickable empty slots, 250 elements vs 426) was no faster.
- **No code splitting yet.** Lazy-loading the two drawers would save about 7 KB gzipped
  of ~93 KB, so it isn't worth the extra loading state. I'd split code once a drawer
  pulls in a heavy dependency (a date picker, a rich-text editor), or split the whole
  board from the sign-in page if first load mattered more; Lighthouse estimates ~50 KB
  of the bundle is unused on the sign-in page.

## AI booking assist

**How it works.** The browser posts `{ practiceId, text }` to `/api/parse-booking`, a
Vercel function (`api/parse-booking.ts`; in dev a small Vite plugin serves the same file).
The server sends Claude the request plus that practice's fake patient and chair list, and
asks for JSON in a fixed schema whose patient and chair fields only allow that practice's
ids. The answer is checked again on the server and in the browser (`sanitizeDraft` in
`src/lib/assist.ts`): anything not in the practice, or not a value the form offers, is
dropped with a warning. The panel says **"AI-filled. Review before booking."**, lists what
it filled and what it couldn't use, and shows loading and an error with Try again. If the
request names another day ("tomorrow", "next Tuesday", "11/20"), an amber note says the
form books today and the times are for today. That check runs in code on the typed text
(`findOtherDay`), so it doesn't depend on the model noticing.

**Guardrails.** The API key is read only on the server (`ANTHROPIC_API_KEY` in
`.env.local` or the host's settings) and never reaches the browser bundle. Requests are
capped at 300 characters, answers at 4,096 tokens, and only fake data is ever sent. The
server logs the kind of failure, never the request or error details. On Vercel, a
firewall rate-limit rule allows 10 requests per minute per IP to `/api/parse-booking`
and answers 429 above that, before the function runs (the panel then says "Too many
requests. Wait a minute and try again."). A monthly spend limit on the API key is the
hard cap.

**Eval** (`evals/parse-booking`, results in `.claude/hillclimb/parse-booking`). 15 fake
cases, 2 runs each, graded in code (no AI judge): all fields right, nothing made up, and
share of fields right. Cases include an unknown patient, a prompt injection, a patient
from the other practice, and requests the form can't do ("tomorrow", "every 6 months").

| Model (prompt)           | All fields right | Nothing made up | Cost / request | Median time |
| ------------------------ | ---------------- | --------------- | -------------- | ----------- |
| Opus 5.5 (first prompt)  | 30/30            | 30/30           | $0.0084        | 2.0 s       |
| Haiku 5.5 (first prompt) | 27/30            | 30/30           | $0.0002        | 1.1 s       |
| Haiku 5.5 (tuned prompt) | 28/30            | 30/30           | $0.0002        | 0.9 s       |
| Opus 5.5 (tuned prompt)  | 30/30            | 30/30           | $0.0089        | 2.1 s       |

The app uses **Haiku 5.5 with the tuned prompt**: about 40x cheaper and 2x faster, its
misses are empty fields a person reviews anyway, and neither model made anything up.
`CLAUDE_MODEL=claude-opus-5-5` switches back. Two prompt rules came straight from eval
misses ("at 10:15" is a start time; "Ms. Silva" matches by last name). With 15 cases the
eval can't tell 28/30 from 30/30 with confidence; it's a regression check, not a benchmark.
The whole eval cost about $0.53.

Re-run it (needs a key in `.env.local`; the runner asks you to approve changed eval files
once with `--approve-harness`):

    npm run eval -- --reps 2 --variant v4                            # Haiku (the default)
    npm run eval -- --reps 2 --variant v5 --model claude-opus-5-5    # Opus

Each run goes in a new variant folder (`v4`, `v5`, …); a finished variant is skipped, so
an interrupted run picks up where it stopped.

## What is mocked

- **The API.** `src/api/schedule.ts` is an in-browser mock with fake latency. Data is
  scoped by `practiceId` there; in a real system the server enforces that. Saves and new
  bookings live in that tab's memory only, so two tabs or two users do not see each other's changes,
  and a page reload resets the data.
- **Sign-in and roles.** Sign-in is pretend: you pick one of three fake staff users
  (`src/mocks/users.ts`) and there are no passwords. Anything checked in the browser can
  be bypassed, so a real app would sign in through an identity provider and the server
  would decide who you are. The chosen user is remembered in `sessionStorage` for that
  tab. Role rules (`src/lib/permissions.ts`) only hide buttons in the UI; a real server
  would enforce the same rules on every request.
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

## What I'd do next

- **Protect the AI endpoint further.** It's rate limited per IP, but public with no
  sign-in, so many IPs together could still spend the key's budget up to its spend
  limit. With real auth, limit per signed-in user and practice instead of per IP.
- **A bigger eval from real phrasing.** 15 hand-written cases is a regression check. Grow
  it to 50+ from how staff actually type requests, and run it in CI on prompt changes.
- **Act on cancel reasons and no-shows.** They're recorded now; next would be a
  late-cancel fee or a text to the patient (at which point Undo can't reverse
  everything, so the confirm step would say what will be sent), and a no-show report.
- **Drag on the schedule.** Drag down a column to pick a time range, and drag a visit to
  move it, with Undo, the same server re-check as booking, and a "Move to…" option in the
  check-in drawer so nothing needs dragging (WCAG 2.5.7).
- **Headless UI primitives.** The dialog focus trap, tabs, and toast are hand-built and
  tested here on purpose. In production I'd use headless primitives (Radix or React
  Aria, or shadcn/ui on top of Radix) so the team isn't maintaining focus logic.
- **Multi-user updates.** Have the server push change events (WebSocket or SSE) and
  invalidate the affected practice's schedule query, so every open screen updates.
- **Safe concurrent edits.** Add a `version` to each appointment; a save sent with an
  old version gets a 409 Conflict and the UI offers to reload, instead of silently
  overwriting another person's change.

## Run it

Requires Node 24 (see `.nvmrc`).

    npm install
    npm run dev

## Checks

    npm run check   # typecheck, lint, format check, unit tests
    npm run build
    npm run e2e     # Playwright: user flows and axe accessibility checks

The first e2e run needs a browser: `npx playwright install chromium`. CI runs all of
these on every push.
