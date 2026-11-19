import { useEffect, useRef } from 'react'
import { initials, roleLabel, roleSummary } from '../lib/display'
import { practices } from '../mocks/seed'
import { users } from '../mocks/users'
import { bookingPath } from '../lib/route'
import { useAuth } from '../session/SessionContext'
import { BrandMark } from './BrandMark'

const practiceName = (id: string) =>
  practices.find((p) => p.id === id)?.name ?? id

export function SignInPage() {
  const { signIn } = useAuth()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // A new "page" replaced the old one: move focus to its heading so
  // keyboard and screen reader users start here (e.g. after signing out).
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-4 py-12 sm:py-20">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="text-lg leading-tight font-semibold tracking-tight">
              Front Desk Board
            </p>
            <p className="text-sm text-slate-600">
              Today's chairs, check-ins and bookings for a dental front desk
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              Sign in
            </h1>
            <p className="text-sm text-slate-600">
              Demo sign-in: pick a fake staff member to see what their role can
              do. No passwords; a real app would use the practice's identity
              provider.
            </p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => signIn(u.id)}
                  className="flex w-full items-center gap-3.5 rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-teal-600 hover:bg-teal-50"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-sm font-semibold text-teal-800"
                  >
                    {initials(u.name)}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">{u.name}</span>{' '}
                    <span className="text-sm text-slate-600">
                      {roleLabel[u.role]} · {practiceName(u.practiceId)}
                    </span>{' '}
                    <span className="text-sm text-slate-700">
                      {roleSummary[u.role]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-sm text-slate-600">
          Want the patient's side?{' '}
          <a
            href={bookingPath('maple')}
            className="font-medium text-teal-800 underline underline-offset-2"
          >
            Book a visit online
          </a>{' '}
          in one tab and watch it appear on the board in another.
        </p>
      </main>
    </div>
  )
}
