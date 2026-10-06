import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { DomainError } from '@/data/repository'
import { normalizeName } from '@/domain/validation'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'
import { CustomerAvatar } from './CustomerAvatar'

interface CustomerPickerProps {
  label?: string
  value: string | null
  onChange: (id: string | null) => void
  /** Permite criar um cliente novo digitando o nome (venda em ficha). */
  allowCreate?: boolean
  /** Mostra primeiro quem está devendo (prestações). */
  onlyOwing?: boolean
  error?: string
  autoFocus?: boolean
}

export function CustomerPicker({
  label = 'Cliente',
  value,
  onChange,
  allowCreate = false,
  onlyOwing = false,
  error,
  autoFocus,
}: CustomerPickerProps) {
  const { customers, balances, transactions, createCustomer } = useStore()
  const [query, setQuery] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const selected = value ? customers.find((c) => c.id === value) : undefined

  // clientes mais recentes (última movimentação) para atalhos de 1 toque
  const recents = useMemo(() => {
    const lastSeen = new Map<string, string>()
    for (const t of transactions) {
      if (t.customerId && !lastSeen.has(t.customerId)) lastSeen.set(t.customerId, t.createdAt)
    }
    return customers
      .filter((c) => (onlyOwing ? (balances.get(c.id) ?? 0) > 0 : true))
      .sort((a, b) => {
        if (onlyOwing) return (balances.get(b.id) ?? 0) - (balances.get(a.id) ?? 0)
        return (lastSeen.get(b.id) ?? '').localeCompare(lastSeen.get(a.id) ?? '')
      })
  }, [customers, transactions, balances, onlyOwing])

  const q = normalizeName(query)
  const matches = q ? recents.filter((c) => normalizeName(c.name).includes(q)) : []
  const exact = q ? customers.find((c) => normalizeName(c.name) === q) : undefined
  const canCreate = allowCreate && query.trim().length >= 2 && !exact

  const pick = (id: string) => {
    setQuery('')
    setCreateError(null)
    onChange(id)
  }

  const create = () => {
    try {
      const c = createCustomer({ name: query })
      pick(c.id)
    } catch (e) {
      setCreateError(e instanceof DomainError ? e.message : 'Não foi possível criar o cliente.')
    }
  }

  const onEnter = () => {
    if (matches.length === 1) pick(matches[0].id)
    else if (exact) pick(exact.id)
    else if (canCreate && matches.length === 0) create()
  }

  const labelEl = <p className="text-sm font-semibold text-muted">{label}</p>

  if (selected) {
    const balance = balances.get(selected.id) ?? 0
    return (
      <div>
        {labelEl}
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <CustomerAvatar name={selected.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{selected.name}</p>
            <p className="num text-sm text-muted">
              {balance > 0 ? `Deve ${formatBRL(balance)}` : balance < 0 ? `Crédito de ${formatBRL(-balance)}` : 'Sem saldo devedor'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-10 rounded-xl px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
          >
            Trocar
          </button>
        </div>
      </div>
    )
  }

  const listToShow = q ? matches : recents.slice(0, onlyOwing ? 8 : 5)

  return (
    <div>
      <label htmlFor="customer-search" className="text-sm font-semibold text-muted">
        {label}
      </label>
      <div
        className={cn(
          'mt-2 flex min-h-[52px] items-center gap-2 rounded-2xl border bg-card px-4 focus-within:ring-4',
          error ? 'border-danger-600 focus-within:ring-danger-100' : 'border-line focus-within:border-brand-500 focus-within:ring-brand-100',
        )}
      >
        <Search className="h-5 w-5 shrink-0 text-faint" aria-hidden />
        <input
          id="customer-search"
          data-autofocus={autoFocus ? '' : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCreateError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onEnter()
            }
          }}
          placeholder={allowCreate ? 'Buscar ou criar cliente' : 'Buscar cliente'}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-faint"
        />
      </div>

      {(error || createError) && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger-600">
          {createError ?? error}
        </p>
      )}

      {onlyOwing && recents.length === 0 && (
        <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-[15px] text-muted">
          Nenhum cliente com saldo a receber no momento.
        </p>
      )}

      {listToShow.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-card" aria-label="Clientes">
          {listToShow.map((c, i) => {
            const balance = balances.get(c.id) ?? 0
            return (
              <li key={c.id} className={cn(i > 0 && 'border-t border-line')}>
                <button
                  type="button"
                  onClick={() => pick(c.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-sand/60 active:bg-sand"
                >
                  <CustomerAvatar name={c.name} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  {balance > 0 && <span className="num shrink-0 text-sm font-semibold text-clay-600">{formatBRL(balance)}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {q && matches.length === 0 && !canCreate && (
        <p className="mt-3 px-1 text-sm text-muted">Nenhum cliente encontrado.</p>
      )}

      {canCreate && (
        <button
          type="button"
          onClick={create}
          className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/60 px-3 text-left font-semibold text-brand-700 hover:bg-brand-50"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-100">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 truncate">Criar cliente “{query.trim()}”</span>
        </button>
      )}
    </div>
  )
}
