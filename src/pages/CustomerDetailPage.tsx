import { useMemo } from 'react'
import { ChevronLeft, HandCoins, Pencil, Phone, ShoppingBag, Trash2 } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { customerLedger } from '@/domain/balances'
import { formatDayShort } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { DomainError } from '@/data/repository'
import { navigate, paths } from '@/hooks/useRoute'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { CustomerAvatar } from '@/components/CustomerAvatar'

export function CustomerDetailPage({ id }: { id: string }) {
  const { customers, transactions, balances, removeCustomer, restoreCustomer } = useStore()
  const { openSheet, confirm, toast } = useUI()

  const customer = customers.find((c) => c.id === id)
  const ledger = useMemo(() => customerLedger(id, transactions).reverse(), [id, transactions])

  if (!customer) {
    return (
      <ErrorState
        title="Cliente não encontrado"
        description="Esse cliente não existe mais ou o link está incorreto."
        action={
          <a href={paths.customers}>
            <Button variant="secondary">Voltar para Clientes</Button>
          </a>
        }
      />
    )
  }

  const balance = balances.get(id) ?? 0

  const onDelete = async () => {
    if (balance > 0) {
      toast({
        kind: 'error',
        title: 'Este cliente ainda deve',
        description: `${customer.name} deve ${formatBRL(balance)}. Receba o valor antes de excluir.`,
        durationMs: 6000,
      })
      return
    }
    const ok = await confirm({
      title: `Excluir ${customer.name}?`,
      message:
        'As vendas e prestações antigas continuam no histórico e nos relatórios, mas o cliente sai da lista e não poderá mais ser escolhido.',
      confirmLabel: 'Excluir cliente',
      cancelLabel: 'Manter',
      tone: 'danger',
    })
    if (!ok) return
    try {
      removeCustomer(id)
    } catch (e) {
      toast({ kind: 'error', title: 'Não foi possível excluir', description: e instanceof DomainError ? e.message : 'Tente novamente.' })
      return
    }
    navigate(paths.customers)
    toast({
      kind: 'info',
      title: 'Cliente excluído',
      description: customer.name,
      action: {
        label: 'Desfazer',
        onClick: () => {
          try {
            restoreCustomer(id)
            toast({ title: 'Cliente restaurado', description: customer.name })
          } catch (e) {
            toast({ kind: 'error', title: 'Não foi possível restaurar', description: e instanceof DomainError ? e.message : undefined })
          }
        },
      },
    })
  }

  return (
    <div>
      <a
        href={paths.customers}
        className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-[15px] font-semibold text-muted hover:bg-sand hover:text-ink"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
        Clientes
      </a>

      <div className="flex items-center gap-4">
        <CustomerAvatar name={customer.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight">{customer.name}</h1>
          {customer.phone && (
            <a href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`} className="num mt-0.5 inline-flex min-h-8 items-center gap-1.5 text-[15px] text-muted hover:text-brand-600">
              <Phone className="h-4 w-4" aria-hidden />
              {customer.phone}
            </a>
          )}
        </div>
        <div className="ml-auto flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Editar cliente"
            onClick={() => openSheet({ kind: 'customerEdit', id })}
            className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink"
          >
            <Pencil className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Excluir cliente"
            onClick={() => void onDelete()}
            className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-danger-50 hover:text-danger-600"
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <Card className="mt-6 p-5 md:p-6">
        <p className="text-sm font-semibold text-muted">{balance < 0 ? 'Crédito do cliente' : 'Saldo devedor atual'}</p>
        <p className={cn('num mt-1 text-5xl font-extrabold leading-none tracking-tight', balance > 0 ? 'text-clay-600' : balance < 0 ? 'text-sage-600' : 'text-ink')}>
          {formatBRL(Math.abs(balance))}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            size="lg"
            variant="primary"
            icon={<HandCoins className="h-5 w-5" aria-hidden />}
            disabled={balance <= 0}
            onClick={() => openSheet({ kind: 'payment', customerId: id })}
          >
            Receber
          </Button>
          <Button size="lg" variant="secondary" icon={<ShoppingBag className="h-5 w-5" aria-hidden />} onClick={() => openSheet({ kind: 'sale', customerId: id })}>
            Vender na ficha
          </Button>
        </div>
      </Card>

      <section className="mt-8" aria-labelledby="hist-cli">
        <SectionTitle>
          <span id="hist-cli">Histórico da ficha</span>
        </SectionTitle>
        {ledger.length === 0 ? (
          <Card>
            <EmptyState icon={ShoppingBag} title="Sem movimentações" description="As vendas na ficha e as prestações deste cliente aparecem aqui." />
          </Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {ledger.map(({ tx, deltaCents, balanceAfterCents }) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => openSheet({ kind: 'detail', id: tx.id })}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-sand/60 active:bg-sand"
              >
                <span className="num w-12 shrink-0 text-[15px] font-semibold text-muted">{formatDayShort(tx.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{tx.type === 'SALE' ? 'Venda' : 'Prestação'}</span>
                  <span className="num block text-sm text-muted">Saldo: {formatBRL(balanceAfterCents)}</span>
                </span>
                <span className={cn('num text-[17px] font-bold', deltaCents > 0 ? 'text-clay-600' : 'text-sage-600')}>
                  {deltaCents > 0 ? '+' : '−'}
                  {formatBRL(Math.abs(deltaCents))}
                </span>
              </button>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
