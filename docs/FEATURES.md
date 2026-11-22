# Features in detail

What the demo does, feature by feature. ([Back to the README](../README.md))

- Schedule grid: chairs as columns, 15-minute rows, status labels
- Two practices with practice-scoped data (switcher in the header)
- Loading and error states (add `?fail` to the URL to see the error state)
- Conflict detection for overlapping appointments (side-by-side cards, banner)
- Check-in drawer: status steps, checklist, notes; Escape closes, focus is trapped
  while open and returns to the card on close. It leads with the job of the moment:
  Move to… right under a double-booking, billing first for a checked-out visit, and
  Mark no-show beside Check in once the patient is late
- Patient flow tab: Expected → Arrived → In chair → Checked out, with one-click
  status changes
- Roles: front desk / provider / office manager; actions a role can't take are
  hidden, and only the office manager can switch practices
- Demo sign-in: pick one of three fake staff users; a reload keeps you signed in
  (this tab only)
- Account menu: shows name, job title, and practice, with Sign out (returns to the
  sign-in page and clears cached data); closes on Escape, outside click, or focus leaving
- Dark mode: Light, Dark, or System (the default, follows the device) in the
  account menu, remembered in `localStorage`. A small script in `index.html` sets it
  before the first paint, so there's no white flash. Instead of `dark:` on every
  class, `src/index.css` remaps the palettes under `.dark`: neutrals run the other
  way, and each status colour has a hand-tuned dark ramp (quiet fills, light text)
  so cards don't turn into saturated blocks. axe runs on every screen in both themes
- Design pass (from a structured critique): warm neutrals, a self-hosted typeface
  (Source Sans 3), a brand mark, a themed focus ring, one time format, a branded
  sign-in that says what each role can do, New appointment on the tabs row, a
  status key, and names in the conflict banner and cancelled/no-show lists that
  open the visit
- Late visits: an expected visit past its start shows "Late 1h 40m" on its cards;
  the now line sits above the cards with a time label, and hides the half-hour label
  it would cover
- Checklist and notes save on their own (a tick right away, notes when you leave
  the box or close the drawer), so closing never loses work
- Phones: the schedule shows one chair at a time with a chair switcher (the time
  column stays in view, nothing scrolls sideways), patient flow shows one column at a
  time starting with Arrived, and New appointment floats in thumb reach
- Billing at checkout (fake fees and plans, pretend payments): a checked-out
  visit's drawer lists its line items from the practice's made-up fee list
  (fixed by visit type), an insurance estimate, the patient's share and any
  balance. Front desk and office manager **Record payment** (card, cash or other;
  partial payments leave a balance, more than the balance is refused by the mock
  server), which also ticks Copay collected; while part of the share is unpaid, the
  box says how much ("$140.00 still due"). The toast offers Undo, which voids the
  payment. Providers see it read-only
- Insurance estimate (`src/lib/billing.ts`, built test-first): each fee's category
  (preventive, basic, major) gets the plan's percentage; each line's insurance share
  rounds down to a whole cent and the patient pays the rest, so the shares always add
  up; then the plan pays no more than the patient's remaining annual benefit. Money is
  integer cents everywhere
- The patient's bill: on "Your visits", a checked-out visit shows the patient their
  own line items, insurance estimate, share, what's paid and the balance, read only
  ("Pay at the front desk"). The patient API never returns how anyone paid. A payment
  at the desk shows on the patient's open tab without a reload
- Today's billing (office manager): billed (patient shares of checked-out visits),
  collected and outstanding for the current practice, plus the insurance estimate
- Undo: every status change shows a toast with Undo, and the drawer can move a visit
  back one step; reopening a checked-out visit is office-manager only. The drawer
  traps Tab, so while it's open the latest move, payment, cancel or no-show for that
  visit shows inside it ("Last change: … Undo") and the toast waits instead of
  timing out
- Open-slot finder (`src/lib/slots.ts`): given a duration and an optional chair and
  time window, suggests the earliest free slots inside opening hours, skipping
  cancelled visits. Pure function, built test-first; the AI assist feeds it
- Booking: "New appointment" (front desk and office manager) picks a patient, visit
  type, length, and optional chair or time of day, shows the three earliest open
  times from the slot finder, and books the one you choose. The mock server re-checks
  the slot, so if someone else just took it you get a clear message and fresh times
  (add `?failBook` to the URL to see a failed booking)
- Click an empty spot on the schedule to book there: the panel opens with that chair
  and start time filled in. Mouse and touch only; keyboard users use the New
  appointment button, which does the same thing
- Cancel visit: front desk and office manager can cancel a scheduled or confirmed
  visit from the drawer, in two steps: "Cancel visit…" asks why (patient cancelled,
  late cancel, office rescheduled, other), then Cancel visit or Keep visit. The mock
  server refuses a cancel without a reason. It's a status, not a delete, so the
  record stays. The visit leaves the grid (listed as "Cancelled today" with the
  reason) and its time can be booked again; the toast's Undo restores it unless that
  time was booked in the meantime
- Move to…: front desk and office manager can move a scheduled or confirmed visit to
  another time or chair today, from the drawer. It offers five open times from now,
  the same length as the visit, from the same slot finder as booking, and never
  where it already is: up to three with the visit's own provider first, then the
  earliest others, which name their provider ("Chair 3, with Dr. Lindqvist"). Buttons and radios, so nothing needs dragging. The mock
  server keeps the length, re-checks the chair is free (a 409 with fresh times if
  someone just took it), and refuses a visit the patient has arrived for. Moving
  Lena Ortiz clears the demo's double-booking. The toast's Undo puts the visit back,
  even into its old overlap, which the banner then flags again. The patient's Your
  visits page shows the new time without a reload
