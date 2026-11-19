import { useId, useState } from 'react'
import { checkInPath } from '../lib/route'

type CheckInLinkProps = { practiceId: string; visitId: string }

// In the check-in drawer of an expected visit: the link the desk would text
// to the patient. Copy puts the full address on the clipboard; Open shows the
// patient's page in a new tab (standing in for their phone).
export function CheckInLink({ practiceId, visitId }: CheckInLinkProps) {
  const headingId = useId()
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const path = checkInPath(practiceId, visitId)

  const copyLink = () => {
    const url = `${window.location.origin}${path}`
    // The clipboard API is missing on insecure pages and can be refused.
    const write = navigator.clipboard?.writeText(url)
    if (!write) {
      setCopy('failed')
      return
    }
    write.then(
      () => setCopy('copied'),
      () => setCopy('failed'),
    )
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3"
    >
      <h3 id={headingId} className="text-sm font-semibold">
        Patient check-in link
      </h3>
      <p className="text-sm text-slate-700">
        Send it to the patient's phone. When they tap "I'm here", this visit
        moves to Arrived and their ticks show in the checklist.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Copy link
        </button>
        <a
          href={path}
          target="_blank"
          rel="noopener"
          className="flex h-11 items-center rounded-lg px-3 text-sm font-medium text-teal-800 underline underline-offset-2 hover:bg-slate-50"
        >
          Open check-in page
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <span role="status" className="text-sm text-slate-700">
          {copy === 'copied'
            ? 'Link copied'
            : copy === 'failed'
              ? "Couldn't copy. Use Open check-in page instead."
              : ''}
        </span>
      </div>
    </section>
  )
}
