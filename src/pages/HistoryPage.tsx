import { useMemo, useState } from 'react'
import { SearchX } from 'lucide-react'
import type { TransactionType } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { filterByRange, summarize } from '@/domain/summary'
import { addDays, dateFromKey, dayKey, relativeDayLabel, todayKey } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { useNow } from '@/hooks/useNow'
import { useCustomerLookup } from '@/hooks/useCustomerLookup'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Segmented } from '@/components/ui/Segmented'
import { PageHeader } from '@/components/layout/PageHeader'
import { TransactionItem } from '@/components/TransactionItem'

type TypeFilter = 'ALL' | TransactionType
type Period = 'today' | '7d' | 'month' | 'custom'

const PAGE_SIZE = 80

const inputClass =
  'mt-1.5 min-h-12 w-full rounded-2xl border border-line bg-card px-3.5 text-base outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100'

export function HistoryPage() {
  const { transactions } = useStore()
  const { openSheet } = useUI()
  const customerName = useCustomerLookup()
  const now = useNow()
  const today = todayKey(now)

  const [type, setType] = useState<TypeFilter>('ALL')
  const [period, setPeriod] = useState<Period>('7d')
  const [from, setFrom] = useState(() => addDays(todayKey(), -29))
  const [to, setTo] = useState(() => todayKey())
  const [limit, setLimit] = useState(PAGE_SIZE)

  const range = useMemo<[number, number] | null>(() => {
    const d = dateFromKey(today)
    switch (period) {
      case 'today':
        return [d.getTime(), dateFromKey(addDays(today, 1)).getTime()]
      case '7d':
        return [dateFromKey(addDays(today, -6)).getTime(), dateFromKey(addDays(today, 1)).getTime()]
      case 'month':
        return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]
      case 'custom':
        if (!from || !to || from > to) return null
        return [dateFromKey(from).getTime(), dateFromKey(addDays(to, 1)).getTime()]
    }
  }, [period, today, from, to])

  const invalidRange = period === 'custom' && range === null

  const filtered = useMemo(() => {
    if (!range) return []
    const inRange = filterByRange(transactions, range[0], range[1])
    return type === 'ALL' ? inRange : inRange.filter((t) => t.type === type)
  }, [transactions, range, type])

  const summary = useMemo(() => summarize(filtered), [filtered])

  const visible = filtered.slice(0, limit)
  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>()
    for (const t of visible) {
      const k = dayKey(t.createdAt)
      const arr = map.get(k)
      if (arr) arr.push(t)
      else map.set(k, [t])
    }
    return [...map.entries()]
  }, [visible])

  const totalLabel =
    type === 'SALE' ? formatBRL(summary.salesCents) : type === 'PAYMENT' ? formatBRL(summary.paymentsCents) : type === 'PURCHASE' ? formatBRL(summary.purchasesCents) : null

  const resetFilters = () => {
    setType('ALL')
    setPeriod('month')
    setLimit(PAGE_SIZE)
  }

  return (
    <div>
      <PageHeader title="Histórico" subtitle="Todas as vendas, prestações e compras" />

      <div className="flex flex-col gap-3">
        <Segmented
          ariaLabel="Tipo de movimentação"
          value={type}
          onChange={(v) => {
            setType(v)
            setLimit(PAGE_SIZE)
          }}
          options={[
            { value: 'ALL', label: 'Todas' },
            { value: 'SALE', label: 'Vendas' },
            { value: 'PAYMENT', label: 'Prestações' },
            { value: 'PURCHASE', label: 'Compras' },
          ]}
        />
        <Segmented
          ariaLabel="Período"
          value={period}
          onChange={(v) => {
            setPeriod(v)
            setLimit(PAGE_SIZE)
          }}
          options={[
            { value: 'today', label: 'Hoje' },
            { value: '7d', label: '7 dias' },
            { value: 'month', label: 'Este mês' },
            { value: 'custom', label: 'Personalizado' },
          ]}
        />
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="h-from" className="text-sm font-semibold text-muted">
                De
              </label>
              <input id="h-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="h-to" className="text-sm font-semibold text-muted">
                Até
              </label>
              <input id="h-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {invalidRange ? (
        <p role="alert" className="mt-5 rounded-2xl bg-danger-50 px-4 py-3 text-[15px] font-medium text-danger-700">
          A data inicial precisa ser anterior (ou igual) à data final.
        </p>
      ) : (
        <p className="num mb-3 mt-5 text-sm font-semibold text-muted" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? 'movimentação' : 'movimentações'}
          {totalLabel && filtered.length > 0 ? ` · total ${totalLabel}` : ''}
        </p>
      )}

      {!invalidRange && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={SearchX}
            title="Nada por aqui"
            description="Não há movimentações com esses filtros. Tente outro período ou tipo."
            action={
              <Button variant="soft" onClick={resetFilters}>
                Ver o mês inteiro
              </Button>
            }
          />
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {groups.map(([key, items]) => (
          <section key={key} aria-label={relativeDayLabel(key, now)}>
            <h2 className="mb-2 px-1 text-[15px] font-bold tracking-tight">{relativeDayLabel(key, now)}</h2>
            <Card className="divide-y divide-line overflow-hidden">
              {items.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  tx={tx}
                  customerName={customerName(tx.customerId)}
                  onClick={() => openSheet({ kind: 'detail', id: tx.id })}
                />
              ))}
            </Card>
          </section>
        ))}
      </div>

      {filtered.length > limit && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
            Mostrar mais ({filtered.length - limit})
          </Button>
        </div>
      )}
    </div>
  )
}