- No-show: once an expected visit's start time has passed, front desk and office
  manager can mark it a no-show (Priya Shah, 8:00, in the demo). It stays on the
  grid with its own style, leaves the patient flow columns (listed as "No-shows
  today"), and the toast's Undo puts it back
- AI booking assist: describe the visit in plain words ("60 min cleaning for Ana
  Diaz this afternoon with Hygienist Patel") and Claude fills in the New appointment
  form. The slot finder then suggests times and a person books; the AI never picks a
  time or books. Measured with an eval (below)
- Error boundary around the board: a crash while rendering shows "Something went
  wrong" with Try again and Reload instead of a blank page, moves focus to that
  message, and logs it (add `?crash` to the URL, then sign in, to see it). Errors a
  boundary can't catch (event handlers, rejected promises) are logged too
- Shared demo data: every tab in the browser shares one mock database, so a change
  in one tab shows up on the board in another without a reload, and a reload keeps
  it. **Reset demo data** in the account menu puts the demo back to its start
- Patient online booking: `/book` lists the dental offices with today's hours, and
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
- Patient sign-in (`/patient`): an email and password form (demo logins above),
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
- Patient sign-up (`/patient/sign-up`, linked from the sign-in form): office (with
  today's hours), first and last name, phone, email, and a password of at least 8
  characters, with the browser's autocomplete hints (`new-password` and so on). The
  mock server trims and checks each field and says what to fix, refuses an email
  that already has an account ("Sign in instead"), stores a salted PBKDF2 hash of
  the password (never the password), adds the patient to their office's list (so
  the desk can book them), and signs them in; the page becomes "Your visits" at
  `/patient` with focus on its heading. A failed try clears the password and keeps
  the rest. Signed in already, the page says so instead of offering a second
  account. Reset demo data removes sign-ups
- Forgot password (linked under the password field, so Tab still goes email →
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
- Change password, signed in (`/patient/change-password`, linked from the **Your
  account** section of "Your visits", which shows the account's email): the
  current password plus the new one twice, with password-manager hints (a hidden
  username field, `current-password`, `new-password`). The server checks the
  current password (so someone with an unlocked phone can't take the account
  over), needs 8+ characters and a different password, stores a salted hash, and
  signs the patient out everywhere else while this tab stays signed in. A wrong
  current password clears the fields; mismatched new passwords are caught before
  anything is sent
- Rate limit on change password: 5 wrong current passwords per patient in 15
  minutes lock the form ("Too many tries. Try again in N minutes, or reset your
  password.", with a **Reset your password** link). While locked the server doesn't
  check the password at all, so guessing gets nowhere, and tries made while locked
  don't extend the lock. It's counted per patient, so signing in again doesn't
  reset it; a successful change clears the count, and a refused new password
  (too short, unchanged) isn't counted as a wrong guess
- Rate limits on patient sign-in and forgot password, on the same rules: 5 wrong
  passwords per email in 15 minutes lock that email's sign-in (with the wait and a
  **Reset your password** link; unknown emails lock the same way, so a lock reveals
  nothing, and a successful sign-in clears the count). Forgot password sends at
  most 3 emails per address in 15 minutes; past that it gives the usual "If an
  account exists…" answer and sends nothing, so it can't flood an inbox
- Per-IP limit on patient sign-in: every try first goes through a real server
  route, `POST /api/patient-sign-in` (`server/signInGate.ts`), which allows 20
  tries per IP address in 15 minutes and answers 429 with how long to wait
  ("Too many sign-in attempts from your network…", plus `Retry-After`). It never
  sees the email or password, only counts. On Vercel a firewall rule on that path
  is the durable limit (see "Patient sign-in route" below); the in-function count
  is a backup that lasts while an instance is warm. Per email stops guessing one
  account's password; per IP stops one attacker trying many accounts
- Patient check-in from a phone (`/check-in/<practice>/<visit>`): the patient sees
  the visit and the details on file (with "tell the front desk" if something is
  wrong), ticks "I've filled in my visit forms" and "I've reviewed my health
  history" (each tick saves at once, through the same mock API as the drawer), and
  taps **I'm here**. The visit becomes Arrived on the board in any open tab, with
  the ticks in its checklist; insurance and the copay stay with the desk. Cancelled,
  no-show, and already-arrived visits each get their own message. The check-in
  drawer of a scheduled or confirmed visit shows the link with **Copy link** and
  **Open check-in page**. An open drawer shows the patient's ticks as they come in,
  and the desk's ticks never undo them (each tick sends only its own box)
- End-to-end tests (Playwright) in a real browser: book a visit and check a patient
  in, the double-booking banner, click-to-book, and the AI assist (fill, warn about
  another day, rate limit). The AI tests fake the server route, so CI never calls
  Claude or spends money
- Automated accessibility checks (axe-core: WCAG 2.2 AA rules plus best practices) on
  the sign-in page,
  schedule (desktop and phone width), patient flow, check-in drawer, New appointment
  panel, account menu, toast, and the patient pages (choose an office, sign in, your
  visits, booking, check-in) at phone width. axe catches only part of WCAG; keyboard and focus
  behaviour is covered by the other tests
- Lighthouse on the live site, including the signed-in board (a scripted user
  flow that signs in, then opens the check-in drawer). Accessibility, Best
  Practices, and SEO are 100 on every screen; the sign-in page scores 100 for
  Performance on phone and desktop. On Lighthouse's slowed-down phone the click from
  sign-in to the board took 420 ms to respond (70 ms on desktop); see Performance
  below for what profiling showed
