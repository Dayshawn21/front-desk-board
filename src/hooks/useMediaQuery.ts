import { useSyncExternalStore } from 'react'

// True while a CSS media query matches, e.g. '(max-width: 639px)'.
// useSyncExternalStore keeps React in step with the browser as the window
// resizes. Without matchMedia (jsdom, old browsers) it reports false, so
// the wide layout is the default.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () =>
      typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : false,
  )
}

// Below Tailwind's sm breakpoint (640px): phones.
export const PHONE_QUERY = '(max-width: 639px)'
