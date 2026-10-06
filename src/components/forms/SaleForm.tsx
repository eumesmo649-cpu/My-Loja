import { useMemo, useState } from 'react'
import type { PaymentMethod, Transaction } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { DomainError } from '@/data/repository'
import { newlyNegativeCustomers } from '@/domain/balances'
import { SALE_METHODS } from '@/domain/methods'
import { hasErrors, validateSale, type FieldErrors } from '@/domain/validation'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '@/lib/dates'
import { useMoneyField } from '@/hooks/useMoneyField'
import { Button } from '../ui/Button'
import { MoneyInput } from '../ui/MoneyInput'
import { MethodPicker } from '../ui/MethodPicker'
import { CustomerPicker } from '../CustomerPicker'
import { transactionSummaryLine } from '../TransactionItem'
import { EditDateTime } from './EditDateTime'

interface SaleFormProps {
  /** Se informado, edita essa venda em vez de criar uma nova. */
  editing?: Transaction
  presetCustomerId?: string
}

export function SaleForm({ editing, presetCustomerId }: SaleFormProps) {
  const { settings, customers, transactions, addTransaction, editTransaction } = useStore()
  const { closeSheet, toast, confirm } = useUI()

  const money = useMoneyField(editing?.amountCents ?? 0)
  const [method, setMethod] = useState<PaymentMethod | null>(
    editing ? editing.paymentMethod : presetCustomerId ? 'FICHA' : settings.lastMethod,
  )
  const [customerId, setCustomerId] = useState<string | null>(editing?.customerId ?? presetCustomerId ?? null)
  const [date, setDate] = useState(editing ? toDateInput(editing.createdAt) : '')
  const [time, setTime] = useState(editing ? toTimeInput(editing.createdAt) : '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [dateError, setDateError] = useState<string>()

  const isFicha = method === 'FICHA'
  const customerName = useMemo(() => customers.find((c) => c.id === customerId)?.name, [customers, customerId])

  const submit = async () => {
    const found = validateSale({ amountCents: money.cents, method, customerId: isFicha ? customerId : null })
    setErrors(found)
    if (editing && !date) {
      setDateError('Informe a data.')
      return
    }
    setDateError(undefined)
    if (hasErrors(found) || !method || money.cents === null) return

    try {
      if (editing) {
        const patch = {
          amountCents: money.cents,
          paymentMethod: method,
          customerId: isFicha ? customerId : null,
          createdAt: fromDateTimeInputs(date, time),
        }
        // simula o resultado: se algum cliente ficar com saldo negativo, pede confirmação
        const after = transactions.map((t) => (t.id === editing.id ? { ...t, ...patch } : t))
        const negative = newlyNegativeCustomers(transactions, after)
        if (negative.length > 0) {
          const names = negative.map((id) => customers.find((c) => c.id === id)?.name ?? 'Cliente').join(', ')
          const ok = await confirm({
            title: 'Saldo ficará negativo',
            message: `Com essa alteração, ${names} terá recebido mais do que comprou na ficha (saldo de crédito). Deseja salvar mesmo assim?`,
            confirmLabel: 'Salvar mesmo assim',
          })
          if (!ok) return
        }
        const tx = editTransaction(editing.id, patch)
        toast({ title: 'Venda atualizada', description: transactionSummaryLine(tx, customerName) })
      } else {
        const tx = addTransaction({
          type: 'SALE',
          amountCents: money.cents,
          paymentMethod: method,
          customerId: isFicha ? customerId : null,
        })
        toast({ title: 'Venda registrada', description: transactionSummaryLine(tx, isFicha ? customerName : undefined) })
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
        void submit()
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
        onEnter={() => void submit()}
      />

      <MethodPicker
        value={method}
        methods={SALE_METHODS}
        onChange={(m) => {
          setMethod(m)
          setErrors((er) => ({ ...er, method: undefined }))
        }}
        error={errors.method}
      />

      {isFicha && (
        <CustomerPicker
          value={customerId}
          onChange={(id) => {
            setCustomerId(id)
            setErrors((er) => ({ ...er, customer: undefined }))
          }}
          allowCreate
          error={errors.customer}
        />
      )}

      {editing && <EditDateTime date={date} time={time} onDate={setDate} onTime={setTime} error={dateError} />}

      <Button type="submit" size="lg" full>
        {editing ? 'Salvar alterações' : 'Registrar venda'}
      </Button>
    </form>
  )
}
