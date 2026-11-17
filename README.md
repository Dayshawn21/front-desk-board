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
- [ ] Conflict detection for overlapping appointments
- [ ] Check-in drawer with keyboard and focus handling
- [ ] Patient flow view
- [ ] Roles ("acting as" front desk / provider / office manager)
- [ ] AI scheduling assist

## What is mocked

- **The API.** `src/api/schedule.ts` is an in-browser mock with fake latency. Data is
  scoped by `practiceId` there; in a real system the server enforces that.
- **The clock.** The demo always runs on Tue Nov 17, 2026 at 9:40 AM so it looks the same
  whenever it's opened. Times are practice wall-clock strings with no timezone.

## Run it

Requires Node 24 (see `.nvmrc`).

    npm install
    npm run dev

## Checks

    npm run check   # typecheck, lint, format check, tests
    npm run build

CI runs the same checks on every push.
