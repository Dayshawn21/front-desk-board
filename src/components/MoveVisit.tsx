import { useEffect, useId, useRef, useState } from 'react'
import type { OpenSlot } from '../lib/slots'
import { formatTimeRange } from '../lib/time'
import type { Chair } from '../types'

type MoveVisitProps = {
  options: OpenSlot[] // from moveOptions: open times later today
  chairs: Chair[]
  isSaving: boolean
  // Resolves when moved; rejects if not (the error arrives as saveError).
  onMove: (to: OpenSlot) => Promise<void>
  saveError: string | null
}

const slotKey = (slot: OpenSlot) => `${slot.chairId}|${slot.start}`

// "Move to…" in the check-in drawer: pick another open time today, for a
// visit that hasn't checked in. Buttons and radios only, so nothing needs
// dragging. The server re-checks the time is still free.
export function MoveVisit({
  options,
  chairs,
  isSaving,
  onMove,
  saveError,
}: MoveVisitProps) {
  const [open, setOpen] = useState(false)
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstOptionRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const backToTrigger = useRef(false)
  const ids = useId()

  // Opening moves focus to the first time; closing puts it back on the
  // button, so it never drops out of the drawer.
  useEffect(() => {
    if (open) {
      formRef.current?.scrollIntoView?.({ block: 'nearest' })
      firstOptionRef.current?.focus({ preventScroll: true })
    } else if (backToTrigger.current) {
      backToTrigger.current = false
      triggerRef.current?.focus()
    }
  }, [open])

  // If the times refresh and the picked one is gone, nothing is picked.
  const picked = options.find((slot) => slotKey(slot) === pickedKey) ?? null
  const chairName = (id: string) => chairs.find((c) => c.id === id)?.name ?? id

  const close = () => {
    backToTrigger.current = true
    setOpen(false)
    setPickedKey(null)
    setShowError(false)
  }

  const errorId = `${ids}-error`

  return (
    <section aria-labelledby={`${ids}-heading`} className="flex flex-col gap-3">
      <h3 id={`${ids}-heading`} className="sr-only">
        Move visit
      </h3>
      {open ? (
        <form
          ref={formRef}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (isSaving) return
            if (!picked) {
              setShowError(true)
              return
            }
            onMove(picked).then(close, () => {}) // the error shows below
          }}
        >
          <fieldset
            aria-describedby={showError && !picked ? errorId : undefined}
            className="flex flex-col gap-2"
          >
            <legend className="mb-1 text-sm font-semibold">
              Pick a new time
            </legend>
            {options.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                No open times left today.
              </p>
            ) : (
              options.map((slot, i) => (
                <label
                  key={slotKey(slot)}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-300 px-3 py-2 text-sm has-checked:border-teal-700 has-checked:bg-teal-50"
                >
                  <input
                    ref={i === 0 ? firstOptionRef : undefined}
                    type="radio"
                    name={`${ids}-slot`}
                    checked={
                      picked !== null && slotKey(picked) === slotKey(slot)
                    }
                    onChange={() => setPickedKey(slotKey(slot))}
                    className="size-4 accent-teal-700"
                  />
                  <span>
                    <span className="font-medium">
                      {formatTimeRange(slot.start, slot.end)}
                    </span>
                    , {chairName(slot.chairId)}
                  </span>
                </label>
              ))
            )}
          </fieldset>
          {showError && !picked && (
            <p id={errorId} className="text-sm font-medium text-red-700">
              Choose a time.
            </p>
          )}
          {saveError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {saveError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {options.length > 0 && (
              <button
                type="submit"
                aria-disabled={isSaving}
                className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
              >
                {isSaving ? 'Moving…' : 'Move visit'}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Keep time
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className="h-11 self-start rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Move to…
        </button>
      )}
    </section>
  )
}
