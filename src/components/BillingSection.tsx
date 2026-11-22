import { useEffect, useId, useRef, useState } from 'react'
import type { NewPayment } from '../api/schedule'
import {
  centsToInput,
  formatCents,
  parseDollars,
  paymentMethodLabel,
  type VisitBilling,
} from '../lib/billing'
import type { PaymentMethod } from '../types'

const methods = Object.keys(paymentMethodLabel) as PaymentMethod[]

type BillingSectionProps = {
  billing: VisitBilling
  planName: string | null // null = no insurance on file
  canRecord: boolean
  isSaving: boolean
  // Resolves when saved (rejects if it fails; the error shows as saveError).
  onRecord: (input: NewPayment) => Promise<void>
  saveError: string | null
}

// The check-in drawer's Billing section, for a checked-out visit: what was
// done, what the plan should pay (an estimate), what the patient owes, and a
// pretend Record payment. Nothing is charged and no claim is sent.
export function BillingSection({
  billing,
  planName,
  canRecord,
  isSaving,
  onRecord,
  saveError,
}: BillingSectionProps) {
  const { items, estimate, paidCents, balanceCents } = billing
  const ids = useId()

  // null = "use the balance", so after a payment the field shows the new
  // balance without an effect copying it in.
  const [amount, setAmount] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [amountError, setAmountError] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Paying in full removes the form, and focus with it. Put focus on the
  // status line ("Paid in full") so keyboard users stay in the drawer.
  // Only on that change, not when the drawer opens on a visit already paid.
  const lastBalance = useRef(balanceCents)
  useEffect(() => {
    const wasDue = lastBalance.current > 0
    lastBalance.current = balanceCents
    if (!wasDue || balanceCents > 0) return
    if (!sectionRef.current?.contains(document.activeElement)) {
      statusRef.current?.focus()
    }
  }, [balanceCents])

  const status =
    estimate.patientCents === 0
      ? 'Nothing to collect'
      : balanceCents === 0
        ? 'Paid in full'
        : `Balance due: ${formatCents(balanceCents)}`

  return (
    <section
      ref={sectionRef}
      aria-labelledby={`${ids}-heading`}
      className="flex flex-col gap-3 border-t border-slate-200 pt-4"
    >
      <h3 id={`${ids}-heading`} className="text-sm font-semibold">
        Billing
      </h3>

      <table className="w-full text-sm">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="text-left text-xs text-slate-600">
            <th scope="col" className="pb-1 font-medium">
              Item
            </th>
            <th scope="col" className="pb-1 text-right font-medium">
              Fee
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="py-1.5">{item.name}</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatCents(item.cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        <dt>Total</dt>
        <dd className="text-right tabular-nums">
          {formatCents(estimate.totalCents)}
        </dd>
        <dt>
          Insurance estimate
          <span className="text-slate-600">
            {planName ? ` (${planName})` : ' (none on file)'}
          </span>
        </dt>
        <dd className="text-right tabular-nums">
          −{formatCents(estimate.insuranceCents)}
        </dd>
        <dt className="font-semibold">Patient share</dt>
        <dd className="text-right font-semibold tabular-nums">
          {formatCents(estimate.patientCents)}
        </dd>
        {paidCents > 0 && (
          <>
            <dt>Paid so far</dt>
            <dd className="text-right tabular-nums">
              {formatCents(paidCents)}
            </dd>
          </>
        )}
      </dl>

      {estimate.maximumReached && (
        <p className="text-xs text-slate-700">
          Annual maximum: the plan has{' '}
          {estimate.insuranceCents === 0
            ? 'no benefit'
            : `only ${formatCents(estimate.insuranceCents)}`}{' '}
          left this year, so it pays less than its usual share.
        </p>
      )}

      {/* Polite: says the new balance after each payment or Undo. */}
      <p
        ref={statusRef}
        role="status"
        tabIndex={-1}
        className={`text-sm font-semibold ${balanceCents > 0 ? 'text-amber-800' : 'text-green-800'}`}
      >
        {status}
      </p>

      {balanceCents > 0 && !canRecord && (
        <p className="text-sm text-slate-700">
          The front desk records payments.
        </p>
      )}

      {balanceCents > 0 && canRecord && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (isSaving) return
            const cents = parseDollars(amount ?? centsToInput(balanceCents))
            if (cents === null || cents <= 0) {
              setAmountError(true)
              amountRef.current?.focus()
              return
            }
            setAmountError(false)
            onRecord({ cents, method }).then(
              () => setAmount(null),
              () => {}, // the error shows as saveError
            )
          }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-amount`} className="text-sm font-semibold">
              Amount
            </label>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-sm text-slate-700">
                $
              </span>
              <input
                ref={amountRef}
                id={`${ids}-amount`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount ?? centsToInput(balanceCents)}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={amountError || undefined}
                aria-describedby={
                  amountError ? `${ids}-amount-error` : undefined
                }
                className="h-11 w-32 rounded-lg border border-slate-300 px-2.5 text-sm tabular-nums aria-invalid:border-red-700"
              />
            </div>
            {amountError && (
              <p
                id={`${ids}-amount-error`}
                className="text-sm font-medium text-red-700"
              >
                Enter an amount in dollars, like 40.00.
              </p>
            )}
          </div>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-semibold">Paid by</legend>
            <div className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <label
                  key={m}
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm"
                >
                  <input
                    type="radio"
                    name={`${ids}-method`}
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="size-4 accent-teal-700"
                  />
                  {paymentMethodLabel[m]}
                </label>
              ))}
            </div>
          </fieldset>

          {saveError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              aria-disabled={isSaving}
              className="h-11 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 aria-disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Record payment'}
            </button>
            <p className="text-xs text-slate-600">
              Demo only: no card is charged.
            </p>
          </div>
        </form>
      )}
    </section>
  )
}
