import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  readThemeChoice,
  resolveTheme,
  saveThemeChoice,
  THEME_KEY,
} from './theme'

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

describe('theme choice', () => {
  it('defaults to following the device', () => {
    expect(readThemeChoice()).toBe('system')
  })

  it('remembers a choice', () => {
    saveThemeChoice('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(readThemeChoice()).toBe('dark')
  })

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(THEME_KEY, 'neon')
    expect(readThemeChoice()).toBe('system')
  })

  it('still works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readThemeChoice()).toBe('system')
    expect(() => saveThemeChoice('dark')).not.toThrow()
  })
})

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)(
    '%s with device dark=%s is %s',
    (choice, prefersDark, expected) => {
      expect(resolveTheme(choice, prefersDark)).toBe(expected)
    },
  )
})

describe('applyTheme', () => {
  it('sets the dark class and the browser color scheme', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
