import { HandCoins, Package, ShoppingBag, type LucideIcon } from 'lucide-react'
import { useStore } from '@/store/StoreContext'
import { useUI } from '@/store/UIContext'
import { Sheet } from './ui/Sheet'
import { SaleForm } from './forms/SaleForm'
import { PaymentForm } from './forms/PaymentForm'
import { PurchaseForm } from './forms/PurchaseForm'
import { CustomerForm } from './forms/CustomerForm'
import { TransactionDetail } from './TransactionDetail'
import { cn } from '@/lib/cn'

function MenuOption({
  icon: Icon,
  title,
  description,
  tone,
  onClick,
  autoFocus,
}: {
  icon: LucideIcon
  title: string
  description: string
  tone: string
  onClick: () => void
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={autoFocus ? '' : undefined}
      className="flex min-h-[76px] w-full items-center gap-4 rounded-2xl border border-line bg-card p-3.5 text-left transition-colors hover:bg-sand/60 active:bg-sand"
    >
      <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', tone)}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">{description}</span>
      </span>
    </button>
  )
}

function AddMenu() {
  const { openSheet } = useUI()
  const { balances } = useStore()
  const owing = [...balances.values()].filter((b) => b > 0).length
  return (
    <div className="flex flex-col gap-3">
      <MenuOption
        icon={ShoppingBag}
        title="Venda"
        description="PIX, espécie, cartão ou ficha"
        tone="bg-sage-50 text-sage-600"
        onClick={() => openSheet({ kind: 'sale' })}
        autoFocus
      />
      <MenuOption
        icon={HandCoins}
        title="Prestação"
        description={
          owing > 0
            ? `Cliente pagando a ficha · ${owing} ${owing === 1 ? 'cliente devendo' : 'clientes devendo'}`
            : 'Cliente pagando a ficha'
        }
        tone="bg-brand-50 text-brand-600"
        onClick={() => openSheet({ kind: 'payment' })}
      />
      <MenuOption
        icon={Package}
        title="Compra"
        description="Saída de dinheiro: mercadoria e despesas"
        tone="bg-danger-50 text-danger-600"
        onClick={() => openSheet({ kind: 'purchase' })}
      />
    </div>
  )
}

/** Renderiza a janela (bottom sheet no celular / modal no desktop) conforme o estado global. */
export function SheetHost() {
  const { sheet, closeSheet } = useUI()
  const { transactions } = useStore()

  if (!sheet) return null

  switch (sheet.kind) {
    case 'menu':
      return (
        <Sheet key="menu" title="O que você quer registrar?" onClose={closeSheet}>
          <AddMenu />
        </Sheet>
      )
    case 'sale':
      return (
        <Sheet key="sale" title="Nova venda" onClose={closeSheet}>
          <SaleForm presetCustomerId={sheet.customerId} />
        </Sheet>
      )
    case 'payment':
      return (
        <Sheet key="payment" title="Receber prestação" onClose={closeSheet}>
          <PaymentForm presetCustomerId={sheet.customerId} />
        </Sheet>
      )
    case 'purchase':
      return (
        <Sheet key="purchase" title="Nova compra" onClose={closeSheet}>
          <PurchaseForm />
        </Sheet>
      )
    case 'customer':
      return (
        <Sheet key="customer" title="Novo cliente" onClose={closeSheet}>
          <CustomerForm />
        </Sheet>
      )
    case 'detail':
    case 'edit': {
      const tx = transactions.find((t) => t.id === sheet.id)
      if (!tx) {
        // movimentação não existe mais (ex.: foi excluída)
        queueMicrotask(closeSheet)
        return null
      }
      if (sheet.kind === 'detail') {
        return (
          <Sheet key={`detail-${tx.id}`} title="Detalhes da movimentação" onClose={closeSheet}>
            <TransactionDetail tx={tx} />
          </Sheet>
        )
      }
      const titles = { SALE: 'Editar venda', PAYMENT: 'Editar prestação', PURCHASE: 'Editar compra' } as const
      return (
        <Sheet key={`edit-${tx.id}`} title={titles[tx.type]} onClose={closeSheet}>
          {tx.type === 'SALE' && <SaleForm editing={tx} />}
          {tx.type === 'PAYMENT' && <PaymentForm editing={tx} />}
          {tx.type === 'PURCHASE' && <PurchaseForm editing={tx} />}
        </Sheet>
      )
    }
  }
}
