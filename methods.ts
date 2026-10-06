import type { CashMethod, PaymentMethod, TransactionType } from '@/types'

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX: 'PIX',
  CASH: 'Espécie',
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
  FICHA: 'Ficha',
}

export const TYPE_LABEL: Record<TransactionType, string> = {
  SALE: 'Venda',
  PAYMENT: 'Prestação',
  PURCHASE: 'Compra',
  EXPENSE: 'Despesa',
}

/** Formas disponíveis ao registrar uma venda. */
export const SALE_METHODS: PaymentMethod[] = ['PIX', 'CASH', 'DEBIT', 'CREDIT', 'FICHA']

/** Formas em que o dinheiro realmente entra/sai (prestações e compras). */
export const CASH_METHODS: CashMethod[] = ['PIX', 'CASH', 'DEBIT', 'CREDIT']

export function emptyByMethod(): Record<PaymentMethod, number> {
  return { PIX: 0, CASH: 0, DEBIT: 0, CREDIT: 0, FICHA: 0 }
}

export function emptyCashByMethod(): Record<CashMethod, number> {
  return { PIX: 0, CASH: 0, DEBIT: 0, CREDIT: 0 }
}
