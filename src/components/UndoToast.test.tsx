import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_MS, UndoToast } from './UndoToast'

// Fake timers so we can jump 8 seconds without waiting. fireEvent (not
// user-event) because user-event's own delays also run on timers.
describe('UndoToast timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dismisses itself after the timeout', () => {
    const onDismiss = vi.fn()
    render(
      <UndoToast toast={{ key: 1, text: 'Saved' }} onDismiss={onDismiss} />,
    )

    act(() => vi.advanceTimersByTime(TOAST_MS - 1))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('waits while keyboard focus is on the toast', () => {
    const onDismiss = vi.fn()
    render(
      <UndoToast
        toast={{ key: 1, text: 'Saved' }}
        undo={{ label: 'Undo check-in', onUndo: () => {} }}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.focusIn(screen.getByRole('button', { name: 'Undo check-in' }))
    act(() => vi.advanceTimersByTime(TOAST_MS * 3))
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.focusOut(screen.getByRole('button', { name: 'Undo check-in' }))
    act(() => vi.advanceTimersByTime(TOAST_MS))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('announces through a live region that is always present', () => {
    const { rerender } = render(<UndoToast toast={null} onDismiss={() => {}} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    rerender(
      <UndoToast
        toast={{ key: 1, text: 'Lena Ortiz: Arrived' }}
        onDismiss={() => {}}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Lena Ortiz: Arrived')
  })
})
