# Front Desk Board (demo)

A small front-desk scheduling board for a **fictional** dental office, built to show
front-end engineering skills: React, TypeScript, Tailwind, TanStack Query, and tests.

> **Fake data only.** Every patient, practice, and provider is invented.
> Phone numbers use the 555-01xx range reserved for fiction. No real health information.

## Status

Work in progress. Built in daily steps.

- [x] Schedule grid: chairs as columns, 15-minute rows, status labels
- [x] Two practices with practice-scoped data (switcher in the header)
- [x] Loading and error states (add `?fail` to the URL to see the error state)
- [x] Conflict detection for overlapping appointments (side-by-side cards, banner)
- [x] Check-in drawer: status steps, checklist, notes; Escape closes, focus is trapped
      while open and returns to the card on close
- [ ] Patient flow view
- [ ] Roles ("acting as" front desk / provider / office manager)
- [ ] AI scheduling assist

## What is mocked

- **The API.** `src/api/schedule.ts` is an in-browser mock with fake latency. Data is
  scoped by `practiceId` there; in a real system the server enforces that. Saves live
  in that tab's memory only, so two tabs or two users do not see each other's changes,
  and a page reload resets the data.
- **The clock.** The demo always runs on Tue Nov 17, 2026 at 9:40 AM so it looks the same
  whenever it's opened. Times are practice wall-clock strings with no timezone.

## What I'd do next

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

    npm run check   # typecheck, lint, format check, tests
    npm run build

CI runs the same checks on every push.
