import type { AppData, Customer, PaymentMethod, Settings, Transaction, TransactionInput } from '@/types'
import { newId } from '@/lib/id'
import { customerBalance } from '@/domain/balances'
import { MAX_AMOUNT_CENTS, normalizeName } from '@/domain/validation'
import { formatBRL } from '@/lib/money'

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
  note?: string
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
  if (t.type === 'EXPENSE' && !t.note?.trim()) {
    throw new DomainError('Descreva a despesa.')
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

export function updateCustomer(
  data: AppData,
  id: string,
  input: { name: string; phone?: string },
  now = new Date(),
): { data: AppData; customer: Customer } {
  const current = data.customers.find((c) => c.id === id && !c.deletedAt)
  if (!current) throw new DomainError('Cliente não encontrado.')
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2) throw new DomainError('Digite o nome do cliente.')
  const dup = data.customers.find(
    (c) => c.id !== id && !c.deletedAt && normalizeName(c.name) === normalizeName(name),
  )
  if (dup) throw new DomainError(`Já existe um cliente chamado "${dup.name}".`)
  const customer: Customer = {
    ...current,
    name,
    phone: input.phone?.trim() || undefined,
    updatedAt: now.toISOString(),
  }
  return {
    customer,
    data: {
      ...data,
      customers: data.customers.map((c) => (c.id === id ? customer : c)),
      pending: { ...data.pending, customers: addUnique(data.pending.customers, id) },
    },
  }
}

/**
 * Exclui o cliente (exclusão lógica). Só é permitido sem saldo devedor, para a conta
 * "a receber" nunca perder dinheiro de ficha sem querer. As vendas e prestações antigas
 * continuam no histórico e nos relatórios (aparecem como "cliente removido").
 */
export function deleteCustomer(data: AppData, id: string, now = new Date()): AppData {
  const current = data.customers.find((c) => c.id === id && !c.deletedAt)
  if (!current) throw new DomainError('Cliente não encontrado.')
  const balance = customerBalance(id, data.transactions)
  if (balance > 0) {
    throw new DomainError(
      `${current.name} ainda deve ${formatBRL(balance)}. Receba o valor antes de excluir o cliente.`,
    )
  }
  const iso = now.toISOString()
  return {
    ...data,
    customers: data.customers.map((c) => (c.id === id ? { ...c, deletedAt: iso, updatedAt: iso } : c)),
    pending: { ...data.pending, customers: addUnique(data.pending.customers, id) },
  }
}

