import { useState } from 'react'
import { readThemeChoice, type ThemeChoice } from '../lib/theme'

// STUB: filled in by the next commit.
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice)
  return [choice, setChoice]
}
