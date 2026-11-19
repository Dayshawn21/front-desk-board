# Front Desk Board: design notes

**Live:** https://front-desk-board.vercel.app/ · **Code:** this repo · All data is fake.

## The problem

A dental front desk runs the day from one screen: who's in which chair, who has arrived,
what's open, and what just went wrong. The board shows a day's chairs as columns, lets
the desk move patients through check-in, flags double-bookings, and books new visits,
including from a plain-language request ("60 min cleaning for Ana Diaz this afternoon").

## Decisions that shaped it

- **Logic as pure, tested functions.** Overlaps, lane layout, open-slot search, and the
  status workflow live in `src/lib` with no React in them, so they were built test-first
  and the UI just renders their results. Times are wall-clock strings, so results don't
  change with the viewer's timezone.
- **A real data layer over a fake server.** Components call TanStack Query hooks; the
  "server" is an async mock with latency, failures (`?fail`, `?failBook`), and a 409
  when a slot was just taken. Swapping in a real API changes one file, not the UI.
- **Accessibility as a requirement, checked in CI.** Drawers trap and return focus, tabs
  follow the ARIA pattern, and every status change is announced. axe runs on each screen
  in Playwright. It caught a card label whose words didn't match the visible text (WCAG
  2.5.3) and a `dialog` role on an `<aside>`, both fixed.
- **A reason instead of "Are you sure?"** Cancelling is a status, not a delete. The
  confirm step asks why (late cancel, patient cancelled, …), which is data the office
  needs, rather than a yes/no box people click through; a toast still offers Undo. A
  late patient can be marked a no-show once their start time has passed.
- **AI fills a form; a person books.** The model returns JSON in a schema that only
  allows that practice's patient and chair ids; the server and browser re-check it, and
  the slot finder (not the model) picks times. A 15-case eval chose Haiku over Opus:
  28/30 vs 30/30 fields right, nothing invented by either, about 40× cheaper. The key
  stays on the server, with a per-IP rate limit and a spend cap.
- **Measure before optimizing.** Profiling showed the board renders in ~60 ms on a
  slowed phone CPU; memoizing or lazy-loading the drawers (~7 KB) wouldn't pay for
  itself, so I didn't. Lighthouse gives 100 for accessibility, best practices, and SEO
  on every screen, and 100 for performance on page load.
- **Fail visibly, log safely.** An error boundary shows a recoverable message instead of
  a blank page. Logs hold the error and component stack only, never props or form
  values, because in a dental office those can be patient data.

## What's pretend

The API runs in the browser (data resets on reload), sign-in is "pick a user" with no
password, and roles only hide buttons. A real system enforces practice scoping and
roles on the server.

## Next

Per-user limits on the AI endpoint once there's real auth; a version on each visit so
concurrent edits get a 409 instead of overwriting; live updates between screens; drag to
book and move visits, with a keyboard alternative.

## Numbers

254 unit tests and 18 Playwright tests (user flows, the AI assist with its route faked, and
axe) run in CI on every push.
