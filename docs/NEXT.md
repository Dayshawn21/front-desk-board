# What I'd do next

([Back to the README](../README.md))

- **Protect the AI endpoint further.** It's rate limited per IP, but public with no
  sign-in, so many IPs together could still spend the key's budget up to its spend
  limit. With real auth, limit per signed-in user and practice instead of per IP.
- **An eval from real requests.** The 51 cases are written to sound like a front desk,
  but they're still mine. With real use, sample (anonymized) requests that staff edited
  after the AI filled the form, and add those as cases: they're the misses that matter.
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
- **Concurrent edits, on a real server.** Each visit now has a version and a stale save
  gets a 409 (see Features), but the check runs in the browser's mock. A real server
  would compare versions in the database write itself (`UPDATE … WHERE version = ?`),
  send the version as an ETag with `If-Match`, and push the change to other devices.
  Undo of a move still puts the visit back even if its old place was booked since
  (the double-booking banner flags it); it could offer other times instead.
- **The rest of billing.** Checkout billing is a small slice: line items fixed by
  visit type, an estimate, and pretend payments. Not built: editing line items and
  tooth/surface detail, deductibles and frequency limits in the estimate, real
  eligibility checks, sending claims and posting ERA/EOB responses (which would turn
  the estimate into the real insurance amount), a payment processor (card terminals,
  refunds and voids instead of the demo's Undo), patient statements, payment plans, and
  a running patient ledger with balances carried across visits. Patients can see
  their bill but not pay it online; that also needs the processor.
