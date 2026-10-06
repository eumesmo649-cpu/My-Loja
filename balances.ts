import type { Transaction } from '@/types'

/**
 * Saldo de cliente (ficha) é SEMPRE derivado das transações:
 *   saldo = soma das vendas em FICHA  -  soma das prestações recebidas
 * Assim editar/excluir qualquer lançamento recalcula tudo sem risco de divergência.
 */

export const isActive = <T extends { deletedAt?: string | null }>(x: T): boolean => !x.deletedAt

export function customerBalance(customerId: string, txs: Transaction[]): number {
  let balance = 0
  for (const t of txs) {
    if (t.deletedAt || t.customerId !== customerId) continue
    if (t.type === 'SALE' && t.paymentMethod === 'FICHA') balance += t.amountCents
    else if (t.type === 'PAYMENT') balance -= t.amountCents
  }
  return balance
}

/** customerId -> saldo (inclui saldos negativos, que representam pagamento a maior). */
export function balancesByCustomer(txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.deletedAt || !t.customerId) continue
    if (t.type === 'SALE' && t.paymentMethod === 'FICHA') {
      map.set(t.customerId, (map.get(t.customerId) ?? 0) + t.amountCents)
    } else if (t.type === 'PAYMENT') {
      map.set(t.customerId, (map.get(t.customerId) ?? 0) - t.amountCents)
    }
  }
  return map
}

/** Total de contas a receber: soma dos saldos devedores positivos. */
export function totalReceivable(txs: Transaction[]): number {
  let total = 0
  for (const balance of balancesByCustomer(txs).values()) {
    if (balance > 0) total += balance
  }
  return total
}

/**
 * Clientes cujo saldo ficaria NEGATIVO depois de uma alteração (e que não estavam assim antes).
 * Usado para pedir confirmação ao editar/excluir lançamentos.
 */
export function newlyNegativeCustomers(before: Transaction[], after: Transaction[]): string[] {
  const b = balancesByCustomer(before)
  const a = balancesByCustomer(after)
  const result: string[] = []
  for (const [id, balance] of a) {
    if (balance < 0 && (b.get(id) ?? 0) >= 0) result.push(id)
  }
  return result
}

/** Linhas do extrato de um cliente, em ordem cronológica, com saldo corrente. */
export interface LedgerRow {
  tx: Transaction
  /** + para venda em ficha, - para prestação */
  deltaCents: number
  balanceAfterCents: number
}

export function customerLedger(customerId: string, txs: Transaction[]): LedgerRow[] {
  const mine = txs
    .filter(
      (t) =>
        !t.deletedAt &&
        t.customerId === customerId &&
        ((t.type === 'SALE' && t.paymentMethod === 'FICHA') || t.type === 'PAYMENT'),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  let running = 0
  return mine.map((tx) => {
    const delta = tx.type === 'SALE' ? tx.amountCents : -tx.amountCents
    running += delta
    return { tx, deltaCents: delta, balanceAfterCents: running }
  })
}
