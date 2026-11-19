import { useEffect, useState } from 'react'
import {
  applyTheme,
  readThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
  watchSystemTheme,
} from '../lib/theme'

// The current theme choice, and a setter that applies and remembers it.
// While the choice is "system", the page follows the device as it changes.
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)

  useEffect(() => {
    applyTheme(choice)
    if (choice !== 'system') return
    return watchSystemTheme(() => applyTheme('system'))
  }, [choice])

  const choose = (next: ThemeChoice) => {
    saveThemeChoice(next)
    setChoice(next)
  }
  return [choice, choose]
}
