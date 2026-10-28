/** Tipos centrais do MyLoja. Todos os valores monetários são inteiros em CENTAVOS. */

/** SALE venda · PAYMENT prestação de ficha · PURCHASE compra de mercadoria · EXPENSE despesa da loja (aluguel, luz...) */
export type TransactionType = 'SALE' | 'PAYMENT' | 'PURCHASE' | 'EXPENSE'

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
  /** Observação da compra ou DESCRIÇÃO da despesa (obrigatória em EXPENSE). */
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
  /** Percentual de lucro estimado por mês ('2026-10' -> 3500 = 35,00%), em centésimos de ponto percentual. */
  profitMarginBp: Record<string, number>
  /** Nome da loja (aparece na tela de bloqueio e no menu). */
  storeName: string
  /** Logo da loja, já reduzida, como data URL (image/*). */
  logoDataUrl?: string
  /** Quando as configurações sincronizáveis (nome, logo, percentuais, dias conferidos) mudaram pela última vez. */
  updatedAt?: string
}

export interface PendingSync {
  customers: string[]
  transactions: string[]
  /** Configurações alteradas e ainda não enviadas. */
  settings?: boolean
}

/** Itens apagados de vez (lixeira) que ainda precisam ser removidos da nuvem. */
export interface PendingPurge {
  customers: string[]
  transactions: string[]
}

export interface AppData {
  version: 1
  customers: Customer[]
  transactions: Transaction[]
  settings: Settings
  pending: PendingSync
  purge?: PendingPurge
  lastPullAt: string | null
  /** Conta (id do usuário no Supabase) dona dos dados deste aparelho. Evita misturar contas. */
  ownerUserId?: string | null
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
