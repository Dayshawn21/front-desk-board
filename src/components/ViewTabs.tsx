import type { KeyboardEvent, ReactNode } from 'react'

export type ViewId = 'schedule' | 'flow'

const tabs: { id: ViewId; label: string }[] = [
  { id: 'schedule', label: 'Schedule' },
  { id: 'flow', label: 'Patient flow' },
]

const tabId = (id: ViewId) => `tab-${id}`
const panelId = (id: ViewId) => `panel-${id}`

type ViewTabsProps = {
  value: ViewId
  onChange: (id: ViewId) => void
  children: ReactNode // content of the selected view
}

// ARIA tabs pattern: only the selected tab is in the Tab order (roving tabindex),
// and Left/Right/Home/End move between tabs. Renders the tab list and the panel.
export function ViewTabs({ value, onChange, children }: ViewTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.findIndex((t) => t.id === value)
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null
    if (nextIndex === null) return

    event.preventDefault()
    const next = tabs[nextIndex].id
    onChange(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Views"
        className="flex gap-1 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              // Only the selected tab's panel is rendered, so only it points at one.
              aria-controls={selected ? panelId(tab.id) : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={handleKeyDown}
              className={`-mb-px h-11 border-b-2 px-4 text-sm font-semibold ${selected ? 'border-teal-700 text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={panelId(value)} aria-labelledby={tabId(value)}>
        {children}
      </div>
    </div>
  )
}
