import { screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'
import { renderWithQuery } from './test/render'
import type { Role } from './types'

// Fake data only; payments are pretend. In the seed, Ana Diaz (Maple) is
// checked out: her cleaning is $250.00, her plan has only $60.00 left this
// year, so she owes $190.00.

async function renderAs(role: Role = 'front-desk') {
  renderWithQuery(<App />, { role })
  await screen.findByRole('button', { name: /^jon kim,/i }) // schedule loaded
}

async function openDrawer(user: UserEvent, name: string) {
  await user.click(
    screen.getByRole('button', { name: new RegExp(`^${name},`) }),
  )
  return screen.getByRole('dialog', { name })
}

const billingOf = (drawer: HTMLElement) =>
  within(within(drawer).getByRole('region', { name: 'Billing' }))

async function recordPayment(
  user: UserEvent,
  drawer: HTMLElement,
  amount: string,
  method: RegExp = /card/i,
) {
  const billing = billingOf(drawer)
  const field = billing.getByLabelText('Amount')
  await user.clear(field)
  await user.type(field, amount)
  await user.click(billing.getByRole('radio', { name: method }))
  await user.click(billing.getByRole('button', { name: 'Record payment' }))
}

describe('billing at checkout', () => {
  it('shows line items, the insurance estimate and what the patient owes', async () => {
    const user = userEvent.setup()
    await renderAs()
    const billing = billingOf(await openDrawer(user, 'Ana Diaz'))

    const rows = billing
      .getAllByRole('row')
      .slice(1) // the header row
      .map((row) => row.textContent)
    expect(rows).toEqual([
      'Routine cleaning$110.00',
      'Periodic exam$65.00',
      'Bitewing X-rays$75.00',
    ])
    expect(billing.getByText('Total').nextSibling).toHaveTextContent('$250.00')
    expect(
      billing.getByText(/insurance estimate/i).nextSibling,
    ).toHaveTextContent('$60.00')
    expect(billing.getByText('Patient share').nextSibling).toHaveTextContent(
      '$190.00',
    )
    expect(billing.getByText(/annual maximum/i)).toBeInTheDocument()
    expect(billing.getByRole('status')).toHaveTextContent(
      'Balance due: $190.00',
    )
    // The amount starts at the balance.
    expect(billing.getByLabelText('Amount')).toHaveValue('190.00')
  })

  it('has no Billing section before checkout', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Jon Kim') // arrived
    expect(
      within(drawer).queryByRole('region', { name: 'Billing' }),
    ).not.toBeInTheDocument()
  })

  it('records a partial payment, ticks Copay collected, and shows the balance left', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Ana Diaz')
    expect(
      within(drawer).getByRole('checkbox', { name: 'Copay collected' }),
    ).not.toBeChecked()

    await recordPayment(user, drawer, '50', /cash/i)

    expect(
      await screen.findByText('Ana Diaz: $50.00 paid in cash'),
    ).toBeInTheDocument()
    const billing = billingOf(drawer)
    expect(billing.getByRole('status')).toHaveTextContent(
      'Balance due: $140.00',
    )
    expect(billing.getByText(/paid so far/i).nextSibling).toHaveTextContent(
      '$50.00',
    )
    expect(
      within(drawer).getByRole('checkbox', { name: 'Copay collected' }),
    ).toBeChecked()
    expect(billing.getByLabelText('Amount')).toHaveValue('140.00')
  })

  it('undoes a payment from the toast', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Ana Diaz')
    await recordPayment(user, drawer, '50')
    await screen.findByText('Ana Diaz: $50.00 paid by card')

    await user.click(
      screen.getByRole('button', { name: 'Undo payment for Ana Diaz' }),
    )

    expect(
      await screen.findByText('Ana Diaz: payment of $50.00 undone'),
    ).toBeInTheDocument()
    expect(billingOf(drawer).getByRole('status')).toHaveTextContent(
      'Balance due: $190.00',
    )
    expect(
      within(drawer).getByRole('checkbox', { name: 'Copay collected' }),
    ).not.toBeChecked()
  })

  it('paying in full shows Paid in full and keeps focus in the drawer', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Ana Diaz')
    await recordPayment(user, drawer, '190')

    const billing = billingOf(drawer)
    expect(await billing.findByText('Paid in full')).toBeInTheDocument()
    expect(
      billing.queryByRole('button', { name: 'Record payment' }),
    ).not.toBeInTheDocument()
    expect(drawer).toContainElement(document.activeElement as HTMLElement)
  })

  it('explains an amount it cannot read, without saving', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Ana Diaz')
    await recordPayment(user, drawer, 'abc')

    const field = billingOf(drawer).getByLabelText('Amount')
    expect(field).toHaveAccessibleDescription(
      'Enter an amount in dollars, like 40.00.',
    )
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveFocus()
    expect(screen.queryByText(/paid by card/)).not.toBeInTheDocument()
  })

  it('shows the server refusing more than the balance', async () => {
    const user = userEvent.setup()
    await renderAs()
    const drawer = await openDrawer(user, 'Ana Diaz')
    await recordPayment(user, drawer, '500')

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      "That's more than the $190.00 balance.",
    )
  })

  it('says when there is nothing to collect', async () => {
    const user = userEvent.setup()
    await renderAs()
    // Tomás Reyes: a consult his plan pays in full.
    const billing = billingOf(await openDrawer(user, 'Tomás Reyes'))
    expect(billing.getByRole('status')).toHaveTextContent('Nothing to collect')
    expect(
      billing.queryByRole('button', { name: 'Record payment' }),
    ).not.toBeInTheDocument()
  })

  it('is read only for a provider', async () => {
    const user = userEvent.setup()
    await renderAs('provider')
    const billing = billingOf(await openDrawer(user, 'Ana Diaz'))
    expect(billing.getByRole('status')).toHaveTextContent(
      'Balance due: $190.00',
    )
    expect(
      billing.queryByRole('button', { name: 'Record payment' }),
    ).not.toBeInTheDocument()
    expect(
      billing.getByText(/the front desk records payments/i),
    ).toBeInTheDocument()
  })
})

describe("Today's totals", () => {
  const totals = () =>
    within(screen.getByRole('region', { name: "Today's billing" }))

  it('shows the office manager billed, collected and outstanding', async () => {
    const user = userEvent.setup()
    await renderAs('office-manager')
    expect(totals().getByText('Billed').nextSibling).toHaveTextContent(
      '$190.00',
    )
    expect(totals().getByText('Collected').nextSibling).toHaveTextContent(
      '$0.00',
    )
    expect(totals().getByText('Outstanding').nextSibling).toHaveTextContent(
      '$190.00',
    )

    const drawer = await openDrawer(user, 'Ana Diaz')
    await recordPayment(user, drawer, '40')
    await screen.findByText('Ana Diaz: $40.00 paid by card')

    expect(totals().getByText('Collected').nextSibling).toHaveTextContent(
      '$40.00',
    )
    expect(totals().getByText('Outstanding').nextSibling).toHaveTextContent(
      '$150.00',
    )
  })

  it.each(['front-desk', 'provider'] as const)(
    'is not shown to %s',
    async (role) => {
      await renderAs(role)
      expect(
        screen.queryByRole('region', { name: "Today's billing" }),
      ).not.toBeInTheDocument()
    },
  )
})
