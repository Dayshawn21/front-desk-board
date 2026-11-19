import type { Ref } from 'react'
import { DEMO_DAY_LABEL } from '../config'
import type { ThemeChoice } from '../lib/theme'
import type { Practice, StaffUser } from '../types'
import { AccountMenu } from './AccountMenu'
import { BrandMark } from './BrandMark'

type BoardHeaderProps = {
  headingRef: Ref<HTMLHeadingElement> // focus starts here after sign-in
  inert: boolean // while a drawer is open
  user: StaffUser
  practices: Practice[] | undefined
  practiceId: string
  canSwitchPractice: boolean
  onPracticeChange: (practiceId: string) => void
  theme: ThemeChoice
  onThemeChange: (choice: ThemeChoice) => void
  onSignOut: () => void
  onResetDemo: () => void
}

// Brand and day on the left; practice and the account menu on the right.
export function BoardHeader({
  headingRef,
  inert,
  user,
  practices,
  practiceId,
  canSwitchPractice,
  onPracticeChange,
  theme,
  onThemeChange,
  onSignOut,
  onResetDemo,
}: BoardHeaderProps) {
  const practiceName = practices?.find((p) => p.id === practiceId)?.name ?? ''

  return (
    <header
      inert={inert}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6"
    >
      <div className="flex items-center gap-3">
        <BrandMark />
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl leading-tight font-semibold tracking-tight outline-none"
          >
            Front Desk Board
          </h1>
          <p className="text-sm text-slate-600">
            {DEMO_DAY_LABEL} · Demo data only, no real patients
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* Only the office manager can switch, so only they get a control.
            Everyone else sees their practice as plain text. */}
        {canSwitchPractice ? (
          <div className="flex flex-col gap-0.5 text-xs font-medium text-slate-600">
            <label htmlFor="practice-select">Practice</label>
            <select
              id="practice-select"
              value={practiceId}
              onChange={(e) => onPracticeChange(e.target.value)}
              disabled={!practices}
              className="h-11 min-w-52 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900"
            >
              {practices?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-slate-600">Practice</span>
            <span className="text-sm font-medium text-slate-900">
              {practiceName}
            </span>
          </div>
        )}

        <AccountMenu
          user={user}
          practiceName={practiceName}
          theme={theme}
          onThemeChange={onThemeChange}
          onSignOut={onSignOut}
          onResetDemo={onResetDemo}
        />
      </div>
    </header>
  )
}
