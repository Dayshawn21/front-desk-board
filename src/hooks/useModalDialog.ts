import { type KeyboardEvent, type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Shared behaviour for the app's modal panels (check-in, new appointment):
// - on open, focus moves to `initialFocusRef`
// - Tab and Shift+Tab wrap inside the panel (focus trap)
// - Escape calls onClose
// - on close, focus goes back to whatever opened the panel
// The page behind is made `inert` by App, so it can't be clicked or focused.
export function useModalDialog<T extends HTMLElement>(
  initialFocusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    initialFocusRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [initialFocusRef])

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = [
      ...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return { dialogRef, onKeyDown }
}
