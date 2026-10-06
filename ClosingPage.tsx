import { useMemo, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { filterByDay, summarize } from '@/domain/summary'
import { addDays, formatDayFull, relativeDayLabel, todayKey } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'
import { useNow } from '@/hooks/useNow'

function Line({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: 'minus' | 'plus' }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-3', strong && 'py-4')}>
      <span className={cn('text-[16px]', strong ? 'font-bold' : 'text-muted')}>{label}</span>
      <span className={cn('num font-bold', strong ? 'text-2xl' : 'text-[17px]', tone === 'minus' && value > 0 && 'text-danger-600', tone === 'plus' && value > 0 && 'text-sage-600')}>
        {tone === 'minus' && value > 0 ? '−' : ''}
        {formatBRL(value)}
      </span>
    </div>
  )
}

export function ClosingPage() {
  const { transactions, settings, closeDay, reopenDay } = useStore()
  const { toast, confirm } = useUI()
  const now = useNow()
  const today = todayKey(now)
  const [day, setDay] = useState(today)

  const s = useMemo(() => summarize(filterByDay(transactions, day)), [transactions, day])
  const closing = settings.closings[day]
  const changedSince = closing && (closing.salesCents !== s.salesCents || closing.receivedCents !== s.receivedCents)

  const onClose = () => {
    closeDay(day, { salesCents: s.salesCents, receivedCents: s.receivedCents })
    toast({ title: 'Dia conferido', description: `Recebido ${formatBRL(s.receivedCents)}` })
  }

  const onReopen = async () => {
    const ok = await confirm({ title: 'Reabrir este dia?', message: 'A marcação de “conferido” será removida. Seus lançamentos continuam intactos.', confirmLabel: 'Reabrir' })
    if (ok) reopenDay(day)
  }

  return (
    <div>
      <PageHeader title="Fechamento do dia" subtitle="Confira o caixa antes de fechar a loja" />

      <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-line bg-card p-1.5">
        <button type="button" aria-label="Dia anterior" onClick={() => setDay(addDays(day, -1))} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-sand">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="text-center">
          <p className="font-bold leading-tight">{relativeDayLabel(day, now)}</p>
          <p className="num text-sm text-muted">{formatDayFull(addDays(day, 0) + 'T12:00:00')}</p>
        </div>
        <button type="button" aria-label="Próximo dia" disabled={day >= today} onClick={() => setDay(addDays(day, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-sand disabled:opacity-30">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-semibold text-muted">Vendas do dia</h2>
          <div className="divide-y divide-line">
            <Line label="Vendas" value={s.salesCents} strong />
            <Line label="PIX" value={s.salesByMethod.PIX} />
            <Line label="Espécie" value={s.salesByMethod.CASH} />
            <Line label="Débito" value={s.salesByMethod.DEBIT} />
            <Line label="Crédito" value={s.salesByMethod.CREDIT} />
            <Line label="Ficha (a receber)" value={s.salesByMethod.FICHA} />
          </div>
        </Card>

        <Card className="px-5 py-2">
          <h2 className="pt-3 text-[15px] font-semibold text-muted">Dinheiro do dia</h2>
          <div className="divide-y divide-line">
            <Line label="Vendas à vista" value={s.cashSalesCents} />
            <Line label="Recebimentos de fichas" value={s.paymentsCents} />
            <Line label="Total recebido" value={s.receivedCents} strong tone="plus" />
            <Line label="Compras de mercadoria" value={s.purchasesCents} tone="minus" />
            <Line label="Despesas" value={s.expensesCents} tone="minus" />
            <Line label="Saldo do dia" value={s.netCents} strong />
          </div>
        </Card>
      </div>

      <div className="mt-6">
        {closing ? (
          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-sage-50 text-sage-600">
                <CircleCheck className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="font-bold leading-tight">Dia conferido</p>
                {changedSince ? (
                  <p className="text-sm font-medium text-clay-700">Há lançamentos que mudaram depois da conferência.</p>
                ) : (
                  <p className="text-sm text-muted">Os valores batem com o que foi conferido.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {changedSince && (
                <Button size="sm" onClick={onClose}>
                  Conferir de novo
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => void onReopen()}>
                Reabrir
              </Button>
            </div>
          </Card>
        ) : (
          <Button size="lg" full icon={<CalendarCheck className="h-5 w-5" aria-hidden />} onClick={onClose}>
            Marcar dia como conferido
          </Button>
        )}
      </div>
    </div>
  )
}
