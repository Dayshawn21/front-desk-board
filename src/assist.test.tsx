import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { SanitizedDraft } from './lib/assist'
import { renderWithQuery } from './test/render'

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const anaCleaning: SanitizedDraft = {
  draft: {
    patientId: 'p-ana',
    visitType: 'cleaning',
    durationMinutes: null,
    chairId: 'maple-c2',
    timeOfDay: 'afternoon',
    earliest: null,
    notUsed: [],
  },
  warnings: [],
}

afterEach(() => vi.restoreAllMocks())

async function openBooking() {
  const user = userEvent.setup()
  renderWithQuery(<App />)
  await screen.findByRole('button', { name: /jon kim/i })
  await user.click(screen.getByRole('button', { name: /new appointment/i }))
  const dialog = screen.getByRole('dialog', { name: /new appointment/i })
  return { user, dialog }
}

async function askAi(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  text: string,
) {
  await user.type(within(dialog).getByLabelText(/describe the visit/i), text)
  await user.click(
    within(dialog).getByRole('button', { name: /fill in with ai/i }),
  )
}

const times = (dialog: HTMLElement) =>
  within(dialog)
    .queryAllByRole('radio')
    .map((radio) => radio.closest('label')?.textContent ?? '')

describe('AI booking assist', () => {
  it('sends the practice and the typed request to our server route', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(reply(200, anaCleaning))
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Ana this afternoon with Patel')

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/parse-booking')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      practiceId: 'maple',
      text: 'Cleaning for Ana this afternoon with Patel',
    })
  })

  it('fills in the form, labels it for review, and updates the suggested times', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, anaCleaning))
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Ana this afternoon with Patel')

    expect(
      await within(dialog).findByText(/ai-filled\. review before booking/i),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/patient/i)).toHaveValue('p-ana')
    expect(within(dialog).getByLabelText(/visit type/i)).toHaveValue('cleaning')
    expect(within(dialog).getByLabelText(/length/i)).toHaveValue('60') // typical cleaning
    expect(within(dialog).getByLabelText(/^chair/i)).toHaveValue('maple-c2')
    expect(within(dialog).getByLabelText(/time of day/i)).toHaveValue(
      'afternoon',
    )
    expect(times(dialog)[0]).toMatch(/12:00 PM.*chair 2/i)
  })

  it('never books by itself: a person still picks a time and clicks Book', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, anaCleaning))
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Ana this afternoon')
    await within(dialog).findByText(/ai-filled/i)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      within(dialog)
        .getAllByRole('radio')
        .some((r) => (r as HTMLInputElement).checked),
    ).toBe(false)
    expect(screen.queryByText(/^booked/i)).not.toBeInTheDocument()
  })

  it('uses a stated start time and length', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(200, {
        ...anaCleaning,
        draft: {
          ...anaCleaning.draft,
          chairId: 'maple-c1',
          durationMinutes: 30,
          timeOfDay: null,
          earliest: '14:15',
        },
      }),
    )
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, '30 min cleaning for Ana after 2:15 in chair 1')

    await within(dialog).findByText(/ai-filled/i)
    expect(within(dialog).getByLabelText(/length/i)).toHaveValue('30')
    expect(within(dialog).getByLabelText(/time of day/i)).toHaveDisplayValue(
      /from 2:15 PM/i,
    )
    expect(times(dialog)[0]).toMatch(/2:15 PM.*chair 1/i)
  })

  it('shows what it could not use', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply(200, {
        draft: {
          ...anaCleaning.draft,
          patientId: null,
          notUsed: ['next Tuesday'],
        },
        warnings: ["The patient wasn't found in this practice's list."],
      }),
    )
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Zed next Tuesday')

    const note = await within(dialog).findByText(/ai-filled/i)
    const box = note.closest('[role="status"]') as HTMLElement
    expect(box).toHaveTextContent(/patient wasn't found/i)
    expect(box).toHaveTextContent(/not used: next tuesday/i)
    expect(within(dialog).getByLabelText(/patient/i)).toHaveValue('')
  })

  it('shows a loading state while it reads the request', async () => {
    let resolve!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      new Promise<Response>((r) => (resolve = r)),
    )
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Ana')

    expect(within(dialog).getByText(/reading the request/i)).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: /reading/i }),
    ).toHaveAttribute('aria-disabled', 'true')

    resolve(reply(200, anaCleaning))
    expect(await within(dialog).findByText(/ai-filled/i)).toBeInTheDocument()
  })

  it('shows the error with Try again, and retrying works', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        reply(502, { error: 'AI assist is unavailable right now. Try again.' }),
      )
      .mockResolvedValueOnce(reply(200, anaCleaning))
    const { user, dialog } = await openBooking()

    await askAi(user, dialog, 'Cleaning for Ana')

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /unavailable right now/i,
    )
    await user.click(within(dialog).getByRole('button', { name: /try again/i }))

    expect(await within(dialog).findByText(/ai-filled/i)).toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks for text before calling the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user, dialog } = await openBooking()

    await user.click(
      within(dialog).getByRole('button', { name: /fill in with ai/i }),
    )

    expect(
      within(dialog).getByText(/type a request first/i),
    ).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
