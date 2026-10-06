/** Tipos centrais do MyLoja. Todos os valores monetários são inteiros em CENTAVOS. */

export type TransactionType = 'SALE' | 'PAYMENT' | 'PURCHASE'

export type PaymentMethod = 'PIX' | 'CASH' | 'DEBIT' | 'CREDIT' | 'FICHA'

/** Formas em que dinheiro realmente entra/sai (tudo menos ficha). */
export type CashMethod = Exclude<PaymentMethod, 'FICHA'>

export interface Customer {
  id: string
  name: string
  phone?: string
  createdAt: string
  updatedAt: string
  /** Exclusão lógica (permite desfazer e sincronizar). */
  deletedAt?: string | null
}

export interface Transaction {
  id: string
  type: TransactionType
  amountCents: number
  paymentMethod: PaymentMethod
  /** Obrigatório para PAYMENT e para SALE em FICHA. */
  customerId?: string | null
  supplier?: string
  note?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ClosingRecord {
  /** Marca "conferido" de um dia (YYYY-MM-DD) com o total na hora da conferência. */
  closedAt: string
  salesCents: number
  receivedCents: number
}

export interface Settings {
  ownerName: string
  lastMethod: PaymentMethod
  closings: Record<string, ClosingRecord>
}

export interface PendingSync {
  customers: string[]
  transactions: string[]
}

export interface AppData {
  version: 1
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  pending: PendingSync
  lastPullAt: string | null
}

export type TransactionInput = {
  type: TransactionType
  amountCents: number
  paymentMethod: PaymentMethod
  customerId?: string | null
  supplier?: string
  note?: string
  createdAt?: string
}
