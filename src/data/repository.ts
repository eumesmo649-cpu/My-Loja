import type { AppData, Customer, PaymentMethod, Settings, Transaction, TransactionInput } from '@/types'
import { newId } from '@/lib/id'
import { MAX_AMOUNT_CENTS, normalizeName } from '@/domain/validation'

/**
 * Operações PURAS sobre os dados (recebem o estado e devolvem o novo estado).
 * Não tocam em disco nem em rede: isso fica na store e na sincronização.
 * Toda alteração marca o registro como "pendente" para sincronizar depois.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainError'
  }
}

const addUnique = (list: string[], id: string) => (list.includes(id) ? list : [...list, id])

function assertTransactionRules(t: {
  type: Transaction['type']
  amountCents: number
  paymentMethod: PaymentMethod
  customerId?: string | null
}) {
  if (!Number.isInteger(t.amountCents) || t.amountCents <= 0) {
    throw new DomainError('O valor precisa ser maior que zero.')
  }
  if (t.amountCents > MAX_AMOUNT_CENTS) throw new DomainError('Valor grande demais.')
  if (t.type === 'SALE' && t.paymentMethod === 'FICHA' && !t.customerId) {
    throw new DomainError('Venda na ficha precisa de um cliente.')
  }
  if (t.type === 'PAYMENT' && !t.customerId) {
    throw new DomainError('Prestação precisa de um cliente.')
  }
  if (t.type !== 'SALE' && t.paymentMethod === 'FICHA') {
    throw new DomainError('Esta forma de pagamento só vale para vendas.')
  }
}

export function addCustomer(
  data: AppData,
  input: { name: string; phone?: string },
  now = new Date(),
): { data: AppData; customer: Customer } {
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new DomainError('Digite o nome do cliente.')
  const dup = data.customers.find((c) => !c.deletedAt && normalizeName(c.name) === normalizeName(name))
  if (dup) throw new DomainError(`Já existe um cliente chamado "${dup.name}".`)
  const iso = now.toISOString()
  const customer: Customer = {
    id: newId(),
    name,
    phone: input.phone?.trim() || undefined,
    createdAt: iso,
    updatedAt: iso,
    deletedAt: null,
  }
  return {
    customer,
    data: {
      ...data,
      customers: [...data.customers, customer],
      pending: { ...data.pending, customers: addUnique(data.pending.customers, customer.id) },
    },
  }
}

export function addTransaction(
  data: AppData,
  input: TransactionInput,
  now = new Date(),
): { data: AppData; transaction: Transaction } {
  assertTransactionRules(input)
  if (input.customerId && !data.customers.some((c) => c.id === input.customerId && !c.deletedAt)) {
    throw new DomainError('Cliente não encontrado.')
  }
  const iso = now.toISOString()
  const transaction: Transaction = {
    id: newId(),
    type: input.type,
    amountCents: input.amountCents,
    paymentMethod: input.paymentMethod,
    customerId:
      input.type === 'PURCHASE' || (input.type === 'SALE' && input.paymentMethod !== 'FICHA')
        ? null
        : input.customerId ?? null,
    supplier: input.type === 'PURCHASE' ? input.supplier?.trim() || undefined : undefined,
    note: input.type === 'PURCHASE' ? input.note?.trim() || undefined : undefined,
    createdAt: input.createdAt ?? iso,
    updatedAt: iso,
    deletedAt: null,
  }
  const settings: Settings = {
    ...data.settings,
    lastMethod: transaction.paymentMethod,
  }
  return {
    transaction,
    data: {
      ...data,
      settings,
      transactions: [...data.transactions, transaction],
      pending: { ...data.pending, transactions: addUnique(data.pending.transactions, transaction.id) },
    },
  }
}

export type TransactionPatch = Partial<
  Pick<Transaction, 'amountCents' | 'paymentMethod' | 'customerId' | 'supplier' | 'note' | 'createdAt'>
>

export function updateTransaction(
  data: AppData,
  id: string,
  patch: TransactionPatch,
  now = new Date(),
): { data: AppData; transaction: Transaction } {
  const current = data.transactions.find((t) => t.id === id && !t.deletedAt)
  if (!current) throw new DomainError('Movimentação não encontrada.')
  const merged: Transaction = { ...current, ...patch }
  // Venda que deixou de ser ficha não guarda cliente.
  if (merged.type === 'SALE' && merged.paymentMethod !== 'FICHA') merged.customerId = null
  if (merged.type === 'PURCHASE') merged.customerId = null
  if (merged.type !== 'PURCHASE') {
    merged.supplier = undefined
    merged.note = undefined
  } else {
    merged.supplier = merged.supplier?.trim() || undefined
    merged.note = merged.note?.trim() || undefined
  }
  assertTransactionRules(merged)
  merged.updatedAt = now.toISOString()
  return {
    transaction: merged,
    data: {
      ...data,
      transactions: data.transactions.map((t) => (t.id === id ? merged : t)),
      pending: { ...data.pending, transactions: addUnique(data.pending.transactions, id) },
    },
  }
}

export function deleteTransaction(data: AppData, id: string, now = new Date()): AppData {
  const current = data.transactions.find((t) => t.id === id && !t.deletedAt)
  if (!current) throw new DomainError('Movimentação não encontrada.')
  const iso = now.toISOString()
  return {
    ...data,
    transactions: data.transactions.map((t) => (t.id === id ? { ...t, deletedAt: iso, updatedAt: iso } : t)),
    pending: { ...data.pending, transactions: addUnique(data.pending.transactions, id) },
  }
}

export function restoreTransaction(data: AppData, id: string, now = new Date()): AppData {
  const current = data.transactions.find((t) => t.id === id && t.deletedAt)
  if (!current) return data
  return {
    ...data,
    transactions: data.transactions.map((t) =>
      t.id === id ? { ...t, deletedAt: null, updatedAt: now.toISOString() } : t,
    ),
    pending: { ...data.pending, transactions: addUnique(data.pending.transactions, id) },
  }
}

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } }
}
