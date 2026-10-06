import { Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '@/types'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { newlyNegativeCustomers } from '@/domain/balances'
import { METHOD_LABEL, TYPE_LABEL } from '@/domain/methods'
import { formatDayFull, formatTime } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { navigate, paths } from '@/hooks/useRoute'
import { cn } from '@/lib/cn'
import { Button } from './ui/Button'
import { TYPE_ICON } from './TransactionItem'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line py-3.5 first:border-t-0">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[15px] font-semibold">{children}</dd>
    </div>
  )
}

export function TransactionDetail({ tx }: { tx: Transaction }) {
  const { customers, transactions, balances, removeTransaction, restoreTransaction } = useStore()
  const { openSheet, closeSheet, confirm, toast } = useUI()

  const customer = tx.customerId ? customers.find((c) => c.id === tx.customerId) : undefined
  const Icon = TYPE_ICON[tx.type]
  const isFicha = tx.type === 'SALE' && tx.paymentMethod === 'FICHA'
  const balance = customer ? balances.get(customer.id) ?? 0 : 0

  const onDelete = async () => {
    // descreve o efeito da exclusão em linguagem simples
    let effect = 'Os totais do dia, o histórico e os relatórios serão atualizados.'
    if (customer && isFicha) effect = `O saldo de ${customer.name} vai diminuir ${formatBRL(tx.amountCents)}.`
    if (customer && tx.type === 'PAYMENT') effect = `O saldo de ${customer.name} vai aumentar ${formatBRL(tx.amountCents)}.`

    const after = transactions.filter((t) => t.id !== tx.id)
    const negative = newlyNegativeCustomers(transactions, after)
    const extra =
      negative.length > 0
        ? ` Atenção: ${customer?.name ?? 'o cliente'} ficará com saldo de crédito, pois já há prestações recebidas.`
        : ''

    const ok = await confirm({
      title: `Excluir esta ${tx.type === 'PURCHASE' ? 'compra' : tx.type === 'PAYMENT' ? 'prestação' : 'venda'}?`,
      message: `${formatBRL(tx.amountCents)} · ${METHOD_LABEL[tx.paymentMethod]}. ${effect}${extra}`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Manter',
      tone: 'danger',
    })
    if (!ok) return
    removeTransaction(tx.id)
    closeSheet()
    toast({
      kind: 'info',
      title: 'Movimentação excluída',
      description: `${TYPE_LABEL[tx.type]} de ${formatBRL(tx.amountCents)}`,
      action: {
        label: 'Desfazer',
        onClick: () => {
          restoreTransaction(tx.id)
          toast({ title: 'Movimentação restaurada' })
        },
      },
    })
  }

  return (
    <div>
      <div className="flex flex-col items-center py-3 text-center">
        <span
          className={cn(
            'grid h-14 w-14 place-items-center rounded-2xl',
            isFicha
              ? 'bg-clay-50 text-clay-600'
              : tx.type === 'PURCHASE'
                ? 'bg-danger-50 text-danger-600'
                : tx.type === 'PAYMENT'
                  ? 'bg-brand-50 text-brand-600'
                  : 'bg-sage-50 text-sage-600',
          )}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold text-muted">{TYPE_LABEL[tx.type]}</p>
        <p className={cn('num text-4xl font-bold leading-tight', tx.type === 'PURCHASE' && 'text-danger-600')}>
          {tx.type === 'PURCHASE' ? '−' : ''}
          {formatBRL(tx.amountCents)}
        </p>
        {isFicha && (
          <span className="mt-2 rounded-full bg-clay-50 px-3 py-1 text-sm font-semibold text-clay-700">A receber · não entrou no caixa</span>
        )}
      </div>

      <dl className="rounded-2xl border border-line bg-card px-4">
        <Row label="Data">{formatDayFull(tx.createdAt)}</Row>
        <Row label="Hora">{formatTime(tx.createdAt)}</Row>
        <Row label={tx.type === 'PAYMENT' ? 'Pago em' : 'Forma de pagamento'}>{METHOD_LABEL[tx.paymentMethod]}</Row>
        {customer && (
          <Row label="Cliente">
            <button
              type="button"
              className="font-semibold text-brand-600 underline-offset-2 hover:underline"
              onClick={() => {
                closeSheet()
                navigate(paths.customer(customer.id))
              }}
            >
              {customer.name}
            </button>
          </Row>
        )}
        {customer && (
          <Row label="Saldo atual do cliente">
            <span className="num">{formatBRL(Math.max(0, balance))}</span>
          </Row>
        )}
        {tx.supplier && <Row label="Fornecedor">{tx.supplier}</Row>}
        {tx.note && <Row label="Observação">{tx.note}</Row>}
      </dl>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" icon={<Pencil className="h-5 w-5" aria-hidden />} onClick={() => openSheet({ kind: 'edit', id: tx.id })}>
          Editar
        </Button>
        <Button variant="soft" size="lg" className="!bg-danger-50 !text-danger-700 hover:!bg-danger-100" icon={<Trash2 className="h-5 w-5" aria-hidden />} onClick={() => void onDelete()}>
          Excluir
        </Button>
      </div>
    </div>
  )
}
