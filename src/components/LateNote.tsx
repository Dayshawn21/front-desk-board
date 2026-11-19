import { formatDuration } from '../lib/time'

// "Late 1h 40m" with a clock, for a visit whose start has passed without
// the patient arriving. Text plus icon, so it doesn't rely on colour.
export function LateNote({ minutes }: { minutes: number }) {
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-amber-800">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      Late {formatDuration(minutes)}
    </span>
  )
}
