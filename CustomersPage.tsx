import { useMemo, useState } from 'react'
import { ChevronRight, Search, UserPlus, Users } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { normalizeName } from '@/domain/validation'
import { formatBRL } from '@/lib/money'
import { paths } from '@/hooks/useRoute'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { CustomerAvatar } from '@/components/CustomerAvatar'

export function CustomersPage() {
  const { customers, balances, receivableCents } = useStore()
  const { openSheet } = useUI()
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = normalizeName(query)
    return customers
      .filter((c) => !q || normalizeName(c.name).includes(q))
      .sort((a, b) => (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'pt-BR'))
  }, [customers, balances, query])

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={receivableCents > 0 ? `${formatBRL(receivableCents)} a receber nas fichas` : 'Fichas e saldos devedores'}
        action={
          <Button size="sm" icon={<UserPlus className="h-4 w-4" aria-hidden />} onClick={() => openSheet({ kind: 'customer' })}>
            Novo
          </Button>
        }
      />

      {customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description="Cadastre um cliente só com o nome. Ele também pode ser criado na hora de vender na ficha."
            action={<Button onClick={() => openSheet({ kind: 'customer' })}>Cadastrar cliente</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex min-h-[52px] items-center gap-2 rounded-2xl border border-line bg-card px-4 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
            <Search className="h-5 w-5 text-faint" aria-hidden />
            <label htmlFor="c-search" className="sr-only">
              Buscar cliente
            </label>
            <input
              id="c-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-faint"
            />
          </div>

          {list.length === 0 ? (
            <p className="px-1 text-[15px] text-muted">Nenhum cliente encontrado.</p>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {list.map((c) => {
                const balance = balances.get(c.id) ?? 0
                return (
                  <a
                    key={c.id}
                    href={paths.customer(c.id)}
                    className="flex min-h-[68px] items-center gap-3.5 px-4 py-3 transition-colors hover:bg-sand/60 active:bg-sand"
                  >
                    <CustomerAvatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold leading-tight">{c.name}</span>
                      <span className="block text-sm text-muted">
                        {balance > 0 ? 'Saldo devedor' : balance < 0 ? 'Crédito' : 'Em dia'}
                      </span>
                    </span>
                    <span className={cn('num text-[17px] font-bold', balance > 0 ? 'text-clay-600' : balance < 0 ? 'text-sage-600' : 'text-faint')}>
                      {formatBRL(Math.abs(balance))}
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-faint" aria-hidden />
                  </a>
                )
              })}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
