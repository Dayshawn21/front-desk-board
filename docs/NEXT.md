# What I'd do next

([Back to the README](../README.md))

- **Protect the AI endpoint further.** It's rate limited per IP, but public with no
  sign-in, so many IPs together could still spend the key's budget up to its spend
  limit. With real auth, limit per signed-in user and practice instead of per IP.
- **A bigger eval from real phrasing.** 15 hand-written cases is a regression check. Grow
  it to 50+ from how staff actually type requests, and run it in CI on prompt changes.
- **Act on cancel reasons and no-shows.** They're recorded now; next would be a
  late-cancel fee or a text to the patient (at which point Undo can't reverse
  everything, so the confirm step would say what will be sent), and a no-show report.
- **Drag on the schedule.** "Move to…" in the check-in drawer moves a visit today, with
  Undo and the server re-check. Next: drag down a column to pick a time range, and drag
  a visit onto a new time, calling the same move. The drawer stays the way that needs
  no dragging (WCAG 2.5.7). Moving to another day, and telling the patient, would come
  with reminders.
- **Book and move on other days.** Booking, Move to… and the patient's /book page only
  offer times today, but most front-desk booking is for later: six-month cleanings,
  follow-ups, a crown's second visit. Next: a date control (today by default, with
  "next available"), and times grouped by day.
- **Faster for people who use it all day.** A design review found no shortcuts beyond
  the tabs' arrow keys and Escape. Next: N for a new appointment and / to find a
  patient, a patient picker you can type into instead of a long list, and a "needs
  attention" list (late, double-booked, still owing) that empties as the desk works
  through it.
- **A calmer first screen on a phone.** The header, the conflict banner, the status
  key, the tabs and the chair switcher fill about half the screen before the first
  visit. Next: fold the key and banner, mark the chair with a conflict in the chair
  switcher, and keep the drawer's main action in reach at the bottom.
- **Small fixes from the same review.** Checked-out cards in Patient flow don't show
  what's still owed, and the cancel reasons don't say what happens next (is the
  patient told, is there a fee).
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
  Undo of a move would send it too: today Undo puts the visit back even if its old
  place has been booked since (the double-booking banner flags it).
- **The rest of billing.** Checkout billing is a small slice: line items fixed by
  visit type, an estimate, and pretend payments. Not built: editing line items and
  tooth/surface detail, deductibles and frequency limits in the estimate, real
  eligibility checks, sending claims and posting ERA/EOB responses (which would turn
  the estimate into the real insurance amount), a payment processor (card terminals,
  refunds and voids instead of the demo's Undo), patient statements, payment plans, and
  a running patient ledger with balances carried across visits. Patients can see
  their bill but not pay it online; that also needs the processor.
