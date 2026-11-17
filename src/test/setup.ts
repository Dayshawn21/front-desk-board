import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetMockDb } from '../api/schedule'

// Unmount rendered components and restore the mock database after each test,
// so tests can't affect each other.
afterEach(() => {
  cleanup()
  resetMockDb()
})
