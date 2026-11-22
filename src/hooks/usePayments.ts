import { useState } from 'react'
import type { NewPayment } from '../api/schedule'
import { paymentToastText, paymentUndoneText } from '../lib/billing'
import type { Permission } from '../lib/permissions'
import { nextToastKey } from '../lib/statusChange'
import type { ScheduleDay } from '../types'
import type { useRecordPayment, useVoidPayment } from './useSchedule'

type Options = {
  day: ScheduleDay | undefined
  record: ReturnType<typeof useRecordPayment>
  voidIt: ReturnType<typeof useVoidPayment>
  can: (permission: Permission) => boolean
  onChanged?: () => void // e.g. clear another toast
}

type LastPayment = {
  key: number
  paymentId: string
  appointmentId: string
  name: string
  text: string
  cents: number
  undoable: boolean // false once it has been undone
}

// Recording a payment works like a status change: it saves, shows a toast,
// and the toast offers Undo. Undo voids the payment (the record stays,
// marked voided). In a real system, undoing a charge means a refund or a
// void with the payment processor, not a quiet delete.
export function usePayments({ day, record, voidIt, can, onChanged }: Options) {
  const [last, setLast] = useState<LastPayment | null>(null)

  const nameFor = (appointmentId: string) => {
    const appt = day?.appointments.find((a) => a.id === appointmentId)
    const patient = day?.patients.find((p) => p.id === appt?.patientId)
    return patient ? `${patient.firstName} ${patient.lastName}` : 'Visit'
  }

  // Resolves once saved and the schedule has refetched; rejects on failure
  // (the error itself arrives through record.error).
  const recordPayment = async (appointmentId: string, input: NewPayment) => {
    const name = nameFor(appointmentId)
    const payment = await record.mutateAsync({ id: appointmentId, input })
    onChanged?.()
    setLast({
      key: nextToastKey(),
      paymentId: payment.id,
      appointmentId,
      name,
      cents: payment.cents,
      text: paymentToastText({
        name,
        cents: payment.cents,
        method: input.method,
      }),
      undoable: true,
    })
  }

  const undoPayment = (payment: LastPayment) => {
    voidIt.mutate(payment.paymentId, {
      onSuccess: () => {
        onChanged?.()
        setLast({
          ...payment,
          key: nextToastKey(),
          text: paymentUndoneText(payment),
          undoable: false, // no "undo the undo"
        })
      },
    })
  }

  const undo =
    last?.undoable && can('record-payment')
      ? {
          label: `Undo payment for ${last.name}`,
          onUndo: () => undoPayment(last),
        }
      : undefined

  return {
    recordPayment,
    toast: last
      ? {
          key: last.key,
          text: last.text,
          appointmentId: last.appointmentId,
          name: last.name,
        }
      : null,
    undo,
    clear: () => setLast(null),
  }
}
