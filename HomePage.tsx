import { useMemo } from 'react'
import { CalendarCheck, ChevronRight, Plus, ReceiptText, Settings } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { filterByDay, summarize } from '@/domain/summary'
import { dayKey, formatDayLong, greeting, todayKey } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { paths } from '@/hooks/useRoute'
import { useNow } from '@/hooks/useNow'
import { useCustomerLookup } from '@/hooks/useCustomerLookup'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PaymentBreakdown } from '@/components/PaymentBreakdown'
import { TransactionItem } from '@/components/TransactionItem'
import { SyncBadge } from '@/components/SyncBadge'

export function HomePage() {
  const { transactions, settings, receivableCents, loadDemo } = useStore()
  const { openSheet, toast } = useUI()
  const customerName = useCustomerLookup()
  const now = useNow()
  const today = todayKey(now)

  const todayTxs = useMemo(() => filterByDay(transactions, today), [transactions, today])
  const summary = useMemo(() => summarize(todayTxs), [todayTxs])
  const latest = transactions.slice(0, 6)
  const noneAtAll = transactions.length === 0

  const name = settings.ownerName.trim()

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight md:text-3xl">
            {greeting(now)}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {formatDayLong(now)}
            {!name && (
              <>
                {' · '}
                <a href={paths.settings} className="font-semibold text-brand-600 hover:underline">
                  adicionar seu nome
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SyncBadge />
          <a
            href={paths.settings}
            aria-label="Ajustes"
            className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink md:hidden"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </a>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-8">
        {/* Coluna principal: números do dia */}
        <div className="flex flex-col gap-6">
          <Card className="p-5 md:p-6">
            <p className="text-sm font-semibold text-muted">Vendas hoje</p>
            <p className="num mt-1 text-[44px] font-extrabold leading-none tracking-tight md:text-5xl">
              {formatBRL(summary.salesCents)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {summary.salesCount === 0
                ? 'Nenhuma venda ainda'
                : `${summary.salesCount} ${summary.salesCount === 1 ? 'venda' : 'vendas'} no dia`}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-sage-50 p-4">
                <p className="text-sm font-semibold text-sage-700">Recebido hoje</p>
                <p className="num mt-1 text-2xl font-bold leading-tight text-sage-700">{formatBRL(summary.receivedCents)}</p>
              </div>
              <div className="rounded-2xl bg-clay-50 p-4">
                <p className="text-sm font-semibold text-clay-700">A receber</p>
                <p className="num mt-1 text-2xl font-bold leading-tight text-clay-700">{formatBRL(receivableCents)}</p>
              </div>
            </div>

            <Button size="lg" full className="mt-5" icon={<Plus className="h-5 w-5" strokeWidth={2.6} aria-hidden />} onClick={() => openSheet({ kind: 'menu' })}>
              Registrar
            </Button>
          </Card>

          <section aria-labelledby="formas">
            <SectionTitle>
              <span id="formas">Vendas de hoje por forma de pagamento</span>
            </SectionTitle>
            <PaymentBreakdown byMethod={summary.salesByMethod} />
          </section>

          <a
            href={paths.closing}
            className="flex min-h-16 items-center gap-3.5 rounded-card border border-line bg-card p-4 shadow-card transition-colors hover:bg-sand/60"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <CalendarCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold leading-tight">Fechamento do dia</span>
              <span className="block text-sm text-muted">Confira o caixa antes de fechar a loja</span>
            </span>
            <ChevronRight className="h-5 w-5 text-faint" aria-hidden />
          </a>
        </div>

        {/* Coluna lateral: últimas movimentações */}
        <section aria-labelledby="ultimas">
          <SectionTitle
            action={
              !noneAtAll && (
                <a href={paths.history} className="min-h-10 rounded-lg px-2 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                  Ver tudo
                </a>
              )
            }
          >
            <span id="ultimas">Últimas movimentações</span>
          </SectionTitle>

          {noneAtAll ? (
            <Card>
              <EmptyState
                icon={ReceiptText}
                title="Você ainda não tem movimentações"
                description="Registre a primeira venda em poucos segundos: valor, forma de pagamento e pronto."
                action={
                  <div className="flex flex-col items-center gap-2">
                    <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => openSheet({ kind: 'sale' })}>
                      Registrar primeira venda
                    </Button>
                    <button
                      type="button"
                      className="min-h-10 rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink"
                      onClick={() => {
                        loadDemo()
                        toast({ kind: 'info', title: 'Dados de exemplo carregados', description: 'Remova quando quiser em Ajustes.' })
                      }}
                    >
                      Ver com dados de exemplo
                    </button>
                  </div>
                }
              />
            </Card>
          ) : (
            <>
              {todayTxs.length === 0 && (
                <Card className="mb-3">
                  <EmptyState
                    icon={ReceiptText}
                    title="Você ainda não tem movimentações hoje"
                    action={
                      <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => openSheet({ kind: 'sale' })}>
                        Registrar primeira venda
                      </Button>
                    }
                  />
                </Card>
              )}
              <Card className="divide-y divide-line overflow-hidden">
                {latest.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    tx={tx}
                    customerName={customerName(tx.customerId)}
                    showDate={dayKey(tx.createdAt) !== today}
                    onClick={() => openSheet({ kind: 'detail', id: tx.id })}
                  />
                ))}
              </Card>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
