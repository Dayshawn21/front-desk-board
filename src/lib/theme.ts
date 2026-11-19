// Light, dark, or follow the device. STUB: filled in by the next commit.

export type ThemeChoice = 'light' | 'dark' | 'system'
export const THEME_CHOICES: ThemeChoice[] = ['light', 'dark', 'system']
export const THEME_KEY = 'front-desk-board.theme'

export function readThemeChoice(): ThemeChoice {
  return 'system'
}

export function saveThemeChoice(choice: ThemeChoice): void {
  void choice
}

export function resolveTheme(
  choice: ThemeChoice,
  prefersDark: boolean,
): 'light' | 'dark' {
  void choice
  void prefersDark
  return 'light'
}

export function systemPrefersDark(): boolean {
  return false
}

export function applyTheme(choice: ThemeChoice): void {
  void choice
}
