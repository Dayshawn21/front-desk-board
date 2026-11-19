import { useEffect, useEffectEvent, useState } from 'react'

export const TOAST_MS = 8000

export type ToastMessage = { key: number; text: string }

type UndoToastProps = {
  toast: ToastMessage | null
  undo?: { label: string; onUndo: () => void } // omitted when undo isn't allowed
  onDismiss: () => void
}

export function UndoToast({ toast, undo, onDismiss }: UndoToastProps) {
  // Pause the timer while the pointer or keyboard focus is on the toast,
  // so nobody loses the Undo button while reaching for it (WCAG 2.2.1).
  // Stored per toast (by key), so a new toast never inherits a pause from an
  // old one that was removed while focused.
  const [pausedKey, setPausedKey] = useState<number | null>(null)
  const paused = toast !== null && pausedKey === toast.key
  const setPaused = (value: boolean) =>
    setPausedKey(value && toast ? toast.key : null)

  // useEffectEvent: the timer always calls the latest onDismiss without
  // restarting every time the parent re-renders with a new function.
  const dismiss = useEffectEvent(() => onDismiss())

  useEffect(() => {
    if (!toast || paused) return
    const timer = setTimeout(dismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast, paused])

  return (
    // The live region is always in the DOM so screen readers reliably
    // announce new text when it appears inside it.
    <div
      role="status"
      aria-live="polite"
      // On a phone, sit above the floating New appointment button.
      className="pointer-events-none fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] max-sm:bottom-20"
    >
      {toast && (
        <div
          key={toast.key}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900 py-1 pr-1 pl-4 text-sm text-white shadow-lg"
        >
          <span className="py-2">{toast.text}</span>
          {undo && (
            <button
              type="button"
              aria-label={undo.label}
              onClick={undo.onUndo}
              className="h-11 rounded-md px-3 font-semibold text-teal-200 underline underline-offset-2 hover:bg-slate-800"
            >
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid size-11 place-items-center rounded-md text-slate-300 hover:bg-slate-800"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
