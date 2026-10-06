import { useState } from 'react'
import type { PaymentMethod, Transaction } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { DomainError } from '@/data/repository'
import { CASH_METHODS } from '@/domain/methods'
import { hasErrors, validatePurchase, type FieldErrors } from '@/domain/validation'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '@/lib/dates'
import { useMoneyField } from '@/hooks/useMoneyField'
import { Button } from '../ui/Button'
import { MoneyInput } from '../ui/MoneyInput'
import { MethodPicker } from '../ui/MethodPicker'
import { TextField } from '../ui/TextField'
import { transactionSummaryLine } from '../TransactionItem'
import { EditDateTime } from './EditDateTime'

export function PurchaseForm({ editing }: { editing?: Transaction }) {
  const { settings, addTransaction, editTransaction } = useStore()
  const { closeSheet, toast } = useUI()

  const money = useMoneyField(editing?.amountCents ?? 0)
  const [method, setMethod] = useState<PaymentMethod | null>(
    editing?.paymentMethod ?? (settings.lastMethod === 'FICHA' ? 'PIX' : settings.lastMethod),
  )
  const [supplier, setSupplier] = useState(editing?.supplier ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [date, setDate] = useState(editing ? toDateInput(editing.createdAt) : '')
  const [time, setTime] = useState(editing ? toTimeInput(editing.createdAt) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dateError, setDateError] = useState<string>()

  const submit = () => {
    const found = validatePurchase({ amountCents: money.cents, method })
    setErrors(found)
    if (editing && !date) {
      setDateError('Informe a data.')
      return
    }
    setDateError(undefined)
    if (hasErrors(found) || !method || money.cents === null) return

    try {
      if (editing) {
        const tx = editTransaction(editing.id, {
          amountCents: money.cents,
          paymentMethod: method,
          supplier,
          note,
          createdAt: fromDateTimeInputs(date, time),
        })
        toast({ title: 'Compra atualizada', description: transactionSummaryLine(tx) })
      } else {
        const tx = addTransaction({ type: 'PURCHASE', amountCents: money.cents, paymentMethod: method, supplier, note })
        toast({ title: 'Compra registrada', description: transactionSummaryLine(tx) })
      }
      closeSheet()
    } catch (e) {
      toast({
        kind: 'error',
        title: 'Não foi possível salvar',
        description: e instanceof DomainError ? e.message : 'Tente novamente.',
      })
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <MoneyInput
        label="Valor"
        value={money.text}
        onChange={(v) => {
          money.set(v)
          if (errors.amount) setErrors((er) => ({ ...er, amount: undefined }))
        }}
        error={errors.amount}
        autoFocus
        onEnter={submit}
      />

      <MethodPicker
        value={method}
        methods={CASH_METHODS}
        onChange={(m) => {
          setMethod(m)
          setErrors((er) => ({ ...er, method: undefined }))
        }}
        error={errors.method}
      />

      <TextField label="Fornecedor" optional value={supplier} onChange={setSupplier} placeholder="Ex.: Atacado Moda Center" maxLength={80} />
      <TextField label="Observação" optional value={note} onChange={setNote} placeholder="Ex.: Reposição de blusas" maxLength={160} />

      {editing && <EditDateTime date={date} time={time} onDate={setDate} onTime={setTime} error={dateError} />}

      <Button type="submit" size="lg" full>
        {editing ? 'Salvar alterações' : 'Registrar compra'}
      </Button>
    </form>
  )
}
