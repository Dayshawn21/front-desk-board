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
- [x] Patient flow tab: Expected → Arrived → In chair → Checked out, with one-click
      status changes
- [x] Roles: front desk / provider / office manager; actions a role can't take are
      hidden, and only the office manager can switch practices
- [x] Demo sign-in: pick one of three fake staff users; a reload keeps you signed in
      (this tab only)
- [x] Account menu: shows name, job title, and practice, with Sign out (returns to the
      sign-in page and clears cached data); closes on Escape, outside click, or focus leaving
- [x] Undo: every status change shows a toast with Undo, and the drawer can move a visit
      back one step; reopening a checked-out visit is office-manager only
- [x] Open-slot finder (`src/lib/slots.ts`): given a duration and an optional chair and
      time window, suggests the earliest free slots inside opening hours, skipping
      cancelled visits. Pure function, built test-first; the AI assist will call it
- [x] Booking: "New appointment" (front desk and office manager) picks a patient, visit
      type, length, and optional chair or time of day, shows the three earliest open
      times from the slot finder, and books the one you choose. The mock server re-checks
      the slot, so if someone else just took it you get a clear message and fresh times
      (add `?failBook` to the URL to see a failed booking)
- [x] Click an empty spot on the schedule to book there: the panel opens with that chair
      and start time filled in. Mouse and touch only; keyboard users use the New
      appointment button, which does the same thing
- [x] Cancel visit: front desk and office manager can cancel a scheduled or confirmed
      visit from the drawer. It's a status, not a delete, so the record stays. The visit
      leaves the grid (listed as "Cancelled today") and its time can be booked again;
      the toast's Undo restores it unless that time was booked in the meantime
- [ ] AI scheduling assist

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
- **The clock.** The demo always runs on Tue Nov 17, 2026 at 9:40 AM so it looks the same
  whenever it's opened. Times are practice wall-clock strings with no timezone.

## What I'd do next

- **Cancel reasons, a confirm step, and no-shows.** Cancelling uses Undo today, not an
  "Are you sure?" popup, because it's frequent and fully reversible here. Once a cancel
  texts the patient or charges a late fee it can't be undone, so it should get a confirm
  step inside the drawer that also asks for the reason (patient called, late cancel). Add
  a separate No-show status for reporting.
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

    npm run check   # typecheck, lint, format check, tests
    npm run build

CI runs the same checks on every push.
