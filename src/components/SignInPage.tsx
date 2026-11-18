import { useEffect, useRef } from 'react'
import { roleLabel } from '../lib/display'
import { practices } from '../mocks/seed'
import { users } from '../mocks/users'
import { useAuth } from '../session/SessionContext'

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
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-600">Front Desk Board</p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold outline-none"
          >
            Sign in
          </h1>
          <p className="text-sm text-slate-600">
            Demo sign-in: pick a fake staff user. There are no passwords; a real
            app would sign in through the practice's identity provider.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => signIn(u.id)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-slate-300 bg-white px-4 py-3 text-left hover:border-teal-700 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <span className="font-semibold">{u.name}</span>{' '}
                <span className="text-sm text-slate-600">
                  {roleLabel[u.role]} · {practiceName(u.practiceId)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
