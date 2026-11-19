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
5. The patient's side: keep the board open and, in a second tab, open
   [/book](https://front-desk-board.vercel.app/book) (also linked from the sign-in
   page) and choose **Maple Street Dental**. Sign in as a patient
   (`grace.liu@example.com`, password `demo1234`), then pick a visit type and a time,
   and book. The visit appears
   on the board in the first tab, as Scheduled, without a reload. **Reset demo data** in
   the account menu starts over.
6. Patient check-in: on the board, open **Ravi Menon** (10:15) and press **Open
   check-in page** (or **Copy link**). The link alone shows nothing: sign in as Ravi
   (`ravi.menon@example.com`, `demo1234`), tick "I've filled in my visit forms", and
   tap **I'm here**. Back on the board, Ravi is Arrived and his checklist
   shows Forms complete.
7. Patient sign-in: open [/patient](https://front-desk-board.vercel.app/patient)
   (also linked from the sign-in page) and sign in as `owen.hart@example.com`,
   password `demo1234`. "Your visits" lists today's visit with a **Check in** link and
   a **Book a visit** button. Now open Ravi's link, `/check-in/maple/a-11`: Owen gets
   "We couldn't find that visit", because it isn't his.
8. Patient sign-up: on the patient sign-in page, choose **Create an account**
   ([/patient/sign-up](https://front-desk-board.vercel.app/patient/sign-up)), pick an
   office, and enter a made-up name, phone, `@example.com` email, and a password of 8+
   characters. You land on "Your visits", signed in, and can book. The new patient
   also shows in the board's New appointment patient list.
9. Forgot password: on the patient sign-in form, choose **Forgot password?**, enter
   `owen.hart@example.com`, then open the
   [demo inbox](https://front-desk-board.vercel.app/patient/demo-inbox) and the reset
   link in it. Choose a new password; `demo1234` stops working for Owen and the new
   one works. **Reset demo data** puts `demo1234` back.

Demo patient logins: every made-up patient's email is `first.last@example.com`
(accents dropped, so Tomás Reyes is `tomas.reyes@example.com`), all with the password
`demo1234`. For example: `owen.hart@example.com` and `ravi.menon@example.com` (Maple
Street, both expected today), `ana.diaz@example.com` (Maple Street, visit done),
`kofi.mensah@example.com` (Riverbend).

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
      class, `src/index.css` remaps the palettes under `.dark`: neutrals run the other
      way, and each status colour has a hand-tuned dark ramp (quiet fills, light text)
      so cards don't turn into saturated blocks. axe runs on every screen in both themes
- [x] Design pass (from a structured critique): warm neutrals, a self-hosted typeface
      (Source Sans 3), a brand mark, a themed focus ring, one time format, a branded
      sign-in that says what each role can do, New appointment on the tabs row, a
      status key, and names in the conflict banner and cancelled/no-show lists that
      open the visit
- [x] Late visits: an expected visit past its start shows "Late 1h 40m" on its cards;
      the now line sits above the cards with a time label
- [x] Checklist and notes save on their own (a tick right away, notes when you leave
      the box or close the drawer), so closing never loses work
- [x] Phones: the schedule shows one chair at a time with a chair switcher (the time
      column stays in view, nothing scrolls sideways), patient flow shows one column at a
      time starting with Arrived, and New appointment floats in thumb reach
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
- [x] Shared demo data: every tab in the browser shares one mock database, so a change
      in one tab shows up on the board in another without a reload, and a reload keeps
      it. **Reset demo data** in the account menu puts the demo back to its start
- [x] Patient online booking: `/book` lists the dental offices with today's hours, and
      each links to its own booking page (`/book/maple`, `/book/riverbend`), with a
      "Sign in to see your visits" link for someone already booked: a public,
      phone-first page in the app's look. The patient signs in first (see patient
      sign-in), then picks a visit type in patient words (Cleaning, Checkup,
      Consultation, Tooth pain), and one of today's open times, grouped morning and
      afternoon. Times come from the same slot finder as the board, start no earlier
      than the demo clock, and show once each (the first free chair takes it). The
      server's double-booking check still applies: if someone took the time first, the
      page says so, clears the time, and shows fresh ones. After booking, focus moves to
      "You're booked", which links to the visit's check-in page and to "Your visits"
- [x] Patient sign-in (`/patient`): an email and password form (demo logins above),
      checked by the mock server, which hands back a session token. A wrong password
      and an unknown email get the same message, so the form doesn't reveal who has
      an account. Every patient page sits behind it: signed out, `/patient`,
      `/book/<practice>` and `/check-in/…` show only the sign-in form, never the visit.
      Every patient call carries the token, and the server decides whose data comes
      back: the patient's own details and today's visits, never the practice's patient
      list or another patient's visit. Opening someone else's check-in link, even
      signed in, shows "We couldn't find that visit", the same as a link that doesn't
      exist, so visit ids can't be probed. Booking is for the signed-in patient only, at
      their own office (another office's page says "You're a patient at …"), and open
      times carry no patient details. "Your visits" shows each visit's status in patient
      words (Booked, Confirmed, Checked in, With the dentist, Done, Cancelled, Missed),
      with **Check in** for each one not yet arrived and **Book a visit**. The header
      shows who is signed in, with **Sign out**. The token is remembered for the tab
      (`sessionStorage`), apart from the staff sign-in, and **Reset demo data** signs
      every patient out ("Please sign in again"). Focus moves to the new heading on
      sign-in and sign-out
- [x] Patient sign-up (`/patient/sign-up`, linked from the sign-in form): office (with
      today's hours), first and last name, phone, email, and a password of at least 8
      characters, with the browser's autocomplete hints (`new-password` and so on). The
      mock server trims and checks each field and says what to fix, refuses an email
      that already has an account ("Sign in instead"), stores a salted PBKDF2 hash of
      the password (never the password), adds the patient to their office's list (so
      the desk can book them), and signs them in; the page becomes "Your visits" at
      `/patient` with focus on its heading. A failed try clears the password and keeps
      the rest. Signed in already, the page says so instead of offering a second
      account. Reset demo data removes sign-ups
- [x] Forgot password (linked under the password field, so Tab still goes email →
      password): `/patient/forgot-password` takes an email and always answers "If an
      account exists for …, we've sent a link", so it never reveals who is a patient.
      For a real account the server makes a single-use token that works for 30
      minutes, keeps only its SHA-256 hash, and "emails" the link. There's no real
      email, so it lands in a **demo inbox** (`/patient/demo-inbox`, like a
      developer's mail catcher; the page says so). The reset page
      (`/patient/reset-password?token=…`) asks for the new password twice, refuses a
      used, expired, or replaced link (with "Ask for a new link"), stores the new
      password as a salted PBKDF2 hash (the demo password then stops working), and
      signs the patient out everywhere
- [x] Patient check-in from a phone (`/check-in/<practice>/<visit>`): the patient sees
      the visit and the details on file (with "tell the front desk" if something is
      wrong), ticks "I've filled in my visit forms" and "I've reviewed my health
      history" (each tick saves at once, through the same mock API as the drawer), and
      taps **I'm here**. The visit becomes Arrived on the board in any open tab, with
      the ticks in its checklist; insurance and the copay stay with the desk. Cancelled,
      no-show, and already-arrived visits each get their own message. The check-in
      drawer of a scheduled or confirmed visit shows the link with **Copy link** and
      **Open check-in page**. An open drawer shows the patient's ticks as they come in,
      and the desk's ticks never undo them (each tick sends only its own box)
- [x] End-to-end tests (Playwright) in a real browser: book a visit and check a patient
      in, the double-booking banner, click-to-book, and the AI assist (fill, warn about
      another day, rate limit). The AI tests fake the server route, so CI never calls
      Claude or spends money
- [x] Automated accessibility checks (axe-core: WCAG 2.2 AA rules plus best practices) on
      the sign-in page,
      schedule (desktop and phone width), patient flow, check-in drawer, New appointment
      panel, account menu, toast, and the patient pages (choose an office, sign in, your
      visits, booking, check-in) at phone width. axe catches only part of WCAG; keyboard and focus
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
  patient's inbox (and sign-in and reset requests would be rate limited). Sign-up details never
  reach Claude: the AI assist's server only knows the built-in seed patients. A real server would hash each patient's own
  password, rate-limit sign-in attempts, keep the session in an HttpOnly cookie, and
  check it on every request. The emails are on `example.com`, which can never be a
  real inbox, so no real names or addresses get into the demo.
- **The check-in link.** It's `/check-in/<practice>/<visit id>`. On its own it shows
  nothing: the patient signs in, and only their own visit opens. A real link would
  also carry a signed token that expires after the visit (and is sent by text).
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
- **Multi-user updates from a server.** Tabs in one browser already update each other
  (see What is mocked). With a real backend, the server would push change events
  (WebSocket or SSE) naming the practice, and only that practice's query would refetch.
- **Safe concurrent edits.** Checklist ticks already can't clash: a tick sends only its
  own box and the server merges it, so the desk and the patient's phone can tick at
  the same time. Notes and status still save last-write-wins. Next: a `version` on each
  appointment, so a save sent with an old version gets a 409 Conflict and the UI offers
  to reload instead of silently overwriting another person's change.

## Where things are

- `src/App.tsx`: signed in or not, inside an error boundary
- `src/components/Board.tsx`: the signed-in screen (state and layout); `BoardHeader`,
  `ScheduleGrid`, `PatientFlow`, `CheckInDrawer`, `BookingDrawer` beside it
- `src/hooks/`: `useStatusChanges` (save, toast, Undo), `useBooking`, `useSchedule`
  (TanStack Query), `useTheme`, `useMediaQuery`, `useModalDialog`
- `src/components/patient/`: the patient pages (`ChoosePracticePage`, `BookVisitPage`,
  `PatientHomePage`, `PatientSignUpPage`, `CheckInPage`, and `PasswordResetPages`:
  forgot password, demo inbox, new password), the sign-in gate and form (`RequirePatient`, with
  `usePatientSession` and `src/session/patientStorage.ts`), and
  their frame (`PatientShell`); `src/lib/route.ts` picks the page from the URL path (no
  router package; `vercel.json` sends `/book`, `/patient` and `/check-in` paths to
  `index.html`);
  `CheckInLink` is the link section in the check-in drawer
- `src/lib/`: the rules as pure, tested functions: `statusChange` (kinds, Undo, toast
  text), `workflow` (next step, cancel, no-show, lateness), `slots` (open-slot finder),
  `patientBooking` (which times a patient sees),
  `overlap`, `lanes`, `permissions`, `assist` (AI answer checks), `time`
- `src/api/schedule.ts`: the mock server (shared between tabs through `localStorage`);
  `src/api/patientPortal.ts`: its patient side (sign-up, sign-in, password reset, sessions, and calls that
  only return or change the signed-in patient's own visits), with the demo logins in
  `src/mocks/patientLogins.ts`;
  `server/` and `api/`: the AI route
- `e2e/`: Playwright flows and axe checks; `evals/`: the AI eval

Requires Node 24 (see `.nvmrc`).

    npm install
    npm run dev

## Checks

    npm run check   # typecheck, lint, format check, unit tests
    npm run build
    npm run e2e     # Playwright: user flows and axe accessibility checks

The first e2e run needs a browser: `npx playwright install chromium`. CI runs all of
these on every push.
