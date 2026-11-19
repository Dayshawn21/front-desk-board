import { describe, expect, it, vi } from 'vitest'
import {
  createAppointment,
  fetchSchedule,
  MOCK_DB_KEY,
  resetDemoData,
  subscribeToMockDb,
  updateAppointment,
} from './schedule'

// The mock db is shared between tabs through localStorage. A "second tab"
// here is a fresh copy of the module (vi.resetModules), which starts with
// nothing in memory, the way a newly opened tab does.

const DATE = '2026-11-17'

async function openSecondTab() {
  vi.resetModules()
  return import('./schedule')
}

async function statusOf(
  api: { fetchSchedule: typeof fetchSchedule },
  id: string,
) {
  const day = await api.fetchSchedule('maple', DATE)
  return day.appointments.find((a) => a.id === id)?.status
}

describe('shared mock db', () => {
  it('keeps a save in localStorage, so another tab sees it', async () => {
    await updateAppointment('maple', 'a-07', { status: 'arrived' })

    const otherTab = await openSecondTab()
    expect(await statusOf(otherTab, 'a-07')).toBe('arrived')
  })

  it("doesn't let one tab's save overwrite another tab's", async () => {
    const otherTab = await openSecondTab()
    await otherTab.fetchSchedule('maple', DATE) // the other tab has loaded

    await updateAppointment('maple', 'a-07', { status: 'arrived' })
    await otherTab.updateAppointment('maple', 'a-12', { notes: 'Parking.' })

    const day = await fetchSchedule('maple', DATE)
    expect(day.appointments.find((a) => a.id === 'a-07')?.status).toBe(
      'arrived',
    )
    expect(day.appointments.find((a) => a.id === 'a-12')?.notes).toBe(
      'Parking.',
    )
  })

  it('gives bookings from two tabs different ids', async () => {
    const otherTab = await openSecondTab()
    const visit = {
      patientId: 'p-ana',
      chairId: 'maple-c1',
      type: 'exam' as const,
    }
    const first = await otherTab.createAppointment('maple', {
      ...visit,
      start: `${DATE}T15:00:00`,
      end: `${DATE}T15:30:00`,
    })
    const second = await createAppointment('maple', {
      ...visit,
      start: `${DATE}T16:00:00`,
      end: `${DATE}T16:30:00`,
    })
    expect(second.id).not.toBe(first.id)
  })

  it('starts from the seed data when what is stored is unreadable', async () => {
    localStorage.setItem(MOCK_DB_KEY, '{not json')

    expect(await statusOf({ fetchSchedule }, 'a-07')).toBe('confirmed')
  })

  it('still works, in memory, when localStorage refuses to save', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    await updateAppointment('maple', 'a-07', { status: 'arrived' })

    expect(await statusOf({ fetchSchedule }, 'a-07')).toBe('arrived')
  })

  it('resetDemoData puts the seed data back for every tab', async () => {
    await updateAppointment('maple', 'a-07', { status: 'arrived' })

    resetDemoData()

    expect(await statusOf({ fetchSchedule }, 'a-07')).toBe('confirmed')
    const otherTab = await openSecondTab()
    expect(await statusOf(otherTab, 'a-07')).toBe('confirmed')
  })
})

describe('subscribeToMockDb', () => {
  // The browser fires a "storage" event in every OTHER tab of the same site
  // when localStorage changes; that is the "another tab changed data" signal.
  const storageEvent = (key: string | null) =>
    window.dispatchEvent(new StorageEvent('storage', { key }))

  it('calls back when another tab changes the db', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToMockDb(onChange)

    storageEvent(MOCK_DB_KEY)
    expect(onChange).toHaveBeenCalledTimes(1)

    unsubscribe()
    storageEvent(MOCK_DB_KEY)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('calls back when another tab clears storage', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToMockDb(onChange)
    storageEvent(null)
    expect(onChange).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('ignores changes to other keys, like the theme', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToMockDb(onChange)
    storageEvent('theme')
    expect(onChange).not.toHaveBeenCalled()
    unsubscribe()
  })
})
