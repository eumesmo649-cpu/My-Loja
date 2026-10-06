import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { PaymentMethod, Transaction } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { DomainError } from '@/data/repository'
import { customerBalance } from '@/domain/balances'
import { CASH_METHODS } from '@/domain/methods'
import { hasErrors, validatePayment, type FieldErrors } from '@/domain/validation'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { useMoneyField } from '@/hooks/useMoneyField'
import { Button } from '../ui/Button'
import { MoneyInput } from '../ui/MoneyInput'
import { MethodPicker } from '../ui/MethodPicker'
import { CustomerPicker } from '../CustomerPicker'
import { transactionSummaryLine } from '../TransactionItem'
import { EditDateTime } from './EditDateTime'

interface PaymentFormProps {
  editing?: Transaction
  presetCustomerId?: string
}

export function PaymentForm({ editing, presetCustomerId }: PaymentFormProps) {
  const { settings, customers, transactions, addTransaction, editTransaction } = useStore()
  const { closeSheet, toast } = useUI()

  const initialMethod: PaymentMethod =
    editing?.paymentMethod ?? (settings.lastMethod === 'FICHA' ? 'PIX' : settings.lastMethod)

  const money = useMoneyField(editing?.amountCents ?? 0)
  const [method, setMethod] = useState<PaymentMethod | null>(initialMethod)
  const [customerId, setCustomerId] = useState<string | null>(editing?.customerId ?? presetCustomerId ?? null)
  const [date, setDate] = useState(editing ? toDateInput(editing.createdAt) : '')
  const [time, setTime] = useState(editing ? toTimeInput(editing.createdAt) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dateError, setDateError] = useState<string>()
  /** Pessoa já viu o aviso de "valor maior que o saldo" e confirmou. */
  const [overConfirmed, setOverConfirmed] = useState(false)
  const [showOverWarning, setShowOverWarning] = useState(false)

  const customer = customers.find((c) => c.id === customerId)
  // Ao editar, o saldo "de referência" desconta o próprio lançamento que está sendo alterado.
  const balance = customerId
    ? customerBalance(customerId, editing ? transactions.filter((t) => t.id !== editing.id) : transactions)
    : 0

  // qualquer mudança no valor/cliente invalida a confirmação anterior
  useEffect(() => {
    setOverConfirmed(false)
    setShowOverWarning(false)
  }, [money.cents, customerId])

  const submit = () => {
    const { errors: found, exceedsBalance } = validatePayment({
      amountCents: money.cents,
      method,
      customerId,
      balanceCents: balance,
    })
    setErrors(found)
    if (editing && !date) {
      setDateError('Informe a data.')
      return
    }
    setDateError(undefined)
    if (hasErrors(found) || !method || !customerId || money.cents === null) return

    // Nunca deixa passar do saldo sem confirmação explícita
    if (exceedsBalance && !overConfirmed) {
      setShowOverWarning(true)
      setOverConfirmed(true)
      return
    }

    try {
      if (editing) {
        const tx = editTransaction(editing.id, {
          amountCents: money.cents,
          paymentMethod: method,
          customerId,
          createdAt: fromDateTimeInputs(date, time),
        })
        toast({ title: 'Recebimento atualizado', description: transactionSummaryLine(tx, customer?.name) })
      } else {
        const tx = addTransaction({ type: 'PAYMENT', amountCents: money.cents, paymentMethod: method, customerId })
        const remaining = balance - tx.amountCents
        toast({
          title: 'Recebimento registrado',
          description: `${transactionSummaryLine(tx, customer?.name)}${
            remaining > 0 ? ` · Falta ${formatBRL(remaining)}` : remaining === 0 ? ' · Ficha quitada' : ''
          }`,
        })
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

  const over = money.cents !== null && money.cents > Math.max(0, balance)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      noValidate
    >
      <CustomerPicker
        value={customerId}
        onChange={(id) => {
          setCustomerId(id)
          setErrors((er) => ({ ...er, customer: undefined }))
        }}
        onlyOwing={!editing}
        error={errors.customer}
        autoFocus={!customerId}
      />

      {customer && (
        <div className="flex items-center justify-between rounded-2xl bg-clay-50 px-4 py-3.5">
          <span className="text-[15px] font-semibold text-clay-700">Saldo devedor atual</span>
          <span className="num text-xl font-bold text-clay-700">{formatBRL(Math.max(0, balance))}</span>
        </div>
      )}

      <div>
        <MoneyInput
          label="Valor recebido"
          value={money.text}
          onChange={(v) => {
            money.set(v)
            if (errors.amount) setErrors((er) => ({ ...er, amount: undefined }))
          }}
          error={errors.amount}
          autoFocus={!!customerId}
          onEnter={submit}
        />
        {customer && balance > 0 && (
          <button
            type="button"
            onClick={() => money.setCents(balance)}
            className="mt-2 min-h-10 rounded-xl px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
          >
            Receber tudo ({formatBRL(balance)})
          </button>
        )}
      </div>

      <MethodPicker
        label="Como o cliente pagou"
        value={method}
        methods={CASH_METHODS}
        onChange={(m) => {
          setMethod(m)
          setErrors((er) => ({ ...er, method: undefined }))
        }}
        error={errors.method}
      />

      {editing && <EditDateTime date={date} time={time} onDate={setDate} onTime={setTime} error={dateError} />}

      {showOverWarning && over && (
        <div role="alert" className="flex gap-3 rounded-2xl border border-clay-100 bg-clay-50 p-4 text-clay-700">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p className="text-[15px] leading-snug">
            <strong>Esse valor é maior que o saldo devedor</strong> ({formatBRL(Math.max(0, balance))}). O cliente ficará com
            crédito de {formatBRL((money.cents ?? 0) - Math.max(0, balance))}. Toque em “Confirmar mesmo assim” para continuar.
          </p>
        </div>
      )}

      <Button type="submit" size="lg" full variant={showOverWarning && over ? 'danger' : 'primary'}>
        {showOverWarning && over ? 'Confirmar mesmo assim' : editing ? 'Salvar alterações' : 'Registrar recebimento'}
      </Button>
    </form>
  )
}
