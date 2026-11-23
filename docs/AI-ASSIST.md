# AI booking assist

([Back to the README](../README.md) · the flow is diagram 4 in [ARCHITECTURE.md](ARCHITECTURE.md))

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

**51 cases, checked in CI.** 36 more cases came later, written the way front desks type:
typos ("clening for Grace Lui"), first or last names only, titles ("Mr. Bell crown prep"),
lengths and times in words ("an hour and a half", "at noon", "between 2 and 4"), times
outside opening hours, a provider or patient from the other practice, a chair that
doesn't exist, shorthand ("pt Jon Kim f/u exam 30m pm"), all caps, a request in Spanish,
prompt injection dressed up as a system message, and requests that aren't bookings.
Ambiguous ones accept more than one answer, and a unit test checks every expected value
is one the form can hold in that case's practice. Haiku with the tuned prompt, over three
runs of all 51:

| Run | All fields right | Nothing made up |
| --- | ---------------- | --------------- |
| 1   | 49/51            | 51/51           |
| 2   | 51/51            | 51/51           |
| 3   | 50/51            | 51/51           |

150/153 (98%), and nothing made up in 153 answers. All three misses left the patient
empty rather than guessing: "Priya" twice (with "tomorrow" in the same request) and
"Park" for Elena Park once. The three runs cost about 3 cents together.

`npm run eval:ci` ([ci.mjs](../evals/parse-booking/ci.mjs)) is the pass/fail version:
every case once, through the real route. It fails if anything is made up, or if fewer
than 90% of cases (46/51) get every field right, a little under the measured 98% so one
unlucky answer doesn't fail a pull request but a real drop does. The
[AI eval workflow](../.github/workflows/ai-eval.yml) runs it on pull requests that change
the prompt, the route, the draft checks, the demo data or the eval itself, using the
`ANTHROPIC_API_KEY` repository secret; without the secret (as on forks) it skips with a
notice. The runner below stays the tool for comparing prompts and models.

Re-run the comparison (needs a key in `.env.local`; the runner asks you to approve changed eval files
once with `--approve-harness`):

    npm run eval -- --reps 2 --variant v4                            # Haiku (the default)
    npm run eval -- --reps 2 --variant v5 --model claude-opus-5-5    # Opus

Each run goes in a new variant folder (`v4`, `v5`, …); a finished variant is skipped, so
an interrupted run picks up where it stopped.
