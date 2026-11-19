import { describe, expect, it } from 'vitest'
import { bookingPath, parseRoute } from './route'

describe('parseRoute', () => {
  it('sends the root, and anything unknown, to the staff board', () => {
    expect(parseRoute('/')).toEqual({ page: 'board' })
    expect(parseRoute('/nope')).toEqual({ page: 'board' })
  })

  it("reads a practice's booking page", () => {
    expect(parseRoute('/book/riverbend')).toEqual({
      page: 'book',
      practiceId: 'riverbend',
    })
  })

  it('opens the first practice for a bare /book, and ignores a trailing slash', () => {
    expect(parseRoute('/book')).toEqual({ page: 'book', practiceId: 'maple' })
    expect(parseRoute('/book/')).toEqual({ page: 'book', practiceId: 'maple' })
    expect(parseRoute('/book/maple/')).toEqual({
      page: 'book',
      practiceId: 'maple',
    })
  })

  it('decodes the practice id', () => {
    expect(parseRoute('/book/a%20b')).toEqual({
      page: 'book',
      practiceId: 'a b',
    })
  })
})

describe('bookingPath', () => {
  it('builds the link parseRoute reads', () => {
    expect(bookingPath('maple')).toBe('/book/maple')
    expect(parseRoute(bookingPath('riverbend'))).toEqual({
      page: 'book',
      practiceId: 'riverbend',
    })
  })
})
