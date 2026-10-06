import { HandCoins, Package, Receipt, ShoppingBag, type LucideIcon } from 'lucide-react'
import type { Transaction, TransactionType } from '@/types'
import { METHOD_LABEL, TYPE_LABEL } from '@/domain/methods'
import { formatDayShort, formatTime } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { cn } from '@/lib/cn'

export const TYPE_ICON: Record<TransactionType, LucideIcon> = {
  SALE: ShoppingBag,
  PAYMENT: HandCoins,
  PURCHASE: Package,
  EXPENSE: Receipt,
}

const TYPE_TONE: Record<TransactionType, string> = {
  SALE: 'bg-sage-50 text-sage-600',
  PAYMENT: 'bg-brand-50 text-brand-600',
  PURCHASE: 'bg-danger-50 text-danger-600',
  EXPENSE: 'bg-clay-50 text-clay-600',
}

/** "Ficha · Maria", "Maria · PIX", "Atacado · Espécie"... */
export function transactionSubtitle(tx: Transaction, customerName?: string): string {
  if (tx.type === 'SALE') {
    return tx.paymentMethod === 'FICHA'
      ? `Ficha · ${customerName ?? 'cliente removido'}`
      : METHOD_LABEL[tx.paymentMethod]
  }
  if (tx.type === 'PAYMENT') {
    return `${customerName ?? 'Cliente removido'} · ${METHOD_LABEL[tx.paymentMethod]}`
  }
  if (tx.type === 'EXPENSE') {
    return `${tx.note ?? 'Sem descrição'} · ${METHOD_LABEL[tx.paymentMethod]}`
  }
  return tx.supplier ? `${tx.supplier} · ${METHOD_LABEL[tx.paymentMethod]}` : METHOD_LABEL[tx.paymentMethod]
}

/** Texto curto para toasts e confirmações: "R$ 35,00 · PIX" */
export function transactionSummaryLine(tx: Pick<Transaction, 'amountCents' | 'paymentMethod'>, customerName?: string): string {
  const base = `${formatBRL(tx.amountCents)} · ${METHOD_LABEL[tx.paymentMethod]}`
  return customerName ? `${base} · ${customerName}` : base
}

interface TransactionItemProps {
  tx: Transaction
  customerName?: string
  showDate?: boolean
  onClick?: () => void
}

export function TransactionItem({ tx, customerName, showDate, onClick }: TransactionItemProps) {
  const Icon = TYPE_ICON[tx.type]
  const isFicha = tx.type === 'SALE' && tx.paymentMethod === 'FICHA'
  const isOut = tx.type === 'PURCHASE' || tx.type === 'EXPENSE'
  const sign = isOut ? '−' : isFicha ? '' : '+'
  const when = showDate ? `${formatDayShort(tx.createdAt)} · ${formatTime(tx.createdAt)}` : formatTime(tx.createdAt)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-sand/60 active:bg-sand"
    >
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', isFicha ? 'bg-clay-50 text-clay-600' : TYPE_TONE[tx.type])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold leading-tight">{TYPE_LABEL[tx.type]}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{transactionSubtitle(tx, customerName)}</span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'num block text-[17px] font-bold leading-tight',
            isOut && 'text-danger-600',
            tx.type === 'PAYMENT' && 'text-sage-600',
            tx.type === 'SALE' && !isFicha && 'text-sage-600',
          )}
        >
          {sign}
          {formatBRL(tx.amountCents)}
        </span>
        <span className="num mt-0.5 block text-sm text-muted">
          {isFicha ? <span className="font-semibold text-clay-600">a receber · </span> : null}
          {when}
        </span>
      </span>
    </button>
  )
}
