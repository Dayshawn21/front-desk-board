// Light, dark, or follow the device. The choice is a per-person preference,
// so it lives in localStorage (kept across visits); storage can be blocked,
// so every access is guarded and the app falls back to the device setting.
//
// The same logic runs once in index.html before the app loads, so the page
// doesn't flash light before turning dark. Keep the two in step.

export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEME_CHOICES: ThemeChoice[] = ['light', 'dark', 'system']
export const THEME_KEY = 'front-desk-board.theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEME_CHOICES.includes(stored as ThemeChoice)
      ? (stored as ThemeChoice)
      : 'system'
  } catch {
    return 'system'
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    // Not remembered; the choice still applies until the page reloads.
  }
}

export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): 'light' | 'dark' {
  if (choice === 'system') return prefersDark ? 'dark' : 'light'
  return choice
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY).matches
    : false
}

// Calls back when the device switches between light and dark.
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

// The dark class switches the colour palette (see index.css); color-scheme
// makes the browser's own parts (scrollbars, form controls) match.
export function applyTheme(choice: ThemeChoice): void {
  const theme = resolveTheme(choice, systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
