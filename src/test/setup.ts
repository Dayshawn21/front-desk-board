import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { resetMockDb } from '../api/schedule'

// Unmount rendered components, restore the mock database, and forget any
// remembered sign-in after each test, so tests can't affect each other.
afterEach(() => {
  cleanup()
  resetMockDb()
  sessionStorage.clear()
  vi.restoreAllMocks()
})
