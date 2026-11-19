import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetMockDb } from '../api/schedule'

// Unmount rendered components, restore the mock database and the URL, and
// forget any remembered sign-in after each test, so tests can't affect each other.
afterEach(() => {
  cleanup()
  resetMockDb()
  // Server tests run in Node, where there is no sessionStorage.
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  if (typeof localStorage !== 'undefined') localStorage.clear()
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/') // back to the staff board
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  }
  vi.restoreAllMocks()
})
