import type {
  AppointmentStatus,
  AppointmentType,
  CancelReason,
  Role,
} from '../types'

export const roleLabel: Record<Role, string> = {
  'front-desk': 'Front desk',
  provider: 'Provider',
  'office-manager': 'Office manager',
}

// One line per role for the sign-in page: what signing in as them shows.
// Kept in step with src/lib/permissions.ts.
export const roleSummary: Record<Role, string> = {
  'front-desk': 'Checks patients in, books and cancels visits',
  provider: 'Seats patients; the checklist is read-only',
  'office-manager': 'Everything, plus switching practices and reopening visits',
}

// "Dr. Amara Okafor" -> "AO". Honorifics aren't initials.
export function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '')
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

export const typeLabel: Record<AppointmentType, string> = {
  cleaning: 'Cleaning',
  exam: 'Exam',
  filling: 'Filling',
  crown: 'Crown',
  consult: 'Consult',
  emergency: 'Emergency',
}

// Full class strings, never built from pieces like `bg-${color}-50`:
// Tailwind finds classes by scanning source text, so dynamic names would be missing from the CSS.
export const statusStyle: Record<
  AppointmentStatus,
  { label: string; card: string; pill: string }
> = {
  scheduled: {
    label: 'Scheduled',
    card: 'border-slate-400 bg-slate-50',
    pill: 'bg-slate-200 text-slate-800',
  },
  confirmed: {
    label: 'Confirmed',
    card: 'border-blue-500 bg-blue-50',
    pill: 'bg-blue-100 text-blue-900',
  },
  arrived: {
    label: 'Arrived',
    card: 'border-amber-600 bg-amber-50',
    pill: 'bg-amber-200 text-amber-900',
  },
  'in-chair': {
    label: 'In chair',
    card: 'border-violet-600 bg-violet-50',
    pill: 'bg-violet-200 text-violet-900',
  },
  completed: {
    label: 'Checked out',
    card: 'border-green-600 bg-green-50',
    pill: 'bg-green-200 text-green-900',
  },
  cancelled: {
    label: 'Cancelled',
    card: 'border-slate-300 bg-white opacity-60',
    pill: 'bg-slate-100 text-slate-700',
  },
  'no-show': {
    label: 'No-show',
    card: 'border-dashed border-rose-400 bg-white',
    pill: 'bg-rose-100 text-rose-900',
  },
}

export const cancelReasonLabel: Record<CancelReason, string> = {
  'patient-cancelled': 'Patient cancelled',
  'late-cancel': 'Late cancel',
  'office-rescheduled': 'Office rescheduled',
  other: 'Other',
}
