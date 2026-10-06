import { useState } from 'react'
import type { PaymentMethod, Transaction } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { DomainError } from '@/data/repository'
import { CASH_METHODS } from '@/domain/methods'
import { hasErrors, validateExpense, type FieldErrors } from '@/domain/validation'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '@/lib/dates'
import { useMoneyField } from '@/hooks/useMoneyField'
import { Button } from '../ui/Button'
import { MoneyInput } from '../ui/MoneyInput'
import { MethodPicker } from '../ui/MethodPicker'
import { TextField } from '../ui/TextField'
import { transactionSummaryLine } from '../TransactionItem'
import { EditDateTime } from './EditDateTime'

/** Atalhos de 1 toque para as despesas mais comuns de uma loja. */
const SUGGESTIONS = ['Aluguel', 'Energia', 'Água', 'Internet', 'Embalagens', 'Transporte']

export function ExpenseForm({ editing }: { editing?: Transaction }) {
  const { settings, addTransaction, editTransaction } = useStore()
  const { closeSheet, toast } = useUI()

  const money = useMoneyField(editing?.amountCents ?? 0)
  const [method, setMethod] = useState<PaymentMethod | null>(
    editing?.paymentMethod ?? (settings.lastMethod === 'FICHA' ? 'PIX' : settings.lastMethod),
  )
  const [description, setDescription] = useState(editing?.note ?? '')
  const [date, setDate] = useState(editing ? toDateInput(editing.createdAt) : '')
  const [time, setTime] = useState(editing ? toTimeInput(editing.createdAt) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dateError, setDateError] = useState<string>()

  const submit = () => {
    const found = validateExpense({ amountCents: money.cents, method, description })
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
          note: description,
          createdAt: fromDateTimeInputs(date, time),
        })
        toast({ title: 'Despesa atualizada', description: `${tx.note} · ${transactionSummaryLine(tx)}` })
      } else {
        const tx = addTransaction({ type: 'EXPENSE', amountCents: money.cents, paymentMethod: method, note: description })
        toast({ title: 'Despesa registrada', description: `${tx.note} · ${transactionSummaryLine(tx)}` })
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

      <div>
        <TextField
          label="Descrição da despesa"
          value={description}
          onChange={(v) => {
            setDescription(v)
            if (errors.description) setErrors((er) => ({ ...er, description: undefined }))
          }}
          error={errors.description}
          placeholder="Ex.: Aluguel de outubro"
          maxLength={160}
          autoComplete="off"
        />
        {!editing && (
          <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Sugestões de descrição">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setDescription(s)
                  setErrors((er) => ({ ...er, description: undefined }))
                }}
                className="min-h-10 rounded-full border border-line bg-card px-3.5 text-[14px] font-semibold text-muted hover:bg-sand hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <MethodPicker
        label="Como foi pago"
        value={method}
        methods={CASH_METHODS}
        onChange={(m) => {
          setMethod(m)
          setErrors((er) => ({ ...er, method: undefined }))
        }}
        error={errors.method}
      />

      {editing && <EditDateTime date={date} time={time} onDate={setDate} onTime={setTime} error={dateError} />}

      <Button type="submit" size="lg" full>
        {editing ? 'Salvar alterações' : 'Registrar despesa'}
      </Button>
    </form>
  )
}
