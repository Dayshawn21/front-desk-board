import { useEffect, useId, useRef, useState } from 'react'
import { roleLabel } from '../lib/display'
import { THEME_CHOICES, type ThemeChoice } from '../lib/theme'
import type { StaffUser } from '../types'

type AccountMenuProps = {
  user: StaffUser
  practiceName: string
  theme: ThemeChoice
  onThemeChange: (choice: ThemeChoice) => void
  onSignOut: () => void
}

const themeLabel: Record<ThemeChoice, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

// "Dr. Amara Okafor" -> "AO". Honorifics aren't initials.
function initials(name: string): string {
  return name
    .replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '')
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
}

// A disclosure (button + panel), not an ARIA menu: the panel mixes text
// and a button, and role="menu" would promise arrow-key menu behaviour.
// Closes on a second click, Escape (focus back to the button), a click
// outside, or keyboard focus leaving it.
export function AccountMenu({
  user,
  practiceName,
  theme,
  onThemeChange,
  onSignOut,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false)
          buttonRef.current?.focus()
        }
      }}
      onBlur={(event) => {
        // relatedTarget is where focus is going. Close only when it moves to
        // something outside. null is not "leaving": pressing the mouse on
        // plain text inside the panel (like a theme option's label) blurs to
        // the page first. Clicks outside are handled by pointerdown above.
        const next = event.relatedTarget as Node | null
        if (next && !containerRef.current?.contains(next)) setOpen(false)
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white py-1 pr-3 pl-1 text-left hover:bg-slate-100"
      >
        <span className="sr-only">Account menu for </span>
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full bg-teal-700 text-xs font-semibold text-white"
        >
          {initials(user.name)}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-slate-900">
            {user.name}
          </span>{' '}
          <span className="text-xs text-slate-600">{roleLabel[user.role]}</span>
        </span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Account details"
          className="absolute top-full left-0 z-40 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-4 shadow-lg sm:right-0 sm:left-auto"
        >
          <p className="font-semibold text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-700">{user.title}</p>
          <p className="mt-1 text-sm text-slate-600">{practiceName}</p>
          <p className="mt-3 text-xs text-slate-600">
            Access level: {roleLabel[user.role]}
          </p>
          {/* Native radios: arrow keys move between them, and the group
              reads as "Theme" with the current choice checked. */}
          {/* The divider is on a wrapper: a border on the fieldset would draw
              through its legend. */}
          <div className="mt-4 border-t border-slate-200 pt-3">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-slate-700">
                Theme
              </legend>
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                {THEME_CHOICES.map((choice) => (
                  <label
                    key={choice}
                    className="flex h-9 cursor-pointer items-center justify-center rounded-md text-xs font-medium text-slate-700 has-checked:bg-teal-700 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-teal-700"
                  >
                    <input
                      type="radio"
                      name={`${panelId}-theme`}
                      value={choice}
                      checked={theme === choice}
                      onChange={() => onThemeChange(choice)}
                      className="sr-only"
                    />
                    {themeLabel[choice]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onSignOut}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