export function restoreCustomer(data: AppData, id: string, now = new Date()): AppData {
  const current = data.customers.find((c) => c.id === id && c.deletedAt)
  if (!current) return data
  // se outro cliente já ocupou o nome nesse meio tempo, não restaura em duplicidade
  const dup = data.customers.find((c) => !c.deletedAt && normalizeName(c.name) === normalizeName(current.name))
  if (dup) throw new DomainError(`Já existe um cliente chamado "${dup.name}".`)
  return {
    ...data,
    customers: data.customers.map((c) => (c.id === id ? { ...c, deletedAt: null, updatedAt: now.toISOString() } : c)),
    pending: { ...data.pending, customers: addUnique(data.pending.customers, id) },
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
      input.type === 'PURCHASE' ||
      input.type === 'EXPENSE' ||
      (input.type === 'SALE' && input.paymentMethod !== 'FICHA')
        ? null
        : input.customerId ?? null,
    supplier: input.type === 'PURCHASE' ? input.supplier?.trim() || undefined : undefined,
    note: input.type === 'PURCHASE' || input.type === 'EXPENSE' ? input.note?.trim() || undefined : undefined,
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
  if (merged.type === 'PURCHASE' || merged.type === 'EXPENSE') merged.customerId = null
  merged.supplier = merged.type === 'PURCHASE' ? merged.supplier?.trim() || undefined : undefined
  merged.note =
    merged.type === 'PURCHASE' || merged.type === 'EXPENSE' ? merged.note?.trim() || undefined : undefined
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

// ---------------------------------------------------------------------------
// Configurações sincronizáveis (nome, logo, percentuais, dias conferidos)
// ---------------------------------------------------------------------------

export type SyncedSettingsPatch = Partial<
  Pick<Settings, 'ownerName' | 'storeName' | 'logoDataUrl' | 'profitMarginBp' | 'closings'>
>

/** Altera configurações que vão para a nuvem: carimba a data e marca como pendente de envio. */
export function updateSyncedSettings(data: AppData, patch: SyncedSettingsPatch, now = new Date()): AppData {
  return {
    ...data,
    settings: { ...data.settings, ...patch, updatedAt: now.toISOString() },
    pending: { ...data.pending, settings: true },
  }
}

// ---------------------------------------------------------------------------
// Lixeira: itens excluídos ficam guardados por alguns dias e podem ser restaurados
// ---------------------------------------------------------------------------

export const TRASH_DAYS = 30

const emptyPurge = (data: AppData) => data.purge ?? { customers: [], transactions: [] }

/** Cliente tem algum lançamento (mesmo na lixeira)? Então não dá para apagá-lo de vez sem quebrar o histórico. */
export function customerHasTransactions(data: AppData, customerId: string): boolean {
  return data.transactions.some((t) => t.customerId === customerId)
}

function dropIds(list: string[], ids: Set<string>) {
  return list.filter((id) => !ids.has(id))
}

/** Apaga DE VEZ lançamentos que já estão na lixeira. Ignora o que não estiver excluído. */
export function purgeTransactions(data: AppData, ids: string[]): AppData {
  const set = new Set(data.transactions.filter((t) => t.deletedAt && ids.includes(t.id)).map((t) => t.id))
  if (set.size === 0) return data
  const purge = emptyPurge(data)
  return {
    ...data,
    transactions: data.transactions.filter((t) => !set.has(t.id)),
    pending: { ...data.pending, transactions: dropIds(data.pending.transactions, set) },
    purge: { ...purge, transactions: [...new Set([...purge.transactions, ...set])] },
  }
}

/** Apaga DE VEZ clientes da lixeira que não têm nenhum lançamento. Os demais continuam na lixeira. */
export function purgeCustomers(data: AppData, ids: string[]): AppData {
  const set = new Set(
    data.customers
      .filter((c) => c.deletedAt && ids.includes(c.id) && !customerHasTransactions(data, c.id))
      .map((c) => c.id),
  )
  if (set.size === 0) return data
  const purge = emptyPurge(data)
  return {
    ...data,
    customers: data.customers.filter((c) => !set.has(c.id)),
    pending: { ...data.pending, customers: dropIds(data.pending.customers, set) },
    purge: { ...purge, customers: [...new Set([...purge.customers, ...set])] },
  }
}

/** O que está na lixeira, do mais recentemente excluído para o mais antigo. */
export function trashContents(data: AppData): { transactions: Transaction[]; customers: Customer[] } {
  const byDeleted = (a: { deletedAt?: string | null }, b: { deletedAt?: string | null }) =>
    (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')
  return {
    transactions: data.transactions.filter((t) => t.deletedAt).sort(byDeleted),
    customers: data.customers.filter((c) => c.deletedAt).sort(byDeleted),
  }
}

/** Esvazia da lixeira o que está lá há mais de `days` dias. Devolve o MESMO objeto se não houver nada a fazer. */
export function purgeExpired(data: AppData, now = new Date(), days = TRASH_DAYS): AppData {
  const cutoff = now.getTime() - days * 86400000
  const old = (iso?: string | null) => Boolean(iso) && new Date(iso as string).getTime() < cutoff
  const txIds = data.transactions.filter((t) => old(t.deletedAt)).map((t) => t.id)
  let next = txIds.length ? purgeTransactions(data, txIds) : data
  const custIds = next.customers.filter((c) => old(c.deletedAt)).map((c) => c.id)
  if (custIds.length) next = purgeCustomers(next, custIds)
  return next
}
