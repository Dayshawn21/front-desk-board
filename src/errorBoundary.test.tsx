import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  installGlobalErrorLogging,
  LOG_PREFIX,
  logError,
  toErrorReport,
} from './lib/logError'
import { renderWithQuery } from './test/render'

// React also logs caught errors to console.error; keep test output quiet and
// look only at our own log lines.
let consoleError: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  window.history.replaceState(null, '', '/')
})
const ourLogs = () =>
  consoleError.mock.calls.filter(([first]) => first === LOG_PREFIX)

let shouldThrow = true
function Flaky() {
  if (shouldThrow) throw new Error('Kaboom')
  return <p>All good</p>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true
  })

  it('shows a fallback instead of a blank page, and logs the error once', () => {
    render(
      <ErrorBoundary where="test">
        <Flaky />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
    expect(
      screen.getByRole('heading', { name: /something went wrong/i }),
    ).toHaveFocus()
    expect(ourLogs()).toHaveLength(1)
    expect(ourLogs()[0][1]).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'Kaboom',
        where: 'test',
        componentStack: expect.stringContaining('Flaky'),
      }),
    )
  })

  it('Try again renders the children again', async () => {
    const user = userEvent.setup()
    render(
      <ErrorBoundary where="test">
        <Flaky />
      </ErrorBoundary>,
    )

    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /try again/i }))

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('catches a crash in the board (?crash) and logs it', async () => {
    window.history.replaceState(null, '', '/?crash')
    renderWithQuery(<App />)

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument()
    expect(ourLogs()[0][1]).toEqual(
      expect.objectContaining({
        where: 'board',
        message: expect.stringMatching(/demo crash/i),
      }),
    )
  })
})

describe('logError', () => {
  it('reports only the error, where it happened, and when', () => {
    const report = toErrorReport(
      new TypeError('x is undefined'),
      'board',
      'at Board',
    )
    expect(Object.keys(report).sort()).toEqual(
      ['componentStack', 'message', 'name', 'time', 'where'].sort(),
    )
    expect(report).toEqual(
      expect.objectContaining({
        name: 'TypeError',
        message: 'x is undefined',
        where: 'board',
        componentStack: 'at Board',
      }),
    )
    expect(new Date(report.time).toString()).not.toBe('Invalid Date')
  })

  it('handles things thrown that are not Errors', () => {
    expect(toErrorReport('oops', 'x')).toEqual(
      expect.objectContaining({ name: 'Unknown', message: 'oops' }),
    )
  })

  it('writes one console line with the report', () => {
    logError(new Error('nope'), 'save')
    expect(ourLogs()).toHaveLength(1)
    expect(ourLogs()[0][1]).toEqual(
      expect.objectContaining({ message: 'nope', where: 'save' }),
    )
  })

  it('also logs errors a boundary cannot catch (event handlers, promises)', () => {
    const stop = installGlobalErrorLogging(window)

    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('in a click handler') }),
    )
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent
    Object.defineProperty(rejection, 'reason', {
      value: new Error('in a promise'),
    })
    window.dispatchEvent(rejection)

    stop()
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('after stop') }),
    )

    expect(ourLogs().map(([, r]) => [r.where, r.message])).toEqual([
      ['window', 'in a click handler'],
      ['promise', 'in a promise'],
    ])
  })
})
