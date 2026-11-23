// The AI booking assist eval, as a CI check. Runs every case in cases.json
// through the real route (server/handler.ts) with the real prompt, grades it
// in code (grade.ts), and fails if:
//   - any draft fills in a patient or chair the request didn't name, or
//   - fewer cases than the threshold get every field right.
// run-eval.mjs is the tool for comparing prompts and models (variants,
// reports, resume); this is the pass/fail gate for pull requests.
//
// Usage (needs ANTHROPIC_API_KEY, e.g. in .env.local):
//   npm run eval:ci
//   npm run eval:ci -- --model claude-opus-5-5 --min-all-fields 0.9
import { appendFile, readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import Anthropic from '@anthropic-ai/sdk'
import { handleParseBooking } from '../../server/handler.ts'
import {
  DEFAULT_MODEL,
  parseBookingRequest,
} from '../../server/parseBooking.ts'
import { gradeOutcome } from './grade.ts'

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    // Share of cases that must get every field right (0 to 1). Set a little
    // under the measured rate, so one unlucky answer doesn't fail a PR but a
    // real drop does. See docs/AI-ASSIST.md.
    'min-all-fields': { type: 'string', default: '0.85' },
    concurrency: { type: 'string', default: '4' },
  },
})
const minAllFields = Number(args['min-all-fields'])
const concurrency = Number(args.concurrency)

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set: the eval calls Claude.')
  process.exit(2)
}

const cases = JSON.parse(
  await readFile(new URL('./cases.json', import.meta.url), 'utf8'),
)
// Retries rate limits and overloads with backoff (the SDK does this).
const client = new Anthropic({ maxRetries: 4 }).beta.messages

// One case through the route, as the app sends it.
async function runCase(c) {
  let apiError
  const response = await handleParseBooking(
    new Request('http://eval.local/api/parse-booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ practiceId: c.practiceId, text: c.text }),
    }),
    {
      hasApiKey: true,
      parse: (text, context) =>
        parseBookingRequest(
          {
            create: (params) =>
              client.create(params).catch((e) => {
                apiError = e
                throw e
              }),
          },
          text,
          context,
          args.model,
        ),
    },
  )
  // A failed API call isn't the model's answer: stop rather than grade it.
  if (apiError) throw apiError
  const body = await response.json()
  const outcome = response.ok
    ? { draft: body.draft, warnings: body.warnings }
    : { error: response.status === 422 ? 'refusal' : 'bad-output' }
  return { case: c, outcome, ...gradeOutcome(c, outcome) }
}

// A few at a time, in order.
const rows = []
let next = 0
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < cases.length) {
      const c = cases[next++]
      rows.push(await runCase(c))
    }
  }),
)
rows.sort((a, b) => cases.indexOf(a.case) - cases.indexOf(b.case))

const total = rows.length
const allFields = rows.filter((r) => r.grade.all_fields === 1).length
const invented = rows.filter((r) => r.grade.no_invented === 0)
const fieldScore = rows.reduce((sum, r) => sum + r.grade.field_score, 0) / total
const needed = Math.ceil(minAllFields * total)
const passed = invented.length === 0 && allFields >= needed

const pct = (n) => `${Math.round((n / total) * 100)}%`
const misses = rows.filter((r) => r.grade.all_fields === 0)
const summary = [
  `## AI booking assist eval (${args.model})`,
  '',
  passed
    ? `Passed: ${allFields}/${total} cases with every field right (needs ${needed}), and nothing made up.`
    : `Failed: ${allFields}/${total} cases with every field right (needs ${needed}); ${invented.length} with something made up (needs 0).`,
  '',
  `| Check | Result |`,
  `| --- | --- |`,
  `| All fields right | ${allFields}/${total} (${pct(allFields)}) |`,
  `| Nothing made up | ${total - invented.length}/${total} |`,
  `| Share of fields right | ${Math.round(fieldScore * 100)}% |`,
  '',
  ...(misses.length
    ? [
        '| Case | Request | What was off |',
        '| --- | --- | --- |',
        ...misses.map(
          (r) =>
            `| ${r.case.id} | ${r.case.text.replaceAll('|', '\\|')} | ${[
              r.explanation.all_fields,
              r.grade.no_invented ? null : r.explanation.no_invented,
            ]
              .filter(Boolean)
              .join('; ')
              .replaceAll('|', '\\|')} |`,
        ),
      ]
    : []),
].join('\n')

console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
}
process.exitCode = passed ? 0 : 1
