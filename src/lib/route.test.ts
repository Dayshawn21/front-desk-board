import { describe, expect, it } from 'vitest'
import {
  bookingPath,
  checkInPath,
  PATIENT_HOME_PATH,
  PATIENT_SIGN_UP_PATH,
  parseRoute,
} from './route'

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

  it('lets the patient choose a practice at a bare /book', () => {
    expect(parseRoute('/book')).toEqual({ page: 'choose-practice' })
    expect(parseRoute('/book/')).toEqual({ page: 'choose-practice' })
  })

  it('ignores a trailing slash', () => {
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

describe('check-in links', () => {
  it("reads a visit's check-in page", () => {
    expect(parseRoute('/check-in/maple/a-07')).toEqual({
      page: 'check-in',
      practiceId: 'maple',
      visitId: 'a-07',
    })
    expect(parseRoute('/check-in/maple/a-07/')).toEqual({
      page: 'check-in',
      practiceId: 'maple',
      visitId: 'a-07',
    })
  })

  it('needs both the practice and the visit', () => {
    expect(parseRoute('/check-in')).toEqual({ page: 'board' })
    expect(parseRoute('/check-in/maple')).toEqual({ page: 'board' })
  })

  it('checkInPath builds the link parseRoute reads', () => {
    expect(checkInPath('maple', 'b-1')).toBe('/check-in/maple/b-1')
    expect(parseRoute(checkInPath('riverbend', 'a-16'))).toEqual({
      page: 'check-in',
      practiceId: 'riverbend',
      visitId: 'a-16',
    })
  })
})

describe('patient pages', () => {
  it('has one place for the patient to sign in and see their visits', () => {
    expect(PATIENT_HOME_PATH).toBe('/patient')
    expect(parseRoute('/patient')).toEqual({ page: 'patient-home' })
    expect(parseRoute('/patient/')).toEqual({ page: 'patient-home' })
    expect(parseRoute('/patient/maple')).toEqual({ page: 'board' })
  })

  it('has a sign-up page for new patients', () => {
    expect(PATIENT_SIGN_UP_PATH).toBe('/patient/sign-up')
    expect(parseRoute('/patient/sign-up')).toEqual({ page: 'patient-sign-up' })
    expect(parseRoute('/patient/sign-up/')).toEqual({
      page: 'patient-sign-up',
    })
  })
})

describe('password reset pages', () => {
  it('reads the forgot, inbox and reset pages', () => {
    expect(parseRoute('/patient/forgot-password')).toEqual({
      page: 'patient-forgot-password',
    })
    expect(parseRoute('/patient/demo-inbox')).toEqual({
      page: 'patient-demo-inbox',
    })
    expect(parseRoute('/patient/reset-password')).toEqual({
      page: 'patient-reset-password',
    })
    expect(parseRoute('/patient/constructor')).toEqual({ page: 'board' })
  })
})
