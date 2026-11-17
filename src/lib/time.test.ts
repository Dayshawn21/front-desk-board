import { describe, expect, it } from 'vitest'
import { formatTime, toMinutes } from './time'

describe('toMinutes', () => {
  it('reads HH:MM from an ISO wall-clock string', () => {
    expect(toMinutes('2026-11-17T09:15:00')).toBe(555)
  })

  it('accepts a bare HH:MM', () => {
    expect(toMinutes('08:00')).toBe(480)
    expect(toMinutes('7:30')).toBe(450)
  })

  it('throws on input it cannot read', () => {
    expect(() => toMinutes('not a time')).toThrow('Invalid time')
  })
})

describe('formatTime', () => {
  it('formats morning, noon and afternoon times', () => {
    expect(formatTime(555)).toBe('9:15 AM')
    expect(formatTime(720)).toBe('12:00 PM')
    expect(formatTime(810)).toBe('1:30 PM')
  })

  it('formats midnight as 12 AM', () => {
    expect(formatTime(0)).toBe('12:00 AM')
  })

  it('accepts an ISO string', () => {
    expect(formatTime('2026-11-17T14:05:00')).toBe('2:05 PM')
  })
})
