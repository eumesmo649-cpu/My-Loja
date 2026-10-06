import type { CashMethod, PaymentMethod, Transaction } from '@/types'
import { emptyByMethod, emptyCashByMethod } from './methods'

/**
 * Regra fundamental: FATURAMENTO ≠ DINHEIRO RECEBIDO.
 *  - Venda à vista  -> entra em vendas E em recebido.
 *  - Venda em ficha -> entra em vendas e em "a receber"; recebido +0.
 *  - Prestação      -> entra em recebido (e reduz "a receber"), não é nova venda.
 *  - Compra         -> saída de dinheiro.
 */
export interface Summary {
  salesCents: number
  salesCount: number
  salesByMethod: Record<PaymentMethod, number>
  /** vendas em ficha no período (ainda não é dinheiro) */
  fichaSalesCents: number
  /** vendas pagas na hora (PIX, espécie, débito, crédito) */
  cashSalesCents: number

  paymentsCents: number
  paymentsCount: number
  paymentsByMethod: Record<CashMethod, number>

  purchasesCents: number
  purchasesCount: number
  purchasesByMethod: Record<CashMethod, number>

  /** Dinheiro que entrou: vendas à vista + prestações recebidas */
  receivedCents: number
  receivedByMethod: Record<CashMethod, number>
  /** Recebido menos compras pagas */
  netCents: number
}

export function summarize(txs: Transaction[]): Summary {
  const s: Summary = {
    salesCents: 0,
    salesCount: 0,
    salesByMethod: emptyByMethod(),
    fichaSalesCents: 0,
    cashSalesCents: 0,
    paymentsCents: 0,
    paymentsCount: 0,
    paymentsByMethod: emptyCashByMethod(),
    purchasesCents: 0,
    purchasesCount: 0,
    purchasesByMethod: emptyCashByMethod(),
    receivedCents: 0,
    receivedByMethod: emptyCashByMethod(),
    netCents: 0,
  }

  for (const t of txs) {
    if (t.deletedAt) continue
    if (t.type === 'SALE') {
      s.salesCents += t.amountCents
      s.salesCount += 1
      s.salesByMethod[t.paymentMethod] += t.amountCents
      if (t.paymentMethod === 'FICHA') {
        s.fichaSalesCents += t.amountCents
      } else {
        s.cashSalesCents += t.amountCents
        s.receivedByMethod[t.paymentMethod] += t.amountCents
      }
    } else if (t.type === 'PAYMENT') {
      const m = t.paymentMethod as CashMethod
      s.paymentsCents += t.amountCents
      s.paymentsCount += 1
      if (m in s.paymentsByMethod) {
        s.paymentsByMethod[m] += t.amountCents
        s.receivedByMethod[m] += t.amountCents
      }
    } else if (t.type === 'PURCHASE') {
      const m = t.paymentMethod as CashMethod
      s.purchasesCents += t.amountCents
      s.purchasesCount += 1
      if (m in s.purchasesByMethod) s.purchasesByMethod[m] += t.amountCents
    }
  }

  s.receivedCents = s.cashSalesCents + s.paymentsCents
  s.netCents = s.receivedCents - s.purchasesCents
  return s
}

/** Lançamentos com createdAt em [fromMs, toMs). */
export function filterByRange(txs: Transaction[], fromMs: number, toMs: number): Transaction[] {
  return txs.filter((t) => {
    if (t.deletedAt) return false
    const ms = new Date(t.createdAt).getTime()
    return ms >= fromMs && ms < toMs
  })
}

/** Lançamentos de um dia local (YYYY-MM-DD). */
export function filterByDay(txs: Transaction[], key: string): Transaction[] {
  const [y, m, d] = key.split('-').map(Number)
  const from = new Date(y, m - 1, d).getTime()
  const to = new Date(y, m - 1, d + 1).getTime()
  return filterByRange(txs, from, to)
}

export function sortNewestFirst(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
